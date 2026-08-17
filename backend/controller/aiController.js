const Expense = require('../models/Expense');
const Income = require('../models/Income');
const UserAIQuota = require('../models/UserAIQuota');
const { Types } = require('mongoose');
const { QuerySanitizer } = require('../src/services/querySanitizer');
const geminiService = require('../src/services/geminiService');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_DAILY_QUOTA = parseInt(process.env.AI_DAILY_QUOTA || '10', 10);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in UTC */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Check and increment the per-user daily AI quota.
 * Returns { allowed: bool, used: number, remaining: number }
 */
async function checkAndIncrementQuota(userObjectId) {
  const date = todayUTC();

  // findOneAndUpdate with upsert atomically creates or increments
  const quota = await UserAIQuota.findOneAndUpdate(
    { userId: userObjectId, date },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        expiresAt: (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d; })(),
      },
    },
    { new: true, upsert: true }
  );

  const used = quota.count;
  const remaining = Math.max(0, AI_DAILY_QUOTA - used);
  const allowed = used <= AI_DAILY_QUOTA;

  // If over quota, roll back the increment
  if (!allowed) {
    await UserAIQuota.updateOne({ userId: userObjectId, date }, { $inc: { count: -1 } });
  }

  return { allowed, used: Math.min(used, AI_DAILY_QUOTA), remaining };
}

/** Get current quota usage without incrementing */
async function getQuotaStatus(userObjectId) {
  const date = todayUTC();
  const quota = await UserAIQuota.findOne({ userId: userObjectId, date });
  const used = quota?.count || 0;
  return { used, remaining: Math.max(0, AI_DAILY_QUOTA - used), total: AI_DAILY_QUOTA };
}

// ─────────────────────────────────────────────────────────────
// ZERO-SHOT FALLBACK CATEGORIZER
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// RULE-BASED INTENT FALLBACK (when Gemini is unavailable)
// ─────────────────────────────────────────────────────────────
function extractLimit(text) {
  const match = text.match(/(?:last|top|recent|show|give me|get|fetch)\s+(\d+)/i)
    || text.match(/(\d+)\s+(?:transaction|income|expense|record|result)/i);
  if (match) return parseInt(match[1], 10);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const [word, num] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return num;
  }
  return null;
}

