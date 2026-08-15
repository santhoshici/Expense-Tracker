const Expense = require('../models/Expense');
const Income = require('../models/Income');
const { Types } = require('mongoose');
const { QuerySanitizer } = require('../src/services/querySanitizer');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Keyword-based zero-shot categorizer fallback for offline ML service
 */
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

/**
 * Categorize expense description using FastAPI ML service or fallback categorizer
 */
exports.categorizeExpense = async (req, res) => {
  const { description, amount } = req.body;
  if (!description) {
    return res.status(400).json({ message: "Description is required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${ML_SERVICE_URL}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, amount: Number(amount) || 0 }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch (error) {
    // ML microservice offline or timeout - fallback to local categorizer
  }

  const fallback = fallbackCategorize(description);
  return res.json(fallback);
};

/**
 * Anomaly detection service using Z-score and threshold checks
 */
exports.detectAnomaly = async (req, res) => {
  const { amount, history = [], category } = req.body;
  if (amount === undefined) {
    return res.status(400).json({ message: "Amount is required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${ML_SERVICE_URL}/anomaly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        history: Array.isArray(history) ? history : [],
        category: category || "",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch (error) {
    // Fallback to local Z-score calculation
  }

  const numAmount = Number(amount);
  const numHistory = (Array.isArray(history) ? history : []).map(Number).filter((n) => !isNaN(n));

  if (numHistory.length === 0) {
    return res.json({ isAnomaly: false, anomalyReason: "Insufficient historical data", zScore: 0, pctAboveMean: 0 });
  }

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

/**
 * Text-to-Query AI Analytics Copilot Engine
 * Parses natural language queries into structured JSON with executed MongoDB charts & metrics
 */
exports.textToQuery = async (req, res) => {
  const { question } = req.body;
  const userIdStr = req.user?._id ? req.user._id.toString() : req.user?.id;

  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  try {
    const userObjectId = new Types.ObjectId(userIdStr);
    const qLower = question.toLowerCase();

    // Sanitize natural language question against injection
    QuerySanitizer.sanitizeAndInjectUserContext(question, userIdStr);

    let chartType = 'bar';
    let chartTitle = 'Expense Breakdown by Category';
    let xAxisKey = 'category';
    let yAxisKey = 'amount';
    let data = [];
    let explanation = '';
    let summaryMetrics = {};
    let generatedQuery = '';

    if (qLower.includes('income vs') || qLower.includes('overview') || qLower.includes('balance') || qLower.includes('compare')) {
      // Income vs Expense comparison
      const totalInc = await Income.aggregate(QuerySanitizer.enforceUserIsolationPipeline([{ $group: { _id: null, total: { $sum: "$amount" } } }], userObjectId));
      const totalExp = await Expense.aggregate(QuerySanitizer.enforceUserIsolationPipeline([{ $group: { _id: null, total: { $sum: "$amount" } } }], userObjectId));

      const incVal = totalInc[0]?.total || 0;
      const expVal = totalExp[0]?.total || 0;
      const balVal = incVal - expVal;

      chartType = 'pie';
      chartTitle = 'Income vs Expenses Overview';
      xAxisKey = 'name';
      yAxisKey = 'amount';
      data = [
        { name: 'Total Income', amount: incVal },
        { name: 'Total Expenses', amount: expVal },
      ];
      explanation = `Your total recorded income is ₹${incVal.toLocaleString()} and total expenses are ₹${expVal.toLocaleString()}, leaving a net balance of ₹${balVal.toLocaleString()}.`;
      summaryMetrics = { totalAmount: balVal, highestCategory: incVal > expVal ? 'Income' : 'Expenses' };
      generatedQuery = `db.income.aggregate([{$match: {userId: '${userIdStr}'}}, {$group: {_id: null, total: {$sum: '$amount'}}}]); db.expense.aggregate(...)`;

    } else if (qLower.includes('recent') || qLower.includes('transaction') || qLower.includes('table') || qLower.includes('history') || qLower.includes('list')) {
      // Recent transactions table
      const recentExpenses = await Expense.find({ userId: userObjectId }).sort({ date: -1 }).limit(10);
      chartType = 'table';
      chartTitle = 'Recent Expense Transactions';
      xAxisKey = 'category';
      yAxisKey = 'amount';
      data = recentExpenses.map(e => ({
        category: e.category,
        amount: e.amount,
        date: new Date(e.date).toLocaleDateString(),
      }));
      const totalRecent = data.reduce((acc, i) => acc + i.amount, 0);
      explanation = `Here are your latest ${data.length} transactions totaling ₹${totalRecent.toLocaleString()}.`;
      summaryMetrics = { totalAmount: totalRecent, highestCategory: data[0]?.category || 'N/A' };
      generatedQuery = `db.expenses.find({userId: '${userIdStr}'}).sort({date: -1}).limit(10)`;

    } else if (qLower.includes('income') || qLower.includes('source') || qLower.includes('earn')) {
      // Income by source
      const incomeAgg = await Income.aggregate(QuerySanitizer.enforceUserIsolationPipeline([
        { $group: { _id: "$source", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } }
      ], userObjectId));

      chartType = 'pie';
      chartTitle = 'Income Distribution by Source';
      xAxisKey = 'name';
      yAxisKey = 'amount';
      data = incomeAgg.map(i => ({ name: i._id || 'Other', amount: i.total }));
      const totalInc = data.reduce((acc, i) => acc + i.amount, 0);
      explanation = `You have earned a total of ₹${totalInc.toLocaleString()} across ${data.length} income sources. Your top income source is ${data[0]?.name || 'N/A'}.`;
      summaryMetrics = { totalAmount: totalInc, highestCategory: data[0]?.name || 'N/A' };
      generatedQuery = `db.incomes.aggregate([{$match: {userId: '${userIdStr}'}}, {$group: {_id: '$source', total: {$sum: '$amount'}}}])`;

    } else {
      // Default: Expenses grouped by Category
      const expAgg = await Expense.aggregate(QuerySanitizer.enforceUserIsolationPipeline([
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } }
      ], userObjectId));

      chartType = 'bar';
      chartTitle = 'Expense Breakdown by Category';
      xAxisKey = 'category';
      yAxisKey = 'amount';
      data = expAgg.map(e => ({ category: e._id || 'Uncategorized', amount: e.total }));
      const totalExp = data.reduce((acc, i) => acc + i.amount, 0);
      const topCat = data[0]?.category || 'N/A';

      explanation = data.length > 0
        ? `You have spent a total of ₹${totalExp.toLocaleString()} across ${data.length} categories. Your highest spending category is ${topCat} (₹${(data[0]?.amount || 0).toLocaleString()}).`
        : 'No expense transactions recorded yet. Add expenses to generate insights!';
      summaryMetrics = { totalAmount: totalExp, highestCategory: topCat };
      generatedQuery = `db.expenses.aggregate([{$match: {userId: '${userIdStr}'}}, {$group: {_id: '$category', total: {$sum: '$amount'}}}])`;
    }

    return res.json({
      explanation,
      generatedQuery,
      chartType,
      chartTitle,
      xAxisKey,
      yAxisKey,
      data,
      summaryMetrics,
    });
  } catch (error) {
    console.error('[AI Query Error]:', error);
    return res.status(500).json({
      explanation: `Unable to process query at this time: ${error.message}`,
      generatedQuery: '',
      chartType: 'metric_card',
      chartTitle: 'Error Processing Query',
      xAxisKey: '',
      yAxisKey: '',
      data: [],
      summaryMetrics: {},
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
    return res.json({ status: "online (in-app engine active)", mlServiceUrl: ML_SERVICE_URL });
  }
};
