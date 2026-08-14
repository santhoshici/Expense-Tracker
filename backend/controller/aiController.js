const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Proxy category prediction request to ML service
 */
exports.categorizeExpense = async (req, res) => {
  try {
    const { description, amount } = req.body;
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    const response = await fetch(`${ML_SERVICE_URL}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amount: Number(amount) || 0 }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ message: "ML categorizer error", error: err });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("AI categorize controller error:", error.message);
    return res.status(503).json({
      category: "Uncategorized / Review Required",
      confidence: 0,
      suggested: false,
      message: "ML service offline or unreachable",
    });
  }
};

/**
 * Proxy anomaly detection request to ML service
 */
exports.detectAnomaly = async (req, res) => {
  try {
    const { amount, history, category } = req.body;
    if (amount === undefined) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const response = await fetch(`${ML_SERVICE_URL}/anomaly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        history: Array.isArray(history) ? history : [],
        category: category || "",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ message: "ML anomaly detector error", error: err });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("AI anomaly controller error:", error.message);
    return res.status(503).json({
      isAnomaly: false,
      anomalyReason: "ML service offline",
      zScore: 0,
      pctAboveMean: 0,
    });
  }
};

/**
 * Proxy natural language text-to-query request to ML service
 */
exports.textToQuery = async (req, res) => {
  try {
    const { question, expenses, incomes } = req.body;
    const userId = req.user._id ? req.user._id.toString() : req.user.id;

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    const response = await fetch(`${ML_SERVICE_URL}/text-to-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        userId,
        expenses: Array.isArray(expenses) ? expenses : [],
        incomes: Array.isArray(incomes) ? incomes : [],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ message: "ML text-to-query error", error: err });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error("AI query controller error:", error.message);
    return res.status(503).json({
      explanation: "Unable to process query at this time (ML service unreachable).",
      generatedQuery: "",
      chartType: "metric_card",
      chartTitle: "Service Unavailable",
      xAxisKey: "",
      yAxisKey: "",
      data: [],
    });
  }
};

/**
 * Health check endpoint
 */
exports.getAIHealth = async (req, res) => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`);
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return res.status(503).json({ status: "offline", error: error.message });
  }
};
