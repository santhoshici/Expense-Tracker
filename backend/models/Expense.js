const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId, ref:"User", required: true},
    icon: {type: String},
    category: {type: String, required: true},
    amount: {type: Number, required: true},
    date: {type: Date, default: Date.now},
    isAnomaly: { type: Boolean, default: false },
    anomalyReason: { type: String, default: '' },
    anomalyCheckedAt: { type: Date, default: null },
}, {timestamps: true});

ExpenseSchema.index({ userId: 1, isAnomaly: 1 });

module.exports = mongoose.model("Expense", ExpenseSchema);
