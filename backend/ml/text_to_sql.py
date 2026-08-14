"""Convert a plain-language finance question into a MongoDB-aggregation plan.

This is NOT a real SQL dialect - the backing store is MongoDB, so the "SQL"
produced here is a Mongo-style aggregation pipeline vocabulary.  Everything
is READ-ONLY: validate_pipeline rejects any pipeline containing $out, $merge
or $unionWith.
"""
import re
from datetime import datetime, timedelta

# Schema hint surfaced to callers (and kept in sync with the Mongo models).
SCHEMA_HINT = (
    "expenses collection: {userId: ObjectId, category: string, "
    "amount: number, date: ISODate}. incomes collection: "
    "{userId: ObjectId, source: string, amount: number, date: ISODate}. "
    "READ-ONLY - no writes are allowed."
)

_INCOME_KEYWORDS = (
    "income", "salary", "earning", "received", "credit", "earning",
    "payout", "wage", "allowance", "reimbursement",
)
_EXPENSE_KEYWORDS = (
    "spend", "spent", "expense", "expenses", "paid", "cost", "lent",
    "purchase", "bill",
)
_PIE_KEYWORDS = ("pie", "share", "split", "breakdown", "distribution")
_BAR_KEYWORDS = ("bar", "top", "highest", "compare each", "per category")
_LINE_KEYWORDS = ("line", "trend", "over time", "monthly", "month over")
_CATEGORY_ALIASES = {
    "food": "Food", "restaurant": "Food", "dining": "Food", "grocer": "Food",
    "eating": "Food", "housing": "Housing", "rent": "Housing",
    "utilities": "Utilities", "electric": "Utilities", "power": "Utilities",
    "entertainment": "Entertainment", "fun": "Entertainment",
    "movie": "Entertainment", "healthcare": "Healthcare",
    "health": "Healthcare", "medical": "Healthcare", "hospital": "Healthcare",
    "transport": "Transport", "travel": "Transport", "fuel": "Transport",
    "uber": "Transport", "ola": "Transport", "investment": "Investment",
    "invest": "Investment", "stocks": "Investment", "salary": "Salary",
    "income": "Income",
}


def _month_bucket(date_value):
    """Return 'YYYY-MM' from a date string or datetime."""
    if isinstance(date_value, datetime):
        return date_value.strftime("%Y-%m")
    try:
        return datetime.fromisoformat(str(date_value)).strftime("%Y-%m")
    except (ValueError, TypeError):
        return ""
def _extract_categories(question):
    """Pull up to two known category aliases out of a question."""
    found = []
    for token in re.findall(r"[a-z]+", question.lower()):
        category = _CATEGORY_ALIASES.get(token)
        if category and category not in found:
            found.append(category)
        if len(found) >= 2:
            break
    return found


def build_aggregation_pipeline(question, userId, now=None):
    """Build a chart-plan dict from a natural-language finance question.

    Returns a plan shaped like:
    {
      "collection": "expenses" | "incomes" | "combined",
      "match": {...userId always injected...},
      "group": {"_id": "category"|"month"|None, "total": {"$sum": "$amount"}},
      "sort": {"total": -1},
      "limit": 10,
      "chartType": "bar"|"line"|"pie"|"metric_card"|"table",
      "xAxisKey": "category"|"month"|"_id",
      "yAxisKey": "total"|"amount",
      "title": str,
      "summaryHint": {...},
      ...
    }
    """
    text = (question or "").lower()
    categories = _extract_categories(question)

    # Income vs expense.
    income_score = sum(1 for kw in _INCOME_KEYWORDS if kw in text)
    expense_score = sum(1 for kw in _EXPENSE_KEYWORDS if kw in text)
    collection = "incomes" if income_score > expense_score else "expenses"

    # Chart type.
    if any(kw in text for kw in _PIE_KEYWORDS):
        chart_type = "pie"
    elif any(kw in text for kw in _LINE_KEYWORDS):
        chart_type = "line"
    elif any(kw in text for kw in _BAR_KEYWORDS) or "vs" in text or "versus" in text:
        chart_type = "bar"
    else:
        # Default to a simple bar breakdown unless the question is pointed
        # at a single summary.
        chart_type = "bar" if not re.search(r"(total|how much|sum|what is my)", text) else "metric_card"

    # Month bucketing vs category grouping.
    monthly = any(kw in text for kw in ("month", "monthly", "over time", "per month", "trend"))
    group_id = "month" if monthly else "category"
    x_axis = "month" if monthly else "category"

    # Comparison questions: "food vs entertainment", "compare a and b".
    comparison = None
    if re.search(r"\b(vs|versus|compare)\b", text) and len(_extract_categories(question)) >= 2:
        cats = _extract_categories(question)[:2]
        comparison = {"categories": cats, "by": "month"}
        collection = "expenses"
        chart_type = "line" if any(kw in text for kw in _LINE_KEYWORDS) else "bar"
        group_id = "month"
        x_axis = "month"

    # Limit: top N or ALL-10.
    limit = 10
    m = re.search(r"\b(top|last)\s+(\d+)\b", text)
    if m:
        limit = min(int(m.group(2)), 50)

    # Title.
    title = "Income" if collection == "incomes" else "Expenses"
    if comparison:
        title = " vs ".join(comparison["categories"])
    elif monthly:
        title += " over time"
    elif categories:
        title += " by category"

    # Build the match filter (userId is ALWAYS injected downstream).
    match = {"userId": str(userId)}
    if categories and not comparison:
        match["category"] = {"$in": categories}

    group = {"_id": group_id, "total": {"$sum": "$amount"}}
    sort = {"total": -1}
    if monthly and not comparison:
        sort = {"_id": 1}  # chronological for a line/trend

    summary_hint = {
        "metricLabel": "Total {} when {}m".format(
            "income" if collection == "incomes" else "spend", group_id
        ),
        "categoryFilter": categories,
        "comparison": comparison,
        "question": question,
    }

    plan = {
        "collection": collection,
        "match": match,
        "group": group,
        "sort": sort,
        "limit": limit,
        "chartType": chart_type,
        "xAxisKey": x_axis,
        "yAxisKey": "total",
        "title": title,
        "summaryHint": summary_hint,
    }

    if comparison:
        plan["comparison"] = comparison
    if categories and not comparison:
        plan["categoryFilter"] = categories

    return plan


