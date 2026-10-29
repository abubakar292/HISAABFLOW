import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, Package, DollarSign,
  Plus, BarChart3, Clock, Smartphone, ReceiptText, BookOpen
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { parseDateSafe, getDocDateString } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number, prefix?: string, suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 800;
    
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOut * value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, shopProfile, currentShopId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayNetProfit: 0,
    totalStock: 0,
    todaySales: 0,
    totalStockValue: 0,
    totalExpenses: 0,
  });
  const [chartData, setChartData] = useState<{ name: string, profit: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    setStats({
      todayNetProfit: 0,
      totalStock: 0,
      todaySales: 0,
      totalStockValue: 0,
      totalExpenses: 0,
    });
    setChartData([]);
    setRecentActivity([]);

    if (!user || !currentShopId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const stockQuery = collection(db, 'mobiles');
    const salesQuery = collection(db, 'sales');
    const expensesQuery = collection(db, 'expenses');

    let currentMobiles: any[] = [];
    let currentSales: any[] = [];
    let currentExpenses: any[] = [];
    let mobilesLoaded = false;
    let salesLoaded = false;
    let expensesLoaded = false;

    const recalculateDashboard = () => {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const startOfToday = startOfDay(today);
      const sevenDaysAgo = startOfDay(subDays(today, 6));

      // Stock stats
      let totalStock = 0;
      let totalStockValue = 0;
      currentMobiles.forEach(m => {
        const q = Number(m.quantity) || 0;
        if (q > 0) {
          totalStock += q;
          totalStockValue += (Number(m.basePrice) || 0) * q;
        }
      });

      // Today's Sales and Sales Profit
      let todaySales = 0;
      let todaySalesProfit = 0;

      // 7-day profit trend buckets
      const dailyData = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(today, 6 - i);
        return {
          date: d,
          name: format(d, 'EEE'),
          profit: 0
        };
      });

      const activities: any[] = [];

      currentSales.forEach(s => {
        const docDateStr = getDocDateString(s);
        const saleDate = parseDateSafe(s.saleDate || s.date || s.createdAt) || new Date();
        const isReturned = s.status === 'returned';

        activities.push({
          id: s.id,
          type: 'sale',
          desc: isReturned ? `Returned ${s.itemName || 'Mobile'}` : `Sold ${s.itemName || 'Mobile'}`,
          amount: isReturned ? -(s.sellPrice || 0) : (s.sellPrice || 0),
          isReturned,
          date: saleDate,
          icon: Smartphone,
          color: isReturned ? 'text-rose-500' : 'text-emerald-500'
        });

        if (!isReturned) {
          const isSoldToday = s.saleDate ? s.saleDate === todayStr : (docDateStr === todayStr || saleDate >= startOfToday);
          if (isSoldToday) {
            todaySales += Number(s.sellPrice) || 0;
            todaySalesProfit += Number(s.profit) || 0;
          }

          if (saleDate >= sevenDaysAgo) {
            const dayData = dailyData.find(x => isSameDay(x.date, saleDate));
            if (dayData) {
              dayData.profit += Number(s.profit) || 0;
            }
          }
        }
      });

      // Expenses stats
      let totalExpenses = 0;
      let todayExpenses = 0;
      currentExpenses.forEach(e => {
        const amt = Number(e.amount) || 0;
        totalExpenses += amt;
        const expDate = parseDateSafe(e.date) || new Date();
        if (isSameDay(expDate, today)) {
          todayExpenses += amt;
        }
      });

      // Today Net Profit = Today Sales Profit - Today Expenses
      const todayNetProfit = todaySalesProfit - todayExpenses;

      setStats({
        todayNetProfit,
        totalStock,
        todaySales,
        totalStockValue,
        totalExpenses,
      });

      setChartData(dailyData.map(d => ({ name: d.name, profit: d.profit })));

      activities.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentActivity(activities.slice(0, 5));

      if (mobilesLoaded && salesLoaded && expensesLoaded) {
        setLoading(false);
      }
    };

    const unsubStock = onSnapshot(stockQuery, (snapshot) => {
      currentMobiles = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => isDocForShop(m, currentShopId));
      mobilesLoaded = true;
      recalculateDashboard();
    }, (err) => {
      console.warn('Dashboard stock listener notice:', err.message);
      mobilesLoaded = true;
      setLoading(false);
    });

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      currentSales = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => isDocForShop(s, currentShopId));
      salesLoaded = true;
      recalculateDashboard();
    }, (err) => {
      console.warn('Dashboard sales listener notice:', err.message);
      salesLoaded = true;
      setLoading(false);
    });

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      currentExpenses = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => isDocForShop(e, currentShopId));
      expensesLoaded = true;
      recalculateDashboard();
    }, (err) => {
      console.warn('Dashboard expenses listener notice:', err.message);
      expensesLoaded = true;
    });

    return () => {
      unsubStock();
      unsubSales();
      unsubExpenses();
    };
  }, [user, currentShopId]);

  const formatTimeAgo = (date: Date) => {
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const hasChartData = chartData.some(d => d.profit !== 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Overview</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {shopProfile?.shopName ? `${shopProfile.shopName} — ` : ''}Real-time business performance.
          </p>
        </div>

        {/* Quick Launch Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/purchase-mobile')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#522D60] text-white hover:bg-[#42244D] transition-all active:scale-95 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { 
            label: "Today's Net Profit", 
            value: stats.todayNetProfit, 
            prefix: 'Rs. ', 
            icon: TrendingUp, 
            color: 'bg-[#522D60]',
            note: 'Sales Profit − Expenses'
          },
          { 
            label: 'Total Stock Available', 
            value: stats.totalStock, 
            icon: Package, 
            color: 'bg-[#522D60]',
            note: 'Units in Shop'
          },
          { 
            label: "Today's Gross Sales", 
            value: stats.todaySales, 
            prefix: 'Rs. ', 
            icon: DollarSign, 
            color: 'bg-emerald-600',
            note: 'Cash & Credit'
          },
          { 
            label: 'Inventory Valuation', 
            value: stats.totalStockValue, 
            prefix: 'Rs. ', 
            icon: BarChart3, 
            color: 'bg-gray-800',
            note: 'Cost value of stock'
          }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="bg-white rounded-2xl p-4 sm:p-5 shadow-card border border-gray-100 relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white ${stat.color} shadow-xs`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            
            <div>
              <h3 className="text-gray-400 text-xs font-semibold">{stat.label}</h3>
              <p className="text-lg sm:text-xl font-black text-gray-900 mt-0.5">
                <AnimatedCounter value={stat.value} prefix={stat.prefix} />
              </p>
              {stat.note && (
                <p className="text-[10px] text-gray-400 mt-1 uppercase font-medium">{stat.note}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-card border border-gray-100"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-gray-900">7-Day Profit Trend</h2>
          </div>
          
          <div className="h-[220px] sm:h-[260px] w-full flex items-center justify-center relative">
            {!hasChartData && !loading ? (
              <div className="text-center text-gray-400 flex flex-col items-center">
                <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">No sales recorded this week</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#522D60" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#522D60" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `Rs.${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#23122A', borderRadius: '12px', border: 'none', color: 'white' }}
                    itemStyle={{ color: '#E7D1F4' }}
                    formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, 'Profit']}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#522D60" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* ACTIVITY FEED */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 flex flex-col"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-4">Recent Activity</h2>
          
          <div className="flex-1 space-y-4">
            {recentActivity.length === 0 && !loading ? (
              <p className="text-xs text-gray-400 text-center py-8">No recent transactions.</p>
            ) : (
              recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-start gap-3"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 ${activity.color}`}>
                    <activity.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{activity.desc}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTimeAgo(activity.date)}
                    </p>
                  </div>
                  <div className={`text-xs font-black whitespace-nowrap ${activity.amount >= 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {activity.amount >= 0 ? '+' : ''}Rs. {Math.abs(activity.amount).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <button 
            onClick={() => navigate('/mobile-sales')} 
            className="w-full mt-4 py-2 text-xs font-bold text-[#522D60] bg-[#FAF5FC] hover:bg-[#F3E8FA] rounded-xl transition-colors cursor-pointer"
          >
            View All Sales
          </button>
        </motion.div>
      </div>

      {/* QUICK SHORTCUT ACTIONS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Purchase Mobile', icon: Plus, color: 'bg-[#522D60]', path: '/purchase-mobile' },
          { label: 'Stock & Sell', icon: Smartphone, color: 'bg-[#42244D]', path: '/mobiles-stock' },
          { label: 'Shop Expenses', icon: ReceiptText, color: 'bg-rose-600', path: '/expenses' },
          { label: 'Customer Khata', icon: BookOpen, color: 'bg-gray-800', path: '/khata' },
        ].map((action, i) => (
          <div
            key={i}
            onClick={() => navigate(action.path)}
            className={`cursor-pointer rounded-2xl p-3.5 ${action.color} shadow-sm hover:shadow-md transition-all flex items-center gap-3 text-white active:scale-98`}
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <action.icon className="w-4 h-4" />
            </div>
            <span className="font-bold text-xs truncate">{action.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
