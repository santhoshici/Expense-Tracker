import React from 'react'

const InfoCard = ({ icon, label, value, color }) => {
    return <div className='flex gap-6 bg-card p-6 rounded-2xl shadow-md border border-border transition-colors duration-200'>
        <div className={`w-14 h-14 flex items-center justify-center text-[26px] text-white ${color} rounded-full drop-shadow-xl`}>
            {icon}
        </div>
        <div>
            <h6 className='text-sm text-muted-foreground mb-1'>{label}</h6>
            <span className='text-[22px] text-foreground'>{value}</span>
        </div>
    </div>
}

export default InfoCard