import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const DynamicChartRenderer = ({
  chartType = 'bar',
  data = [],
  xAxisKey = 'category',
  yAxisKey = 'amount',
  title = 'Financial Analytics',
  summaryMetrics = {}
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
        <p className="text-sm font-medium">No analytical data returned for this query.</p>
      </div>
    );
  }

  const formatValue = (val) => (typeof val === 'number' ? `₹${val.toLocaleString()}` : val);

  return (
    <div className="w-full bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md my-3">
      {title && (
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            {title}
          </h4>
          {summaryMetrics.totalAmount !== undefined && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Total: ₹{Number(summaryMetrics.totalAmount).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {chartType === 'metric_card' && (
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
          <p className="text-xs text-indigo-300 font-medium uppercase tracking-wider">Summary Result</p>
          <p className="text-2xl font-bold text-indigo-100 mt-1">
            {formatValue(data[0]?.[yAxisKey] || summaryMetrics.totalAmount || 0)}
          </p>
        </div>
      )}

      {chartType === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                {Object.keys(data[0] || {}).map((col) => (
                  <th key={col} className="px-3 py-2">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey={xAxisKey} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        formatter={(val) => [`₹${Number(val).toLocaleString()}`, yAxisKey]}
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis dataKey={xAxisKey} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        formatter={(val) => [`₹${Number(val).toLocaleString()}`, yAxisKey]}
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
                        outerRadius={75}
                        innerRadius={45}
                        paddingAngle={3}
                      >
                        {data.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                        formatter={(val) => [`₹${Number(val).toLocaleString()}`, 'Amount']}
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
