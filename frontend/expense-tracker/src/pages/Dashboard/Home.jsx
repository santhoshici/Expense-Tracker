import React, { useEffect, useState } from 'react'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import { useUserAuth } from '../../hooks/useUserAuth';
import { useNavigate } from 'react-router-dom';
import { API_PATHS } from '../../utils/apiPaths';
import axiosInstance from '../../utils/axiosInstance';
import InfoCard from '../../components/Cards/InfoCard';
import { SkeletonCard } from '../../utils/skeleton';
import { cacheGet, cacheSet } from '../../utils/offlineCache';
import { useUIStore, uiStore } from '../../store/useUIStore';

import { LuHandCoins, LuWalletMinimal, LuTriangleAlert, LuX } from 'react-icons/lu';
import { IoMdCard } from "react-icons/io"
import { addSeperator } from '../../utils/helper';
import RecentTransactions from '../../components/Dashboard/RecentTransactions';
import FinanceOverview from '../../components/Dashboard/FinanceOverview';
import ExpenseTransactions from '../../components/Dashboard/ExpenseTransactions';
import Last30DaysExpenses from '../../components/Dashboard/Last30DaysExpenses';
import RecentIncomeWithChart from '../../components/Dashboard/RecentIncomeWithChart';
import RecentIncome from '../../components/Dashboard/RecentIncome';

const Home = () => {
  const { user } = useUserAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(() => cacheGet('dashboard_data') || null);
  const [loading, setLoading] = useState(!dashboardData);
  const [anomalyAlert, setAnomalyAlert] = useState(null);

  const anomalyBannerDismissed = useUIStore((state) => state.anomalyBannerDismissed);

  const fetchDashboardData = async () => {
    try {
      if (!dashboardData) setLoading(true);
      const response = await axiosInstance.get(`${API_PATHS.DASHBOARD.GET_DATA}`);

      if (response.data) {
        setDashboardData(response.data);
        cacheSet('dashboard_data', response.data, 5 * 60 * 1000); // 5 mins cache

        // Check recent transactions for spending anomalies via AI
        const recentExp = response.data?.last30DaysExpenses?.transactions || [];
        if (recentExp.length > 0) {
          const amounts = recentExp.map((t) => Number(t.amount)).filter(Boolean);
          const latestAmount = amounts[0];
          const history = amounts.slice(1);
          if (latestAmount && history.length >= 2) {
            checkAnomaly(latestAmount, history);
          }
        }
      }
    } catch (error) {
      console.log("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAnomaly = async (amount, history) => {
    try {
      const res = await axiosInstance.post(API_PATHS.AI.ANOMALY, { amount, history });
      if (res.data && res.data.isAnomaly) {
        setAnomalyAlert(res.data);
      }
    } catch (err) {
      // Ignore AI anomaly check errors silently
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const userIdStr = user?._id || 'default_user';
  const isDismissed = Boolean(anomalyBannerDismissed[userIdStr]);

  return (
    <DashboardLayout activeMenu="Dashboard">
      <div className='my-5 mx-auto'>
        {/* Anomaly Detection Banner */}
        {anomalyAlert && !isDismissed && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-200 animate-fadeIn">
            <div className="flex items-center gap-3">
              <LuTriangleAlert className="text-2xl text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-100">
                  Spending Anomaly Detected ({anomalyAlert.pctAboveMean}% higher than usual)
                </p>
                <p className="text-xs text-amber-300/80">
                  {anomalyAlert.anomalyReason || 'Recent transaction is significantly higher than your typical average.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => uiStore.getState().dismissAnomalyBanner(userIdStr)}
              className="p-1 hover:bg-amber-500/20 rounded-lg transition-colors text-amber-300"
              title="Dismiss warning"
            >
              <LuX className="text-lg" />
            </button>
          </div>
        )}

        {/* Dashboard Top Cards */}
        {loading ? (
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <InfoCard
              icon={<IoMdCard />}
              label="Total Balance"
              value={addSeperator(dashboardData?.totalBalance || 0)}
              color="bg-primary"
            />
            <InfoCard
              icon={<LuWalletMinimal />}
              label="Total Income"
              value={addSeperator(dashboardData?.totalIncome || 0)}
              color="bg-green-500"
            />
            <InfoCard
              icon={<LuHandCoins />}
              label="Total Expense"
              value={addSeperator(dashboardData?.totalExpense || 0)}
              color="bg-expense"
            />
          </div>
        )}

        {/* Overview Widgets */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 '>
          <RecentTransactions
            transactions={dashboardData?.recentTransactions}
            onSeeMore={() => navigate("/expense")}
          />
          <FinanceOverview
            totalBalance={dashboardData?.totalBalance || 0}
            totalIncome={dashboardData?.totalIncome || 0}
            totalExpense={dashboardData?.totalExpense || 0}
          />

          <ExpenseTransactions
            transactions={dashboardData?.last30DaysExpenses?.transactions || []}
            onSeeMore={() => navigate("/expense")}
          />

          <Last30DaysExpenses
            data={dashboardData?.last30DaysExpenses?.transactions || []}
          />

          <RecentIncomeWithChart
            data={dashboardData?.last60DaysIncome?.transactions?.slice(0, 4) || []}
            totalIncome={dashboardData?.totalIncome || 0}
          />

          <RecentIncome
            transactions={dashboardData?.last60DaysIncome?.transactions || []}
            onSeeMore={() => navigate("/income")}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Home;