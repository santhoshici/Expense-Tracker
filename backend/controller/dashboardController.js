const Income = require("../models/Income");
const Expense = require("../models/Expense");
const {isValidObjectId, Types} = require("mongoose");

//Dashboard Data
exports.getDashboardData = async (req, res) => {
    try{
        const userId = req.user._id;
        const userObjectId = new Types.ObjectId(String(userId));

        //Fetchign total income and expense

        const totalIncome = await Income.aggregate([
            { $match: { userId: userObjectId } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        console.log("Total Income:", totalIncome, userId, isValidObjectId(userId));

        const totalExpense = await Expense.aggregate([
            { $match: { userId: userObjectId } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        //Get income transactions in last 60 days
        const last60DaysIncomeTransactions = await Income.find({
            userId,
            date: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        }).sort({ date: -1 });

        //Get total income in last 60 days
        const last60DaysIncome = last60DaysIncomeTransactions.reduce(
            (acc, transaction) => acc + transaction.amount,
            0
        );


        //Get expense transactions in last 30 days
        const last30DaysExpenseTransactions = await Expense.find({
            userId,
            date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        }).sort({ date: -1 });

        //Get total expense in last 30 days
        const last30DaysExpense = last30DaysExpenseTransactions.reduce(
            (acc, transaction) => acc + transaction.amount,
            0
        );


        //Fetch last 5 transactions
        const last5Transactions = [
        ...(await Income.find({ userId }).sort({ date: -1 }).limit(5)).map(
            (txn) => ({
                ...txn.toObject(),
                type: 'income'
            })
        ),  
        ...(await Expense.find({ userId }).sort({ date: -1 }).limit(5)).map(
            (txn) => ({
                ...txn.toObject(),
                type: 'expense'
            })
        ),
    ].sort((a, b) => b.date - a.date);

    //Final Response
    res.json({
        totalBalance:
            (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0),
            totalIncome: totalIncome[0]?.total || 0,
            totalExpense: totalExpense[0]?.total || 0,
            last30DaysExpenses: {
                total: last30DaysExpense,
                transactions: last30DaysExpenseTransactions,
            },
            last60DaysIncome: {
                total: last60DaysIncome,
                transactions: last60DaysIncomeTransactions,
            },
            recentTransactions: last5Transactions,
        });
    } catch (err){
        console.error("Error in route:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}