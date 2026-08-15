const Expense = require('../models/Expense');
const Income = require('../models/Income');
const { Types } = require('mongoose');
const { QuerySanitizer } = require('../src/services/querySanitizer');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// ──────────────────────────────────────────────
// ZERO-SHOT FALLBACK CATEGORIZER
// ──────────────────────────────────────────────
function fallbackCategorize(description = '') {
  const desc = description.toLowerCase();
  const rules = [
    { keywords: ['coffee', 'starbucks', 'food', 'lunch', 'dinner', 'restaurant', 'pizza', 'burger', 'cafe', 'groceries', 'supermarket', 'zomato', 'swiggy'], category: 'Food' },
    { keywords: ['rent', 'mortgage', 'apartment', 'housing', 'lease'], category: 'Housing' },
    { keywords: ['electricity', 'water', 'internet', 'wifi', 'utility', 'gas', 'power', 'bill'], category: 'Utilities' },
    { keywords: ['movie', 'netflix', 'spotify', 'cinema', 'game', 'gaming', 'concert', 'entertainment', 'ticket'], category: 'Entertainment' },
    { keywords: ['doctor', 'hospital', 'pharmacy', 'medicine', 'health', 'clinic', 'dentist'], category: 'Healthcare' },
    { keywords: ['uber', 'lyft', 'cab', 'taxi', 'bus', 'train', 'flight', 'fuel', 'petrol', 'transport', 'parking'], category: 'Transport' },
    { keywords: ['stock', 'crypto', 'investment', 'mutual fund', 'savings', 'bond', 'shares'], category: 'Investment' },
    { keywords: ['salary', 'paycheck', 'bonus', 'stipend', 'income'], category: 'Salary' },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((k) => desc.includes(k))) {
      return { category: rule.category, confidence: 0.9, suggested: true };
    }
  }
  return { category: 'Uncategorized / Review Required', confidence: 0.4, suggested: false };
}

exports.categorizeExpense = async (req, res) => {
  const { description, amount } = req.body;
  if (!description) return res.status(400).json({ message: 'Description is required' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${ML_SERVICE_URL}/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount: Number(amount) || 0 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) return res.json(await response.json());
  } catch (_) { /* fallback below */ }

  return res.json(fallbackCategorize(description));
};

// ──────────────────────────────────────────────
// ANOMALY DETECTION (Z-SCORE FALLBACK)
// ──────────────────────────────────────────────
exports.detectAnomaly = async (req, res) => {
  const { amount, history = [], category } = req.body;
  if (amount === undefined) return res.status(400).json({ message: 'Amount is required' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${ML_SERVICE_URL}/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), history: Array.isArray(history) ? history : [], category: category || '' }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) return res.json(await response.json());
  } catch (_) { /* fallback below */ }

  const numAmount = Number(amount);
  const numHistory = (Array.isArray(history) ? history : []).map(Number).filter((n) => !isNaN(n));
  if (numHistory.length === 0) return res.json({ isAnomaly: false, anomalyReason: 'Insufficient historical data', zScore: 0, pctAboveMean: 0 });

  const mean = numHistory.reduce((a, b) => a + b, 0) / numHistory.length;
  const variance = numHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numHistory.length;
  const stdDev = Math.sqrt(variance) || 1;
  const zScore = (numAmount - mean) / stdDev;
  const pctAboveMean = mean > 0 ? Math.round(((numAmount - mean) / mean) * 100) : 0;
  const isAnomaly = zScore > 2.2 || (mean > 0 && numAmount > mean * 2.5);
  const categoryLabel = category ? `in ${category}` : 'overall';

  return res.json({
    isAnomaly,
    anomalyReason: isAnomaly
      ? `Transaction of ₹${numAmount.toLocaleString()} is ${pctAboveMean}% higher than your average spend (${categoryLabel})`
      : 'Normal spending pattern',
    zScore: Number(zScore.toFixed(2)),
    pctAboveMean,
  });
};

