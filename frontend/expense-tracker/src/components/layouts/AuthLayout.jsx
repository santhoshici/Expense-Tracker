import React from 'react'
import { LuTrendingUp, LuTrendingUpDown } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';

const AuthLayout = ({ children }) => {
    const navigate = useNavigate();

    return <div className="flex bg-background h-screen transition-colors duration-200 overflow-hidden">
        <div className='w-full md:w-[60vw] px-12 py-10 overflow-y-auto flex flex-col'>
            <div
                className="flex items-center gap-2 cursor-pointer w-fit mb-12"
                onClick={() => navigate("/")}
            >
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <LuTrendingUp size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight text-foreground">ExpenseFlow</span>
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-[480px] mx-auto w-full pb-20">
                {children}
            </div>
        </div>

        <div className='hidden md:block w-[40vw] h-screen bg-card bg-auth-bg-img bg-cover bg-no-repeat bg-center overflow-hidden p-8 relative'>
            <div className="w-48 h-48 rounded-[40px] bg-secondary absolute -top-10 -right-10 opacity-20" />
            <div className="w-48 h-56 rounded-[40px] border-[20px] border-accent absolute top-[30%] -right-10 opacity-20" />
            <div className="w-48 h-48 rounded-[40px] bg-primary absolute -bottom-10 -left-10 opacity-20" />

            <div className="grid grid-cols-1 z-20 h-full items-center">
                <StatusInfoCard
                    icon={<LuTrendingUpDown />}
                    title="Track Income and Expenses"
                    value="2,00,000"
                    color="bg-primary"
                />
            </div>
        </div>
    </div>;
};

export default AuthLayout;

const StatusInfoCard = ({ icon, title, value, color }) => {
    return <div className="flex gap-6 bg-card p-4 rounded-xl shadow-md shadow-primary/10 border border-border z-10">
        <div className={`w-12 h-12 flex items-center justify-center text-[26px] text-primary-foreground ${color} rounded-full drop-shadow-xl`}
        >
            {icon}
        </div>
        <div>
            <h6 className="text-xs text-muted-foreground mb-1">{title}</h6>
            <span className="text-[20px] text-foreground font-medium">₹{value}</span>
        </div>
    </div>
}