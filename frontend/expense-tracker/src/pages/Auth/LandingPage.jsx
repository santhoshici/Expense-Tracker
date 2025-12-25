import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuTrendingUp, LuChartPie, LuShieldCheck, LuZap, LuSun, LuMoon } from 'react-icons/lu';
import { useTheme } from '../../context/ThemeContext';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';

const LandingPage = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const isAuthenticated = !!localStorage.getItem("token");
    const [userCount, setUserCount] = useState(0);

    useEffect(() => {
        const fetchUserCount = async () => {
            try {
                const response = await axiosInstance.get(API_PATHS.AUTH.GET_USERS_COUNT);
                setUserCount(response.data.count);
            } catch (error) {
                console.error("Error fetching user count:", error);
            }
        };
        fetchUserCount();
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {/* Navbar */}
            <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <LuTrendingUp size={24} />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">ExpenseFlow</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl hover:bg-muted text-foreground transition-all active:scale-95 border border-transparent hover:border-border"
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? <LuSun size={20} /> : <LuMoon size={20} />}
                    </button>
                    <button
                        onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        {isAuthenticated ? 'Dashboard' : 'Login'}
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-8 pt-20 pb-32">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            Trusted by {userCount > 0 ? `${userCount.toLocaleString()}+` : "our growing community of"} users worldwide
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-6 duration-1000">
                            Master Your Money with <span className="text-primary">Precision.</span>
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                            Take control of your financial destiny. Track expenses, monitor income, and visualize your wealth growth with our intuitive, premium dashboard.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                            <button
                                onClick={() => navigate('/signup')}
                                className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg hover:bg-primary/90 transition-all shadow-xl shadow-primary/30 active:scale-95"
                            >
                                Get Started Free
                            </button>
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in duration-1000 delay-300">
                        {/* Decorative background blobs */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50"></div>
                        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl opacity-50"></div>

                        <div className="relative bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-sm">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-border pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-primary">
                                            <LuChartPie size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold">Total Expenses</p>
                                            <p className="text-xs text-muted-foreground">March 2024</p>
                                        </div>
                                    </div>
                                    <span className="text-xl font-black text-expense">₹42,850.00</span>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { label: 'Cloud Services', amount: '₹12,400', color: 'bg-primary' },
                                        { label: 'Office Supplies', amount: '₹3,250', color: 'bg-accent' },
                                        { label: 'Travel Expenses', amount: '₹27,200', color: 'bg-muted' }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                                                <span className="text-sm font-medium">{item.label}</span>
                                            </div>
                                            <span className="text-sm font-bold">{item.amount}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40">
                    {[
                        {
                            icon: <LuZap className="text-primary" />,
                            title: "Lightning Fast",
                            desc: "Quickly log transactions on the go with our streamlined entry system."
                        },
                        {
                            icon: <LuChartPie className="text-accent" />,
                            title: "Rich Analytics",
                            desc: "Understand your spending patterns with beautiful, interactive visualizations."
                        },
                        {
                            icon: <LuShieldCheck className="text-primary" />,
                            title: "Privacy First",
                            desc: "Your financial data is encrypted and secure. Your privacy is our priority."
                        }
                    ].map((feature, i) => (
                        <div key={i} className="bg-card/50 border border-border p-8 rounded-[2rem] hover:border-primary/50 transition-all duration-300">
                            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-6 text-2xl">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {feature.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-border mt-32 py-12 px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col gap-4 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                                <LuTrendingUp size={20} />
                            </div>
                            <span className="font-bold text-xl">ExpenseFlow</span>
                        </div>
                        <p className="text-muted-foreground text-sm max-w-xs">
                            Master your money with precision. Built with ❤️ by Santhosh.
                        </p>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-4">
                        <h4 className="font-bold text-lg">Want to connect?</h4>
                        <div className="flex gap-4">
                            <a
                                href="https://github.com/santhoshici"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-muted hover:bg-primary hover:text-white p-3 rounded-xl transition-all duration-300"
                                title="GitHub"
                            >
                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                            </a>
                            <a
                                href="https://linkedin.com/in/santhoshici"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-muted hover:bg-primary hover:text-white p-3 rounded-xl transition-all duration-300"
                                title="LinkedIn"
                            >
                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <p>© 2024 ExpenseFlow. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