// ──────────────────────────────────────────────
// INTENT & CONTEXT HELPERS
// ──────────────────────────────────────────────

/**
 * Extract a numeric limit from a string like "last 3", "top 5", "recent 2"
 * Returns null if not found.
 */
function extractLimit(text) {
  const match = text.match(/(?:last|top|recent|show|give me|get|fetch)\s+(\d+)/i) || text.match(/(\d+)\s+(?:transaction|income|expense|record|result)/i);
  if (match) return parseInt(match[1], 10);
  // word-to-number for small numbers
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const [word, num] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return num;
  }
  return null;
}

/**
 * Determine which data collection the user is asking about:
 * 'income' | 'expense' | 'combined' | 'overview'
 */
function classifyIntent(text, history = []) {
  const combined = text + ' ' + history.map((m) => m.text || '').join(' ');
  const lower = combined.toLowerCase();

  // Overview/comparison intents
  if (/income vs|compare|overview|balance|net|total|profit|saving/.test(lower)) return 'overview';

  // Strong income signals
  const incomeScore = (lower.match(/\b(income|earn|salary|source|revenue|receiv|credit)\b/g) || []).length;
  // Strong expense signals
  const expenseScore = (lower.match(/\b(expense|spend|spent|cost|purchase|debit|payment|paid|bill)\b/g) || []).length;

  // If both, check which is stronger
  if (incomeScore > 0 && expenseScore === 0) return 'income';
  if (expenseScore > 0 && incomeScore === 0) return 'expense';
  if (incomeScore > expenseScore) return 'income';
  if (expenseScore > incomeScore) return 'expense';

  // "transaction" / "recent" alone = combined feed
  if (/\b(transaction|history|recent|latest)\b/.test(lower)) return 'combined';

  return 'expense'; // safe default
}

/**
 * RAG-style: extract domain search keywords from user text.
 * Strips stopwords and query verbs; returns potential category/source terms.
 */