function extractSearchTerms(text) {
  const stopwords = new Set([
    'show', 'me', 'my', 'a', 'an', 'the', 'all', 'of', 'get', 'find', 'give',
    'list', 'chart', 'graph', 'table', 'bar', 'pie', 'line', 'last', 'top',
    'recent', 'latest', 'transactions', 'transaction', 'income', 'expense',
    'expenses', 'incomes', 'from', 'in', 'to', 'and', 'or', 'for', 'with',
    'related', 'by', 'category', 'source', 'data', 'what', 'where', 'how',
    'much', 'is', 'are', 'have', 'had', 'do', 'did', 'it', 'its', 'i',
  ]);
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

function resolveContextFallback(question, history = []) {
  const vaguePatterns = /^(show|get|give|fetch|list|those|that|filter|more|again|the last|last \d|top \d|recent \d)/i;
  const isVague = vaguePatterns.test(question.trim()) && question.trim().split(/\s+/).length <= 6;

  const combined = question + ' ' + history.map((m) => m.text || '').join(' ');
  const lower = combined.toLowerCase();
  const incomeScore = (lower.match(/\b(income|earn|salary|source|revenue|receiv|credit)\b/g) || []).length;
  const expenseScore = (lower.match(/\b(expense|spend|spent|cost|purchase|debit|payment|paid|bill)\b/g) || []).length;

  let intent;
  if (/income vs|compare|overview|balance|net|total|profit|saving/.test(lower)) intent = 'overview';
  else if (/\b(transaction|history|recent|latest)\b/.test(lower) && incomeScore === 0 && expenseScore === 0) intent = 'combined_transactions';
  else if (incomeScore > expenseScore) intent = 'income_grouped';
  else if (expenseScore > incomeScore) intent = 'expense_grouped';
  else intent = 'expense_grouped';

  let searchTerms = extractSearchTerms(question);
  if (isVague) {
    const priorText = history.filter((m) => m.sender === 'user').slice(-3).map((m) => m.text).join(' ');
    if (searchTerms.length === 0) searchTerms = extractSearchTerms(priorText);
  }

  // Refine intent if there's a limit or search term suggesting a list
  const limit = extractLimit(question);
  if (limit && intent === 'income_grouped') intent = 'income_list';
  if (limit && intent === 'expense_grouped') intent = 'expense_list';
  if (searchTerms.length > 0 && intent === 'income_grouped') intent = 'income_list';
  if (searchTerms.length > 0 && intent === 'expense_grouped') intent = 'expense_list';

  return { intent, searchTerms, limit, chartType: null, chartTitle: null, explanation: null };
}

// ─────────────────────────────────────────────────────────────
// DATA EXECUTION ENGINE (runs MongoDB queries based on parsed intent)
// ─────────────────────────────────────────────────────────────
async function executeIntent(parsedIntent, userObjectId, userIdStr) {
  const { intent, searchTerms = [], limit, chartType: suggestedChartType, chartTitle: suggestedTitle } = parsedIntent;

  let chartType = suggestedChartType || 'bar';
  let chartTitle = suggestedTitle || '';
  let xAxisKey = 'category';
  let yAxisKey = 'amount';
  let data = [];
  let summaryMetrics = {};
  let explanation = parsedIntent.explanation || '';
  let generatedQuery = '';

  // ── OVERVIEW ──────────────────────────────────────────────
  if (intent === 'overview') {
    const [totalIncResult, totalExpResult] = await Promise.all([
      Income.aggregate(QuerySanitizer.enforceUserIsolationPipeline([{ $group: { _id: null, total: { $sum: '$amount' } } }], userObjectId)),
      Expense.aggregate(QuerySanitizer.enforceUserIsolationPipeline([{ $group: { _id: null, total: { $sum: '$amount' } } }], userObjectId)),
    ]);
    const incVal = totalIncResult[0]?.total || 0;
    const expVal = totalExpResult[0]?.total || 0;
    const balVal = incVal - expVal;
    chartType = 'pie';
    chartTitle = chartTitle || 'Income vs Expenses Overview';
    xAxisKey = 'name';
    yAxisKey = 'amount';
    data = [{ name: 'Total Income', amount: incVal }, { name: 'Total Expenses', amount: expVal }];
    if (!explanation) explanation = `Your total income is ₹${incVal.toLocaleString()} and total expenses are ₹${expVal.toLocaleString()}. Net balance: ₹${balVal.toLocaleString()}.`;
    summaryMetrics = { totalAmount: balVal, label: balVal >= 0 ? 'Surplus' : 'Deficit' };
    generatedQuery = 'Income.aggregate + Expense.aggregate (grouped sum)';
  }

  // ── COMBINED TRANSACTIONS ─────────────────────────────────
  else if (intent === 'combined_transactions') {
    const fetchLimit = limit || 10;
    const [recentIncome, recentExpenses] = await Promise.all([
      Income.find({ userId: userObjectId }).sort({ date: -1 }).limit(fetchLimit).lean(),
      Expense.find({ userId: userObjectId }).sort({ date: -1 }).limit(fetchLimit).lean(),
    ]);
    const combined = [
      ...recentIncome.map((i) => ({ type: 'Income', label: i.source, amount: i.amount, date: new Date(i.date) })),
      ...recentExpenses.map((e) => ({ type: 'Expense', label: e.category, amount: e.amount, date: new Date(e.date) })),
    ].sort((a, b) => b.date - a.date).slice(0, fetchLimit);
    chartType = 'table';
    chartTitle = chartTitle || `Last ${combined.length} Transactions`;
    xAxisKey = 'label';
    yAxisKey = 'amount';
    data = combined.map((t) => ({ type: t.type, label: t.label, amount: t.amount, date: t.date.toLocaleDateString() }));
    if (!explanation) {
      const ti = recentIncome.reduce((s, i) => s + i.amount, 0);
      const te = recentExpenses.reduce((s, e) => s + e.amount, 0);
      explanation = `Here are your ${data.length} most recent transactions. Income: ₹${ti.toLocaleString()}, Expenses: ₹${te.toLocaleString()}.`;
    }
    summaryMetrics = { count: data.length };
    generatedQuery = `Income.find + Expense.find (sorted by date, limit ${fetchLimit})`;
  }

  // ── INCOME GROUPED (by source) ────────────────────────────
  else if (intent === 'income_grouped') {
    const incomeAgg = await Income.aggregate(QuerySanitizer.enforceUserIsolationPipeline([
      { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ], userObjectId));
    chartType = suggestedChartType || 'pie';
    chartTitle = chartTitle || 'Income Distribution by Source';
    xAxisKey = 'name';
    yAxisKey = 'amount';
    data = incomeAgg.map((i) => ({ name: i._id || 'Other', amount: i.total }));
    const totalInc = data.reduce((acc, i) => acc + i.amount, 0);
    if (!explanation) {
      explanation = data.length > 0
        ? `You earned ₹${totalInc.toLocaleString()} across ${data.length} income source(s). Top: ${data[0]?.name} (₹${(data[0]?.amount || 0).toLocaleString()}).`
        : 'No income records found yet.';
    }
    summaryMetrics = { totalAmount: totalInc, highestCategory: data[0]?.name || 'N/A' };
    generatedQuery = `Income.aggregate([{$match: {userId}}, {$group: {_id: '$source', total: {$sum: '$amount'}}}])`;
  }

  // ── INCOME LIST (itemized, with optional search) ───────────
  else if (intent === 'income_list') {
    const fetchLimit = limit;
    const relevantTerms = (searchTerms || []).filter((t) => !['income', 'source', 'earn', 'salary'].includes(t));
    const baseMatch = { userId: userObjectId };
    if (relevantTerms.length > 0) baseMatch.source = { $regex: relevantTerms.join('|'), $options: 'i' };
    let query = Income.find(baseMatch).sort({ date: -1 });
    if (fetchLimit) query = query.limit(fetchLimit);
    const incomeList = await query.lean();
    chartType = incomeList.length <= 5 ? (suggestedChartType || 'bar') : 'table';
    chartTitle = chartTitle || (relevantTerms.length > 0 ? `Income matching "${relevantTerms.join(', ')}"` : `Last ${incomeList.length} Income Entries`);
    xAxisKey = 'source';
    yAxisKey = 'amount';
    data = incomeList.map((i) => ({ source: i.source, amount: i.amount, date: new Date(i.date).toLocaleDateString() }));
    const total = data.reduce((acc, i) => acc + i.amount, 0);
    if (!explanation) {
      explanation = data.length > 0
        ? (relevantTerms.length > 0 ? `Found ${data.length} income record(s) matching "${relevantTerms.join(', ')}". Total: ₹${total.toLocaleString()}.` : `Here are your last ${data.length} income record(s). Total: ₹${total.toLocaleString()}.`)
        : (relevantTerms.length > 0 ? `No income records found matching "${relevantTerms.join(', ')}". Try a different keyword.` : 'No income entries recorded yet.');
    }
    summaryMetrics = { totalAmount: total, count: data.length };
    generatedQuery = `Income.find({source: /${relevantTerms.join('|') || '*'}/i}).limit(${fetchLimit || 'all'})`;
  }

  // ── EXPENSE GROUPED (by category) ────────────────────────
  else if (intent === 'expense_grouped') {
    const expAgg = await Expense.aggregate(QuerySanitizer.enforceUserIsolationPipeline([
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ], userObjectId));
    chartType = suggestedChartType || 'bar';
    chartTitle = chartTitle || 'Expense Breakdown by Category';
    xAxisKey = 'category';
    yAxisKey = 'amount';
    data = expAgg.map((e) => ({ category: e._id || 'Uncategorized', amount: e.total }));
    const totalExp = data.reduce((acc, e) => acc + e.amount, 0);
    if (!explanation) {
      explanation = data.length > 0
        ? `You've spent ₹${totalExp.toLocaleString()} across ${data.length} categor${data.length === 1 ? 'y' : 'ies'}. Top: ${data[0]?.category} (₹${(data[0]?.amount || 0).toLocaleString()}).`
        : 'No expense records found yet.';
    }
    summaryMetrics = { totalAmount: totalExp, highestCategory: data[0]?.category || 'N/A' };
    generatedQuery = `Expense.aggregate([{$match: {userId}}, {$group: {_id: '$category', total: {$sum: '$amount'}}}])`;
  }

  // ── EXPENSE LIST (itemized, with optional search) ──────────
  else {
    const fetchLimit = limit;
    const relevantTerms = (searchTerms || []).filter((t) => !['expense', 'spend', 'spent', 'cost', 'category', 'payment'].includes(t));
    const baseMatch = { userId: userObjectId };
    if (relevantTerms.length > 0) baseMatch.category = { $regex: relevantTerms.join('|'), $options: 'i' };
    let query = Expense.find(baseMatch).sort({ date: -1 });
    if (fetchLimit) query = query.limit(fetchLimit);
    const expList = await query.lean();
    chartType = expList.length <= 5 ? (suggestedChartType || 'bar') : 'table';
    chartTitle = chartTitle || (relevantTerms.length > 0 ? `Expenses matching "${relevantTerms.join(', ')}"` : `Last ${expList.length} Expense Entries`);
    xAxisKey = 'category';
    yAxisKey = 'amount';
    data = expList.map((e) => ({ category: e.category, amount: e.amount, date: new Date(e.date).toLocaleDateString() }));
    const total = data.reduce((acc, e) => acc + e.amount, 0);
    if (!explanation) {
      explanation = data.length > 0
        ? (relevantTerms.length > 0 ? `Found ${data.length} expense(s) matching "${relevantTerms.join(', ')}". Total: ₹${total.toLocaleString()}.` : `Here are your last ${data.length} expense record(s). Total: ₹${total.toLocaleString()}.`)
        : (relevantTerms.length > 0 ? `No expenses found matching "${relevantTerms.join(', ')}". Try a broader keyword.` : 'No expense records found yet.');
    }
    summaryMetrics = { totalAmount: total, count: data.length };
    generatedQuery = `Expense.find({category: /${relevantTerms.join('|') || '*'}/i}).limit(${fetchLimit || 'all'})`;
  }

  return { chartType, chartTitle, xAxisKey, yAxisKey, data, summaryMetrics, explanation, generatedQuery };
}

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

exports.categorizeExpense = async (req, res) => {
  const { description, amount } = req.body;
  if (!description) return res.status(400).json({ message: 'Description is required' });
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${ML_SERVICE_URL}/categorize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount: Number(amount) || 0 }), signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) return res.json(await response.json());
  } catch (_) {}
  return res.json(fallbackCategorize(description));
};

