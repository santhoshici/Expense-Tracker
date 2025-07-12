const xlsx = require("xlsx");
const Expense = require("../models/Expense");

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

        await newExpense.save();
        res.status(200).json(newExpense);
    } catch (err){
        res.status(500).json({ message: "Server error"});
    }
}

//Get All Expenses
exports.getAllExpense = async (req, res) => {
    const userId = req.user._id;

    try {
        const expense = await Expense.find({userId}).sort({date: -1});
        res.json(expense);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}

//Delete Expense category
exports.deleteExpense = async (req, res) => {
    try{
        await Expense.findByIdAndDelete(req.params.id);
        res.json({ message: "Expense category deleted successfully" });  
    }catch (err) { 
        res.status(500).json({ message: "Server error" });
    }
}

//Download Expenses as Excel
exports.downloadExpenseExcel = async (req, res) => {
    const UserId = req.user._id;
    try{
        const expense = await Expense.find({UserId}).sort({date: -1});

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
        res.status(500).json({ message: "Server error" });  
    }
}