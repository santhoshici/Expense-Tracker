"""FastAPI microservice for the expense tracker ML features.

Exposes categorisation, anomaly detection and text-to-query endpoints backed
by the pure-Python modules in this package.  sklearn is optional: every
endpoint degrades gracefully when it is missing.
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    import uvicorn
    UVICORN_AVAILABLE = True
except ImportError:  # pragma: no cover - only affects `python main.py`
    uvicorn = None
    UVICORN_AVAILABLE = False

from categorizer import (
    SKLEARN_AVAILABLE as CATEGORIZER_SKLEARN,
    predict_category,
)
from anomaly_detector import (
    SKLEARN_AVAILABLE as ANOMALY_SKLEARN,
    detect_anomaly,
)
from text_to_sql import (
    SCHEMA_HINT,
    build_aggregation_pipeline,
    build_pipeline,
    generate_fallback_data,
)

app = FastAPI(title="Expense Tracker ML", version="1.0.0")


class CategorizeRequest(BaseModel):
    description: str
    amount: float = Field(default=0.0, ge=0)


class AnomalyRequest(BaseModel):
    amount: float
    history: list[float] = Field(default_factory=list)
    category: str = ""


class QueryRequest(BaseModel):
    question: str
    userId: str
    expenses: list[dict] = Field(default_factory=list)
    incomes: list[dict] = Field(default_factory=list)


@app.get("/health")
def health():
    """Report health and which model backends are active."""
    return {
        "status": "ok",
        "categorizer": "tfidf" if CATEGORIZER_SKLEARN else "keyword",
        "anomaly": "isolation-forest" if ANOMALY_SKLEARN else "statistical",
        "textToQuery": "heuristic",
    }


@app.post("/categorize")
def categorize(request: CategorizeRequest):
    """Categorise one expense description."""
    try:
        return predict_category(request.description, request.amount or 0.0)
    except Exception as exc:  # pragma: no cover - defensive
        return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.post("/anomaly")
def anomaly(request: AnomalyRequest):
    """Detect whether one amount is anomalous vs its history."""
    try:
        return detect_anomaly(
            request.amount, request.history, request.category
        )
    except Exception as exc:  # pragma: no cover - defensive
        return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.post("/text-to-query")
def text_to_query(request: QueryRequest):
    """Translate a question + sample data into a chart-ready response."""
    try:
        plan = build_aggregation_pipeline(
            request.question, request.userId
        )
        plan["userId"] = request.userId
        pipeline = build_pipeline(plan)
        if not validate_pipeline(pipeline):
            raise HTTPException(status_code=400, detail="Unsafe pipeline")
        plan["pipeline"] = pipeline
        result = generate_fallback_data(
            plan, request.expenses, request.incomes
        )
        result["schemaHint"] = SCHEMA_HINT
        return result
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        return JSONResponse(status_code=500, content={"detail": str(exc)})


if __name__ == "__main__":
    if UVICORN_AVAILABLE:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:  # pragma: no cover
        raise SystemExit("uvicorn is not installed; run via a server that supports FastAPI")