def build_pipeline(plan):
    """Return an actual Mongo pipeline array from a plan.

    userId is forced into $match so callers can never forget to scope the
    query.  A grouping is only appended when the plan actually groups.
    """
    pipeline = []
    match = dict(plan.get("match") or {})
    match["userId"] = str(plan.get("userId") or (match.get("userId") or ""))
    pipeline.append({"$match": match})

    group_id = plan.get("group", {}).get("_id")
    if group_id:
        if group_id == "month":
            # Bucket ISODate into a YYYY-MM string before grouping.
            pipeline.append({
                "$project": {
                    "amount": "$amount",
                    "month": {"$dateToString": {"format": "%Y-%m", "date": "$date"}},
                }
            })
        pipeline.append({
            "$group": {
                "_id": "$" + group_id,
                "total": {"$sum": "$amount"},
            }
        })
        pipeline.append({"$sort": plan.get("sort") or {"total": -1}})
        pipeline.append({"$limit": plan.get("limit") or 10})
        output = {"_id": 0, "total": "$total"}
        output[group_id] = "$_id"
        pipeline.append({"$project": output})
    return pipeline
# Stage names that mutate data - never allowed on a read-only query.
_FORBIDDEN_STAGES = ("$out", "$merge", "$unionWith")


def validate_pipeline(pipeline):
    """Reject any pipeline that would write to the database.

    Returns True when the pipeline is safe to execute read-only.
    """
    if not isinstance(pipeline, list):
        return False
    for stage in pipeline:
        if not isinstance(stage, dict):
            continue
        for key in stage:
            if key in _FORBIDDEN_STAGES:
                return False
    return True


def generate_fallback_data(plan, expenses, incomes):
    """Execute a plan against in-memory lists (no MongoDB needed).

    Returns chart-ready data so the Node API can render results even without
    a live database.
    """
    expenses = expenses or []
    incomes = incomes or []
    collection = plan.get("collection", "expenses")
    if collection == "incomes":
        records = list(incomes)
    elif collection == "combined":
        records = list(expenses) + list(incomes)
    else:
        records = list(expenses)

    user_id = str(plan.get("match", {}).get("userId") or plan.get("userId") or "")
    if user_id:
        records = [r for r in records if str(r.get("userId") or "") == user_id]

    # Apply category filter from the plan (comparison or simple filter).
    category_filter = None
    if plan.get("comparison"):
        category_filter = plan["comparison"].get("categories")
    elif plan.get("categoryFilter"):
        category_filter = plan["categoryFilter"]
    elif isinstance(plan.get("match", {}).get("category"), dict):
        category_filter = plan["match"]["category"].get("$in")

    if category_filter:
        wanted = [str(c).lower() for c in category_filter]
        records = [
            r for r in records
            if str(r.get("category") or "").lower() in wanted
        ]

    group_id = plan.get("group", {}).get("_id")
    buckets = {}
    for record in records:
        if group_id == "month":
            key = _month_bucket(record.get("date"))
            key = key or "unknown"
        elif group_id == "category":
            key = str(record.get("category") or "Unknown")
        else:
            key = "_total"
        buckets.setdefault(key, 0.0)
        try:
            buckets[key] += float(record.get("amount", 0))
        except (TypeError, ValueError):
            continue

    data = [
        {plan.get("xAxisKey", "category"): key, plan.get("yAxisKey", "total"): round(value, 2)}
        for key, value in sorted(
            buckets.items(),
            key=lambda kv: kv[1] if plan.get("sort", {}).get("total", -1) != 1 else kv[0],
            reverse=plan.get("sort", {}).get("total", -1) == -1,
        )
    ]

    limit = plan.get("limit") or 10
    data = data[:limit]

    total = sum(item.get(plan.get("yAxisKey", "total"), 0) for item in data)
    count = len(records)
    average = round(total / count, 2) if count else 0
    summary_metrics = {
        "totalAmount": round(total, 2),
        "transactionCount": count,
        "averageAmount": average,
        "categoryCount": len(buckets),
        "topCategory": data[0].get(plan.get("xAxisKey", "category")) if data else None,
        "topAmount": data[0].get(plan.get("yAxisKey", "total")) if data else None,
    }

    return {
        "explanation": "In-memory fallback execution of the plan (no MongoDB).",
        "chartType": plan.get("chartType", "bar"),
        "chartTitle": plan.get("title", "Expenses"),
        "xAxisKey": plan.get("xAxisKey", "category"),
        "yAxisKey": plan.get("yAxisKey", "total"),
        "data": data,
        "summaryMetrics": summary_metrics,
        "plan": plan,
    }