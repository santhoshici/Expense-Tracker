import React, { useContext } from 'react'
import { UserContext } from '../../context/UserContext';
import Navbar from './Navbar';
import SideMenu from './SideMenu';
import AnalyticsChatbot from '../AI/AnalyticsChatbot';

const DashboardLayout = ({ children, activeMenu }) => {
    const { user } = useContext(UserContext);
    return (
        <div className="bg-background min-h-screen transition-colors duration-200">
            <Navbar activeMenu={activeMenu} />

            {user && (
                <div className='flex'>
                    <div className='max-[1080px]:hidden'>
                        <SideMenu activeMenu={activeMenu} />
                    </div>

                    <div className="grow mx-5">{children}</div>
                </div>
            )}

            {user && <AnalyticsChatbot />}
        </div>
    )
}

export default DashboardLayout;