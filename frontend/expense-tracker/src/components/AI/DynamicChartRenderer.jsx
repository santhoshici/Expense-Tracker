import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const DynamicChartRenderer = ({
  chartType = 'bar',
  data = [],
  xAxisKey = 'category',
  yAxisKey = 'amount',
  chartTitle = 'Financial Analytics',
  summaryMetrics = {}
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme-aware chart colors (recharts needs raw hex, not CSS vars)
  const chartColors = {
    grid: isDark ? '#334155' : '#cbd5e1',
    axis: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipText: isDark ? '#f1f5f9' : '#0a0f0d',
  };

  const tooltipStyle = {
    backgroundColor: chartColors.tooltipBg,
    borderColor: chartColors.tooltipBorder,
    borderRadius: '8px',
    color: chartColors.tooltipText,
    border: `1px solid ${chartColors.tooltipBorder}`,
  };

  const formatValue = (val) => (typeof val === 'number' ? `₹${val.toLocaleString()}` : val);

  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground bg-muted/60 rounded-xl border border-border">
        <p className="text-sm font-medium">No analytical data returned for this query.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-card p-5 rounded-2xl border border-border shadow-xl backdrop-blur-md my-3">
      {chartTitle && (
        <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
          <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            {chartTitle}
          </h4>
          {summaryMetrics.totalAmount !== undefined && (
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Total: ₹{Number(summaryMetrics.totalAmount).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {chartType === 'metric_card' && (
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
          <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium uppercase tracking-wider">Summary Result</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-1">
            {formatValue(data[0]?.[yAxisKey] || summaryMetrics.totalAmount || 0)}
          </p>
        </div>
      )}

      {chartType === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-card-foreground">
            <thead className="bg-muted text-muted-foreground uppercase font-semibold text-[10px]">
              <tr>
                {Object.keys(data[0] || {}).map((col) => (
                  <th key={col} className="px-3 py-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/60 transition-colors">
                  {Object.entries(row).map(([k, val], cIdx) => (
                    <td key={cIdx} className="px-3 py-2">
                      {typeof val === 'number' ? `₹${val.toLocaleString()}` : String(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(chartType === 'bar' || chartType === 'line' || chartType === 'pie') && (
        <div className="h-60 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {(() => {
              switch (chartType) {
                case 'bar':
                  return (
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.5} />
                      <XAxis dataKey={xAxisKey} stroke={chartColors.axis} tick={{ fontSize: 11 }} />
                      <YAxis stroke={chartColors.axis} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [formatValue(val), name]}
                      />
                      <Bar dataKey={yAxisKey} fill="#6366f1" radius={[6, 6, 0, 0]}>
                        {data.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  );

                case 'line':
                  return (
                    <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.5} />
                      <XAxis dataKey={xAxisKey} stroke={chartColors.axis} tick={{ fontSize: 11 }} />
                      <YAxis stroke={chartColors.axis} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [formatValue(val), name]}
                      />
                      <Line type="monotone" dataKey={yAxisKey} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  );

                case 'pie':
                  return (
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey={yAxisKey}
                        nameKey={xAxisKey}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={3}
                      >
                        {data.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [formatValue(val), name]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', color: chartColors.axis }}
                        formatter={(value) => <span style={{ color: chartColors.axis }}>{value}</span>}
                      />
                    </PieChart>
                  );

                default:
                  return null;
              }
            })()}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DynamicChartRenderer;
