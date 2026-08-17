const { GoogleGenerativeAI } = require('@google/generative-ai');
const Income = require('../../models/Income');
const Expense = require('../../models/Expense');
const { Types } = require('mongoose');

const GEMINI_MODEL = 'gemini-3.6-flash';

/**
 * Build a concise financial context summary for the user.
 * This is sent to Gemini so it understands the user's data shape.
 * We never send raw transaction details — only aggregated summaries.
 */
async function buildUserContext(userObjectId) {
  try {
    const [incomeAgg, expenseAgg, recentIncome, recentExpenses] = await Promise.all([
      Income.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      Expense.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      Income.find({ userId: userObjectId }).sort({ date: -1 }).limit(5).lean(),
      Expense.find({ userId: userObjectId }).sort({ date: -1 }).limit(5).lean(),
    ]);

    const totalIncome = incomeAgg.reduce((s, i) => s + i.total, 0);
    const totalExpenses = expenseAgg.reduce((s, e) => s + e.total, 0);

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      incomeSources: incomeAgg.map((i) => ({ source: i._id, total: i.total, count: i.count })),
      expenseCategories: expenseAgg.map((e) => ({ category: e._id, total: e.total, count: e.count })),
      recentIncomeSamples: recentIncome.map((i) => ({ source: i.source, amount: i.amount, date: i.date })),
      recentExpenseSamples: recentExpenses.map((e) => ({ category: e.category, amount: e.amount, date: e.date })),
    };
  } catch (err) {
    console.error('[GeminiService] Failed to build user context:', err.message);
    return null;
  }
}

/**
 * Build the system prompt for Gemini.
 * Instructs the model to always respond with a strict JSON object.
 */
function buildSystemPrompt(userContext) {
  const ctx = userContext
    ? `
## User's Financial Summary (live data):
- Total Income: ₹${userContext.totalIncome.toLocaleString()}
- Total Expenses: ₹${userContext.totalExpenses.toLocaleString()}
- Net Balance: ₹${userContext.netBalance.toLocaleString()}
- Income Sources: ${userContext.incomeSources.map((s) => `${s.source} (₹${s.total.toLocaleString()}, ${s.count} entries)`).join(', ') || 'None recorded'}
- Expense Categories: ${userContext.expenseCategories.map((c) => `${c.category} (₹${c.total.toLocaleString()}, ${c.count} entries)`).join(', ') || 'None recorded'}
- Recent Income: ${userContext.recentIncomeSamples.map((i) => `${i.source}: ₹${i.amount}`).join(', ') || 'None'}
- Recent Expenses: ${userContext.recentExpenseSamples.map((e) => `${e.category}: ₹${e.amount}`).join(', ') || 'None'}
`
    : '## User financial data is currently unavailable.';

  return `You are an AI Financial Data Copilot embedded in a personal expense tracker app.
Your job is to understand the user's natural language question about their finances and return a structured JSON response.

${ctx}

## Data Schema:
- Income documents have fields: source (string), amount (number), date (Date)
- Expense documents have fields: category (string), amount (number), date (Date)

## Your Task:
Analyze the user's question (and conversation history for context) and return ONLY a valid JSON object with this exact structure:
{
  "intent": "income_grouped" | "income_list" | "expense_grouped" | "expense_list" | "combined_transactions" | "overview",
  "explanation": "A clear, friendly 1-2 sentence explanation of what you found or will show. Use ₹ for currency.",
  "chartType": "bar" | "pie" | "line" | "table" | "metric_card",
  "chartTitle": "A short descriptive title for the chart",
  "xAxisKey": "The key name for the X axis (e.g. 'category', 'source', 'date', 'label', 'name')",
  "yAxisKey": "The key name for the Y axis (always 'amount')",
  "searchTerms": ["keyword1", "keyword2"],
  "limit": null or a number (e.g. 3, 5, 10),
  "dateFilter": null or "today" | "this_week" | "this_month" | "last_30_days" | "last_7_days"
}

## Rules:
- intent "income_grouped": User wants income broken down/grouped by source → pie or bar chart
- intent "income_list": User wants a list/table of individual income entries (may have limit or search filter)
- intent "expense_grouped": User wants expenses broken down by category → bar or pie chart  
- intent "expense_list": User wants a list of individual expense entries (may have limit or search filter)
- intent "combined_transactions": User says "transactions", "history", "all recent" → mixed income+expense feed
- intent "overview": User wants to compare income vs expenses, see balance, savings rate
- searchTerms: Extract keywords to filter by (e.g. ["educational", "freelance", "food"]). Empty array [] if no filter.
- limit: Extract numeric limit if user says "last 3", "top 5", "show me 2". null if unspecified.
- For grouped intents with no searchTerms, limit should be null (show all).
- NEVER add markdown fences, NEVER add comments. Return ONLY the raw JSON object.`;
}

/**
 * Main Gemini analysis function.
 * Returns parsed JSON intent from Gemini, or falls back to null so the caller
 * can use the rule-based engine.
 *
 * @param {string} question - Current user question
 * @param {Array}  chatHistory - Last N {sender, text} message pairs
 * @param {ObjectId} userObjectId - MongoDB ObjectId for the user
 * @returns {Object|null} Parsed Gemini response or null on failure/missing key
 */
async function analyzeQuery(question, chatHistory = [], userObjectId) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Skip Gemini if no key configured
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }

  try {
    // Fetch live user context for the system prompt
    const userContext = await buildUserContext(userObjectId);
    const systemInstruction = buildSystemPrompt(userContext);

    const genAI = new GoogleGenerativeAI(apiKey);
    // Pass systemInstruction as a Content object (not a raw string).
    // The SDK v0.24.x does not auto-convert a plain string to a Content
    // object, causing a 400 'Invalid value at system_instruction'.
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: { parts: [{ text: systemInstruction }] },
    });

    // Build conversation history for multi-turn awareness
    // Gemini expects alternating user/model roles
    const historyForGemini = [];
    for (const msg of chatHistory.slice(-8)) { // last 4 turns (8 messages)
      if (msg.sender === 'user') {
        historyForGemini.push({ role: 'user', parts: [{ text: msg.text }] });
      } else if (msg.sender === 'ai') {
        // Summarize AI responses to avoid sending large chart data back
        historyForGemini.push({
          role: 'model',
          parts: [{ text: msg.text }],
        });
      }
    }

    const chat = model.startChat({
      history: historyForGemini,
    });

    const result = await chat.sendMessage(question);
    const rawText = result.response.text().trim();

    // Strip markdown code fences if Gemini adds them despite instructions
    const jsonText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    const parsed = JSON.parse(jsonText);

    // Validate required fields
    if (!parsed.intent || !parsed.explanation) {
      throw new Error('Gemini response missing required fields');
    }

    return parsed;
  } catch (err) {
    console.error('[GeminiService] Analysis failed, falling back to rule-based engine:', err.message);
    return null; // Triggers fallback in controller
  }
}

module.exports = { analyzeQuery, buildUserContext };
