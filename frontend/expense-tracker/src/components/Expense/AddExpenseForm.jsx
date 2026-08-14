import React, { useState, useEffect } from 'react'
import EmojiPickerPopup from '../EmojiPickerPopup';
import Input from '../Inputs/Input';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';

const AddExpenseForm = ({ onAddExpense }) => {
    const [expense, setExpense] = useState({
        category: "",
        amount: "",
        date: "",
        icon: "",
    });

    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [isCategorizing, setIsCategorizing] = useState(false);

    const handleChange = (key, value) => setExpense((prev) => ({ ...prev, [key]: value }));

    // AI Categorization lookup with debounce
    useEffect(() => {
        const query = expense.category.trim();
        if (query.length < 3) {
            setAiSuggestion(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsCategorizing(true);
            try {
                const response = await axiosInstance.post(API_PATHS.AI.CATEGORIZE, {
                    description: query,
                    amount: Number(expense.amount) || 0,
                });
                if (response.data && response.data.suggested && response.data.category !== "Uncategorized / Review Required") {
                    setAiSuggestion(response.data);
                } else {
                    setAiSuggestion(null);
                }
            } catch (err) {
                setAiSuggestion(null);
            } finally {
                setIsCategorizing(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [expense.category, expense.amount]);

    const applyAiSuggestion = () => {
        if (aiSuggestion) {
            handleChange("category", aiSuggestion.category);
            setAiSuggestion(null);
        }
    };

    return (
        <div>
            <EmojiPickerPopup
                icon={expense.icon}
                onSelect={(selectedIcon) => handleChange("icon", selectedIcon)}
            />

            <div>
                <Input
                    value={expense.category}
                    onChange={({ target }) => handleChange("category", target.value)}
                    label="Category / Description"
                    placeholder="Groceries, Swiggy, Uber, Rent..."
                    type="text"
                />

                {isCategorizing && (
                    <p className="text-xs text-purple-400 mt-1 animate-pulse">✨ AI classifying...</p>
                )}

                {aiSuggestion && (
                    <div className="mt-2 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                        <span className="text-xs text-purple-300 font-medium">
                            ✨ AI Suggestion: <strong className="text-purple-100">{aiSuggestion.category}</strong> ({Math.round(aiSuggestion.confidence * 100)}% match)
                        </span>
                        <button
                            type="button"
                            onClick={applyAiSuggestion}
                            className="text-xs px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>

            <Input
                value={expense.amount}
                onChange={({ target }) => handleChange("amount", target.value)}
                label="Amount"
                placeholder="0.00"
                type="number"
            />
            <Input
                value={expense.date}
                onChange={({ target }) => handleChange("date", target.value)}
                label="Date"
                placeholder=""
                type="date"
            />

            <div className="flex justify-end mt-6">
                <button
                    type="button"
                    className="add-btn-expense add-btn-expense-fill"
                    onClick={() => onAddExpense(expense)}
                >
                    Add Expense
                </button>
            </div>
        </div>
    );
};

export default AddExpenseForm;