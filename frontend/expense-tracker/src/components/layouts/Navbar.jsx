import React, { useState } from 'react'
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { LuSun, LuMoon, LuTrendingUp } from 'react-icons/lu';
import { useTheme } from '../../context/ThemeContext';
import SideMenu from './SideMenu';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ activeMenu }) => {
    const [openSideMenu, setOpenSideMenu] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    return (
        <div className="flex justify-between items-center gap-5 bg-card border-b border-border backdrop-blur-[2px] py-4 px-7 sticky top-0 z-30 transition-colors duration-200">
            <div className="flex items-center gap-2">
                <button
                    className='block lg:hidden text-foreground'
                    onClick={() => {
                        setOpenSideMenu(!openSideMenu);
                    }}
                >
                    {openSideMenu ? (
                        <HiOutlineX className="text-2xl" />
                    ) : (
                        <HiOutlineMenu className="text-2xl" />
                    )}

                </button>

                <div
                    className="flex items-center gap-2 cursor-pointer ml-1"
                    onClick={() => navigate("/")}
                >
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <LuTrendingUp size={18} />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-foreground">ExpenseFlow</span>
                </div>
            </div>

            <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-muted text-foreground transition-colors"
            >
                {theme === 'dark' ? <LuSun className="text-xl" /> : <LuMoon className="text-xl" />}
            </button>

            {openSideMenu && (
                <div className="fixed top-[61px] -ml-4 bg-card w-full h-[calc(100vh-61px)] border-t border-border">
                    <SideMenu activeMenu={activeMenu} />
                </div>
            )}
        </div>
    )
}

export default Navbar