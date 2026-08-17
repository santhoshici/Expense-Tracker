const xlsx = require("xlsx");
const Expense = require("../models/Expense");

// ─────────────────────────────────────────────────────────────
// SELF-CONTAINED ANOMALY HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the user's last 90 days of expenses in the same category (capped at 200)
 * and decide whether the given amount is anomalous versus that history.
 * Returns { isAnomaly, anomalyReason }. Never throws.
 */
async function checkAnomalyForExpense(userId, category, amount) {
    try {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const history = await Expense.find({ userId, category, date: { $gte: since } })
            .select("amount")
            .limit(200)
            .lean();

        const amounts = history.map((h) => Number(h.amount)).filter((n) => !isNaN(n));

        // Need at least 4 historical points to establish a baseline.
        if (amounts.length < 4) {
            return { isAnomaly: false, anomalyReason: "" };
        }

        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (amounts.length - 1);
        const stdDev = Math.sqrt(variance) || 1;
        const zScore = (Number(amount) - mean) / stdDev;

        const sorted = [...amounts].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];

        const isAnomaly = zScore > 2.5 || (median > 0 && Number(amount) > 3 * median);

        if (!isAnomaly) {
            return { isAnomaly: false, anomalyReason: "" };
        }

        const pct = mean > 0 ? Math.round(((Number(amount) - mean) / mean) * 100) : 0;
        return {
            isAnomaly: true,
            anomalyReason: `${pct}% higher than your average spend in ${category}`,
        };
    } catch (err) {
        console.error("[Expense Error] Anomaly check failed:", err);
        return { isAnomaly: false, anomalyReason: "" };
    }
}

//Add Expense category
exports.addExpense = async (req, res) => {
    const userId = req.user._id;

    try{
        const { icon, category, amount, date } = req.body;

        if (!category || !amount || !date) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const newExpense = new Expense({
            userId,
            icon,
            category,
            amount,
            date: new Date(date)
        });

        // Run anomaly detection against the user's recent category history.
        // Guard so a failed check never blocks the save.
        try {
            const { isAnomaly, anomalyReason } = await checkAnomalyForExpense(userId, category, amount);
            newExpense.isAnomaly = isAnomaly;
            newExpense.anomalyReason = anomalyReason;
            newExpense.anomalyCheckedAt = new Date();
        } catch (anomalyErr) {
            console.error("[Expense Error] Anomaly check skipped:", anomalyErr);
            newExpense.isAnomaly = false;
            newExpense.anomalyReason = "";
            newExpense.anomalyCheckedAt = new Date();
        }

        await newExpense.save();
        res.status(200).json(newExpense);
    } catch (err){
        console.error("[Expense Error] Add expense failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

//Get All Expenses
exports.getAllExpense = async (req, res) => {
    const userId = req.user._id;

    try {
        const expense = await Expense.find({userId}).sort({date: -1});
        res.json(expense);
    } catch (err) {
        console.error("[Expense Error] Get all expense failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

//Delete Expense category
exports.deleteExpense = async (req, res) => {
    try{
        await Expense.findByIdAndDelete(req.params.id);
        res.json({ message: "Expense category deleted successfully" });  
    }catch (err) { 
        console.error("[Expense Error] Delete expense failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

//Download Expenses as Excel
exports.downloadExpenseExcel = async (req, res) => {
    const userId = req.user._id;
    try{
        const expense = await Expense.find({userId}).sort({date: -1});

        //Preparing data for excel
        const data = expense.map((item) => ({
            Category: item.category,
            Amount: item.amount,
            Date: item.date
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Expense");
        xlsx.writeFile(wb, "expense_details.xlsx");
        res.download("expense_details.xlsx");
    }catch (err) {
        console.error("[Expense Error] Download expense excel failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });  
    }
}
