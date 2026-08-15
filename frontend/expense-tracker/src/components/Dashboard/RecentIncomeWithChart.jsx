import React, { useEffect, useState } from 'react'
import CustomPieChart from '../Charts/CustomPieChart'

const COLORS = ["#10b981", "#34d399", "#6ee7b7", "#059669", "#047857"]

const RecentIncomeWithChart = ({ data = [], totalIncome = 0 }) => {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!data || data.length === 0) {
      setChartData([]);
      return;
    }

    // Group income records by source to sum total per source and eliminate key duplicates
    const sourceMap = {};
    data.forEach((item) => {
      const source = item?.source || 'Other';
      const amount = Number(item?.amount) || 0;
      sourceMap[source] = (sourceMap[source] || 0) + amount;
    });

    const dataArr = Object.keys(sourceMap).map((source) => ({
      name: source,
      amount: sourceMap[source],
    }));

    setChartData(dataArr);
  }, [data]);

  const hasData = chartData.length > 0 && chartData.some((item) => item.amount > 0);

  return (
    <div className='card min-h-[400px] flex flex-col justify-between'>
      <div className='flex items-center justify-between mb-2'>
        <h5 className='text-lg font-semibold text-foreground'>Last 60 Days Income</h5>
        <span className='text-xs text-muted-foreground font-medium'>
          {chartData.length} {chartData.length === 1 ? 'Source' : 'Sources'}
        </span>
      </div>

      {hasData ? (
        <div className="w-full flex-1">
          <CustomPieChart
            data={chartData}
            label="Total Income"
            totalAmount={`₹${Number(totalIncome || 0).toLocaleString()}`}
            showTextAnchor
            colors={COLORS}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-between justify-center mb-3 text-emerald-400 font-bold text-xl">
            ₹
          </div>
          <p className="text-sm font-medium text-foreground">No Income Recorded Yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Add income transactions in the Income tab to see your source breakdown chart here.
          </p>
        </div>
      )}
    </div>
  )
}

export default RecentIncomeWithChart