import React from 'react'
import CustomPieChart from '../Charts/CustomPieChart';

const COLORS = ["#6366f1", "#ef4444", "#10b981"];

const FinanceOverview = ({ totalBalance = 0, totalIncome = 0, totalExpense = 0 }) => {
  const balanceData = [
    { name: "Total Balance", amount: Math.max(0, Number(totalBalance) || 0) },
    { name: "Total Expense", amount: Number(totalExpense) || 0 },
    { name: "Total Income", amount: Number(totalIncome) || 0 },
  ].filter((item) => item.amount > 0);

  const hasData = balanceData.length > 0;

  return (
    <div className='card min-h-[400px] flex flex-col justify-between'>
      <div className='flex items-center justify-between mb-2'>
        <h5 className='text-lg font-semibold text-foreground'>Financial Overview</h5>
      </div>

      {hasData ? (
        <div className="w-full flex-1">
          <CustomPieChart
            data={balanceData}
            label="Total Balance"
            totalAmount={`₹${Number(totalBalance || 0).toLocaleString()}`}
            colors={COLORS}
            showTextAnchor
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <p className="text-sm font-medium text-foreground">No Financial Overview Available</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Add income and expense transactions to visualize your overall balance breakdown.
          </p>
        </div>
      )}
    </div>
  )
}

export default FinanceOverview