exports.detectAnomaly = async (req, res) => {
  const { amount, history = [], category } = req.body;
  if (amount === undefined) return res.status(400).json({ message: 'Amount is required' });
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${ML_SERVICE_URL}/anomaly`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), history: Array.isArray(history) ? history : [], category: category || '' }), signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) return res.json(await response.json());
  } catch (_) {}
  const numAmount = Number(amount);
  const numHistory = (Array.isArray(history) ? history : []).map(Number).filter((n) => !isNaN(n));
  if (numHistory.length === 0) return res.json({ isAnomaly: false, anomalyReason: 'Insufficient historical data', zScore: 0, pctAboveMean: 0 });
  const mean = numHistory.reduce((a, b) => a + b, 0) / numHistory.length;
  const variance = numHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numHistory.length;
  const stdDev = Math.sqrt(variance) || 1;
  const zScore = (numAmount - mean) / stdDev;
  const pctAboveMean = mean > 0 ? Math.round(((numAmount - mean) / mean) * 100) : 0;
  const isAnomaly = zScore > 2.2 || (mean > 0 && numAmount > mean * 2.5);
  return res.json({
    isAnomaly,
    anomalyReason: isAnomaly ? `Transaction of ₹${numAmount.toLocaleString()} is ${pctAboveMean}% above your average${category ? ` in ${category}` : ''}` : 'Normal spending pattern',
    zScore: Number(zScore.toFixed(2)), pctAboveMean,
  });
};

/**
 * Main AI Copilot endpoint:
 * 1. Check per-user daily quota
 * 2. Try Gemini for intent parsing (with fallback to rule-based)
 * 3. Execute MongoDB query based on parsed intent
 * 4. Return chart data + quota info
 */
exports.textToQuery = async (req, res) => {
  const { question, chatHistory = [] } = req.body;
  const userIdStr = req.user?._id ? req.user._id.toString() : req.user?.id;

  if (!question) return res.status(400).json({ message: 'Question is required' });

  try {
    const userObjectId = new Types.ObjectId(userIdStr);
    QuerySanitizer.sanitizeAndInjectUserContext(question, userIdStr);

    // ── Step 1: Check + consume daily quota ──
    const quotaResult = await checkAndIncrementQuota(userObjectId);
    if (!quotaResult.allowed) {
      return res.status(429).json({
        message: `You've used all ${AI_DAILY_QUOTA} AI queries for today. Your quota resets at midnight UTC.`,
        quotaExceeded: true,
        queriesUsedToday: AI_DAILY_QUOTA,
        queriesRemaining: 0,
        dailyLimit: AI_DAILY_QUOTA,
      });
    }

    // ── Step 2: Try Gemini intent parsing, fall back to rule-based ──
    let parsedIntent = await geminiService.analyzeQuery(question, chatHistory, userObjectId);
    const usedGemini = parsedIntent !== null;

    if (!parsedIntent) {
      // Rule-based fallback
      parsedIntent = resolveContextFallback(question, chatHistory);
    }

    // ── Step 3: Execute the MongoDB query based on parsed intent ──
    const result = await executeIntent(parsedIntent, userObjectId, userIdStr);

    return res.json({
      ...result,
      engine: usedGemini ? 'gemini-3.6-flash' : 'rule-based-fallback',
      queriesUsedToday: quotaResult.used,
      queriesRemaining: quotaResult.remaining,
      dailyLimit: AI_DAILY_QUOTA,
    });
  } catch (error) {
    console.error('[AI Query Error]:', error);
    return res.status(500).json({
      explanation: `Unable to process query: ${error.message}`,
      generatedQuery: '', chartType: 'metric_card', chartTitle: 'Error',
      xAxisKey: '', yAxisKey: '', data: [], summaryMetrics: {},
    });
  }
};

exports.getAIHealth = async (req, res) => {
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`);
    return res.json({ ...(await response.json()), geminiEnabled: hasGemini });
  } catch (_) {
    return res.json({ status: 'online', engine: hasGemini ? 'gemini-3.6-flash' : 'rule-based-fallback', mlServiceUrl: ML_SERVICE_URL, geminiEnabled: hasGemini });
  }
};
