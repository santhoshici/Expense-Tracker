import React from 'react'

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className='bg-card shadow-md rounded-lg p-2 border border-border'>
                <p className='text-xs font-semibold text-primary mb-1'>
                    {payload[0].name}
                </p>
                <p className='text-sm text-foreground'>
                    Amount:{" "}
                    <span className='text-sm font-medium text-foreground'>
                        ₹{payload[0].value}
                    </span>
                </p>
            </div>
        )
    }
    return null;
}

export default CustomTooltip