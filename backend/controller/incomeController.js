const xlsx = require("xlsx");
const Income = require("../models/Income");

//Add Income Source
exports.addIncome = async (req, res) => {
    const userId = req.user._id;

    try{
        const { icon, source, amount, date } = req.body;

        if (!source || !amount || !date) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const newIncome = new Income({
            userId,
            icon,
            source,
            amount,
            date: new Date(date)
        });

        await newIncome.save();
        res.status(200).json(newIncome);
    } catch (err){
        console.error("[Income Error] Add income failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

//Get All Income Sources
exports.getAllIncome = async (req, res) => {
    const userId = req.user._id;

    try {
        const income = await Income.find({userId}).sort({date: -1});
        res.json(income);
    } catch (err) {
        console.error("[Income Error] Get all income failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

//Delete Income Source
exports.deleteIncome = async (req, res) => {
    try{
        await Income.findByIdAndDelete(req.params.id);
        res.json({ message: "Income source deleted successfully" });  
    }catch (err) { 
        console.error("[Income Error] Delete income failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

//Download Income Sources as Excel
exports.downloadIncomeExcel = async (req, res) => {
    const userId = req.user._id;
    try{
        const income = await Income.find({userId}).sort({date: -1});

        //Preparing data for excel
        const data = income.map((item) => ({
            Source: item.source,
            Amount: item.amount,
            Date: item.date
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Income");
        xlsx.writeFile(wb, "income_details.xlsx");
        res.download("income_details.xlsx");
    }catch (err) {
        console.error("[Income Error] Download income excel failed:", err);
        res.status(500).json({ message: "Server error", error: err.message });  
    }
}