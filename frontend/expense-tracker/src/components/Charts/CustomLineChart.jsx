import React from 'react'
import {
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Area,
    AreaChart
} from "recharts"

const CustomLineChart = ({ data, primaryColor = "#ef4444", secondaryColor = "#fca5a5" }) => {

    const CustomToolTip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className='bg-card shadow-md rounded-lg p-2 border border-border'>
                    <p className='text-xs font-semibold text-primary mb-1'>{payload[0].payload.category}</p>
                    <p className='text-sm text-foreground'>
                        Amount: <span className='text-sm font-medium'>${payload[0].payload.amount}</span>
                    </p>
                </div>
            );
        }
        return null;
    }
    return <div className=''>
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                </defs>

                <CartesianGrid stroke="none" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
                <YAxis tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
                <Tooltip content={<CustomToolTip />} />

                <Area type="monotone" dataKey="amount" stroke={primaryColor} fill="url(#chartGradient)" strokeWidth={3} dot={{ r: 3, fill: secondaryColor }} />

            </AreaChart>
        </ResponsiveContainer>
    </div>
};

export default CustomLineChart