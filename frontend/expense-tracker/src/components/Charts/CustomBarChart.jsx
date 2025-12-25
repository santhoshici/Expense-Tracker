import React from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from "recharts";

const CustomBarChart = ({ data, primaryColor = "#ef4444", secondaryColor = "#fca5a5" }) => {
    const getBarColor = (index) => {
        return index % 2 === 0 ? primaryColor : secondaryColor;
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className='bg-card shadow-md rounded-lg p-2 border border-border'>
                    <p className='text-xs font-semibold text-primary mb-1'>{payload[0].payload.category}</p>
                    <p className='text-sm text-foreground'>
                        <span className='text-sm font-medium'>${payload[0].payload.amount}</span>
                    </p>
                </div>
            );
        }
        return null;
    };


    return (
        <div className='mt-6'>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid stroke="none" />

                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
                    <YAxis tick={{ fontSize: 12, fill: "#555" }} stroke="none" />

                    <Tooltip
                        content={CustomTooltip}
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                    />

                    <Bar
                        dataKey="amount"
                        fill="#FF8042"
                        radius={[10, 10, 0, 0]}
                        activeDot={{ r: 8, fill: "yellow" }}
                        activeStyle={{ fill: "green" }}
                    >
                        {data.map((entry, index) => (
                            <Cell key={index} fill={getBarColor(index)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export default CustomBarChart