function extractSearchTerms(text) {
  const stopwords = new Set([
    'show', 'me', 'my', 'a', 'an', 'the', 'all', 'of', 'get', 'find', 'give',
    'list', 'chart', 'graph', 'table', 'bar', 'pie', 'line', 'last', 'top',
    'recent', 'latest', 'transactions', 'transaction', 'income', 'expense',
    'expenses', 'incomes', 'from', 'in', 'to', 'and', 'or', 'for', 'with',
    'related', 'by', 'category', 'source', 'data', 'what', 'where', 'how',
    'much', 'is', 'are', 'have', 'had', 'do', 'did', 'it', 'its', 'i',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

/**
 * Resolve multi-turn context:
 * If current question is vague ("show me those", "filter that", "give me the last 3"),
 * inherit the intent + search terms from recent history.
 */
function resolveContext(question, history = []) {
  const vaguePatterns = /^(show|get|give|fetch|list|those|that|filter|more|again|the last|last \d|top \d|recent \d)/i;
  const isVague = vaguePatterns.test(question.trim()) && question.trim().split(/\s+/).length <= 6;

  let resolvedIntent = classifyIntent(question);
  let searchTerms = extractSearchTerms(question);
  const limitInQuestion = extractLimit(question);

  // Pull context from last 3 assistant messages
  const recentAI = history.filter((m) => m.sender === 'ai').slice(-3).reverse();

  if (isVague && recentAI.length > 0) {
    // Inherit prior intent if current question doesn't have strong signals
    const priorUserMsgs = history.filter((m) => m.sender === 'user').slice(-3);
    const priorText = priorUserMsgs.map((m) => m.text).join(' ');
    resolvedIntent = classifyIntent(question + ' ' + priorText, []);
    const priorTerms = extractSearchTerms(priorText);
    // Merge - current terms take priority, fill from prior if empty
    if (searchTerms.length === 0) searchTerms = priorTerms;
  }

  return { resolvedIntent, searchTerms, limit: limitInQuestion };
}

// ──────────────────────────────────────────────
// MAIN: TEXT-TO-QUERY AI COPILOT ENGINE
// ──────────────────────────────────────────────
exports.textToQuery = async (req, res) => {
  const { question, chatHistory = [] } = req.body;
  const userIdStr = req.user?._id ? req.user._id.toString() : req.user?.id;

  if (!question) return res.status(400).json({ message: 'Question is required' });

  try {
    const userObjectId = new Types.ObjectId(userIdStr);
    QuerySanitizer.sanitizeAndInjectUserContext(question, userIdStr);

    // ── Resolve intent, search terms, and limit from conversation context ──
    const { resolvedIntent, searchTerms, limit } = resolveContext(question, chatHistory);
    const qLower = question.toLowerCase();

    let chartType = 'bar';
    let chartTitle = '';
    let xAxisKey = 'category';
    let yAxisKey = 'amount';
    let data = [];
    let explanation = '';
    let summaryMetrics = {};
    let generatedQuery = '';

    // ── BRANCH 1: Overview / Income vs Expense Comparison ──
    if (resolvedIntent === 'overview') {
      const [totalIncResult, totalExpResult] = await Promise.all([
        Income.aggregate(QuerySanitizer.enforceUserIsolationPipeline([{ $group: { _id: null, total: { $sum: '$amount' } } }], userObjectId)),
        Expense.aggregate(QuerySanitizer.enforceUserIsolationPipeline([{ $group: { _id: null, total: { $sum: '$amount' } } }], userObjectId)),
      ]);
      const incVal = totalIncResult[0]?.total || 0;
      const expVal = totalExpResult[0]?.total || 0;
      const balVal = incVal - expVal;

      chartType = 'pie';
      chartTitle = 'Income vs Expenses Overview';
      xAxisKey = 'name';
      yAxisKey = 'amount';
      data = [
        { name: 'Total Income', amount: incVal },
        { name: 'Total Expenses', amount: expVal },
      ];
      explanation = `Your total income is ₹${incVal.toLocaleString()} and total expenses are ₹${expVal.toLocaleString()}. Net balance: ₹${balVal.toLocaleString()}.`;
      summaryMetrics = { totalAmount: balVal, label: balVal >= 0 ? 'Surplus' : 'Deficit' };
      generatedQuery = `Income.aggregate + Expense.aggregate (userId match, $sum amount)`;
    }

    // ── BRANCH 2: Combined Recent Transactions Feed ──
    else if (resolvedIntent === 'combined') {
      const fetchLimit = limit || 10;

      const [recentIncome, recentExpenses] = await Promise.all([
        Income.find({ userId: userObjectId }).sort({ date: -1 }).limit(fetchLimit).lean(),
        Expense.find({ userId: userObjectId }).sort({ date: -1 }).limit(fetchLimit).lean(),
      ]);

      const combined = [
        ...recentIncome.map((i) => ({ type: 'Income', label: i.source, amount: i.amount, date: new Date(i.date) })),
        ...recentExpenses.map((e) => ({ type: 'Expense', label: e.category, amount: e.amount, date: new Date(e.date) })),
      ]
        .sort((a, b) => b.date - a.date)
        .slice(0, fetchLimit);

      chartType = 'table';
      chartTitle = `Last ${combined.length} Transactions (Income + Expenses)`;
      xAxisKey = 'label';
      yAxisKey = 'amount';
      data = combined.map((t) => ({
        type: t.type,
        label: t.label,
        amount: t.amount,
        date: t.date.toLocaleDateString(),
      }));
      const totalInCombined = recentIncome.reduce((s, i) => s + i.amount, 0);
      const totalExCombined = recentExpenses.reduce((s, e) => s + e.amount, 0);
      explanation = `Here are your ${data.length} most recent transactions. Income: ₹${totalInCombined.toLocaleString()}, Expenses: ₹${totalExCombined.toLocaleString()}.`;
      summaryMetrics = { count: data.length };
      generatedQuery = `Income.find + Expense.find (userId, sorted by date desc, limit ${fetchLimit})`;
    }

    // ── BRANCH 3: Income queries (with optional RAG fuzzy search) ──
    else if (resolvedIntent === 'income') {
      const fetchLimit = limit || null;

      // Determine if user wants grouped chart or a raw list
      const wantsList = /last|recent|table|list|show me \d|top \d/.test(qLower) || limit !== null;
      const wantsGrouped = /group|breakdown|distribut|category|source|by/.test(qLower) || (!wantsList && searchTerms.length === 0);

      // Build the base match
      const baseMatch = { userId: userObjectId };

      // RAG-style: if search terms exist, filter `source` with regex
      const relevantTerms = searchTerms.filter(
        (t) => !['income', 'source', 'earn', 'salary', 'amount'].includes(t)
      );
      if (relevantTerms.length > 0) {
        baseMatch.source = { $regex: relevantTerms.join('|'), $options: 'i' };
      }

      if (wantsGrouped && relevantTerms.length === 0) {
        // Grouped by source — pie/bar chart
        const incomeAgg = await Income.aggregate(
          QuerySanitizer.enforceUserIsolationPipeline(
            [{ $group: { _id: '$source', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }],
            userObjectId
          )
        );

        chartType = 'pie';
        chartTitle = 'Income Distribution by Source';
        xAxisKey = 'name';
        yAxisKey = 'amount';
        data = incomeAgg.map((i) => ({ name: i._id || 'Other', amount: i.total }));
        const totalInc = data.reduce((acc, i) => acc + i.amount, 0);
        explanation =
          data.length > 0
            ? `You earned a total of ₹${totalInc.toLocaleString()} across ${data.length} income source(s). Top source: ${data[0]?.name || 'N/A'} (₹${(data[0]?.amount || 0).toLocaleString()}).`
            : 'No income records found yet. Add income entries to see your breakdown.';
        summaryMetrics = { totalAmount: totalInc, highestCategory: data[0]?.name || 'N/A' };
        generatedQuery = `Income.aggregate([{$match: {userId}}, {$group: {_id: '$source', total: {$sum: '$amount'}}}])`;
      } else {
        // Itemized list — table or bar
        let query = Income.find(baseMatch).sort({ date: -1 });
        if (fetchLimit) query = query.limit(fetchLimit);
        const incomeList = await query.lean();

        chartType = incomeList.length <= 5 ? 'bar' : 'table';
        chartTitle = relevantTerms.length > 0
          ? `Income matching "${relevantTerms.join(', ')}"`
          : `Last ${incomeList.length} Income Entries`;
        xAxisKey = 'source';
        yAxisKey = 'amount';
        data = incomeList.map((i) => ({
          source: i.source,
          amount: i.amount,
          date: new Date(i.date).toLocaleDateString(),
        }));
        const total = data.reduce((acc, i) => acc + i.amount, 0);
        explanation =
          data.length > 0
            ? relevantTerms.length > 0
              ? `Found ${data.length} income record(s) matching "${relevantTerms.join(', ')}". Total: ₹${total.toLocaleString()}.`
              : `Here are your last ${data.length} income record(s). Total: ₹${total.toLocaleString()}.`
            : relevantTerms.length > 0
              ? `No income records found matching "${relevantTerms.join(', ')}". Try a different keyword.`
              : 'No income entries recorded yet.';
        summaryMetrics = { totalAmount: total, count: data.length };
        generatedQuery = `Income.find({userId, source: /${relevantTerms.join('|') || '*'}/i}).sort({date:-1}).limit(${fetchLimit || 'all'})`;
      }
    }

    // ── BRANCH 4: Expense queries (with optional RAG fuzzy search) ──
    else {
      const fetchLimit = limit || null;
      const wantsList = /last|recent|table|list|show me \d|top \d/.test(qLower) || limit !== null;
      const wantsGrouped = /group|breakdown|distribut|category|by/.test(qLower) || (!wantsList && searchTerms.length === 0);

      const baseMatch = { userId: userObjectId };
      const relevantTerms = searchTerms.filter(
        (t) => !['expense', 'spend', 'spent', 'cost', 'category', 'payment'].includes(t)
      );
      if (relevantTerms.length > 0) {
        baseMatch.category = { $regex: relevantTerms.join('|'), $options: 'i' };
      }

      if (wantsGrouped && relevantTerms.length === 0) {
        // Grouped by category — bar chart
        const expAgg = await Expense.aggregate(
          QuerySanitizer.enforceUserIsolationPipeline(
            [{ $group: { _id: '$category', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }],
            userObjectId
          )
        );

        chartType = 'bar';
        chartTitle = 'Expense Breakdown by Category';
        xAxisKey = 'category';
        yAxisKey = 'amount';
        data = expAgg.map((e) => ({ category: e._id || 'Uncategorized', amount: e.total }));
        const totalExp = data.reduce((acc, i) => acc + i.amount, 0);
        explanation =
          data.length > 0
            ? `You've spent ₹${totalExp.toLocaleString()} total across ${data.length} categor${data.length === 1 ? 'y' : 'ies'}. Top category: ${data[0]?.category} (₹${(data[0]?.amount || 0).toLocaleString()}).`
            : 'No expense records found. Add expenses to see your breakdown.';
        summaryMetrics = { totalAmount: totalExp, highestCategory: data[0]?.category || 'N/A' };
        generatedQuery = `Expense.aggregate([{$match: {userId}}, {$group: {_id: '$category', total: {$sum: '$amount'}}}])`;
      } else {
        // Itemized list
        let query = Expense.find(baseMatch).sort({ date: -1 });
        if (fetchLimit) query = query.limit(fetchLimit);
        const expList = await query.lean();

        chartType = expList.length <= 5 ? 'bar' : 'table';
        chartTitle = relevantTerms.length > 0
          ? `Expenses matching "${relevantTerms.join(', ')}"`
          : `Last ${expList.length} Expense Entries`;
        xAxisKey = 'category';
        yAxisKey = 'amount';
        data = expList.map((e) => ({
          category: e.category,
          amount: e.amount,
          date: new Date(e.date).toLocaleDateString(),
        }));
        const total = data.reduce((acc, e) => acc + e.amount, 0);
        explanation =
          data.length > 0
            ? relevantTerms.length > 0
              ? `Found ${data.length} expense(s) matching "${relevantTerms.join(', ')}". Total: ₹${total.toLocaleString()}.`
              : `Here are your last ${data.length} expense record(s). Total: ₹${total.toLocaleString()}.`
            : relevantTerms.length > 0
              ? `No expenses found matching "${relevantTerms.join(', ')}". Try a broader keyword.`
              : 'No expense records found yet.';
        summaryMetrics = { totalAmount: total, count: data.length };
        generatedQuery = `Expense.find({userId, category: /${relevantTerms.join('|') || '*'}/i}).sort({date:-1}).limit(${fetchLimit || 'all'})`;
      }
    }

    return res.json({ explanation, generatedQuery, chartType, chartTitle, xAxisKey, yAxisKey, data, summaryMetrics });
  } catch (error) {
    console.error('[AI Query Error]:', error);
    return res.status(500).json({
      explanation: `Unable to process query: ${error.message}`,
      generatedQuery: '',
      chartType: 'metric_card',
      chartTitle: 'Error',
      xAxisKey: '',
      yAxisKey: '',
      data: [],
      summaryMetrics: {},
    });
  }
};

// ──────────────────────────────────────────────
// AI SERVICE HEALTH CHECK
// ──────────────────────────────────────────────
exports.getAIHealth = async (req, res) => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`);
    return res.json(await response.json());
  } catch (_) {
    return res.json({ status: 'online (in-app engine active)', mlServiceUrl: ML_SERVICE_URL });
  }
};
