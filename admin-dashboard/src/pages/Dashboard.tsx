import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Store, UtensilsCrossed, 
  LogOut, FileText, CheckCircle, XCircle, Eye, ShieldAlert
} from 'lucide-react';
import { client } from '../api/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

// Interface for statistics data
interface DashboardStats {
  total_users: number;
  total_restaurants: number;
  active_offers: number;
  pending_approvals: number;
}

// Interface for pending users
interface PendingUser {
  user_id: number;
  name: string;
  email: string;
  type: string;
  detail: string;
  doc: string | null;
  doc_type: string | null;
  joined_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<DashboardStats>({
    total_users: 0, total_restaurants: 0, active_offers: 0, pending_approvals: 0,
  });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all dashboard data concurrently
  const fetchDashboardData = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        client.get('/admin/stats'),
        client.get('/admin/pending')
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (pendingRes.data.success) setPendingUsers(pendingRes.data.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle Approve or Reject actions for pending verifications
  const handleAction = async (userId: number, action: 'approve' | 'reject') => {
    try {
      const response = await client.post(`/admin/${action}`, { user_id: userId });
      if (response.data.success) {
        fetchDashboardData();
      } else {
        alert("Action failed: " + response.data.message);
      }
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      alert(`An error occurred while trying to ${action} the user.`);
    }
  };

  const handleLogout = () => {
    navigate('/'); 
  };

  // Helper to format document types nicely
  const formatDocType = (type: string | null) => {
    if (!type || type === 'unknown') return 'Identity Document';
    if (type === 'student') return 'Student ID';
    if (type === 'pensioner') return '+65 Age Card';
    if (type === 'social') return 'Social Support Card';
    return type.toUpperCase();
  };

  // Chart Data Preparation
  const pieData = [
    { name: 'Users', value: stats.total_users },
    { name: 'Restaurants', value: stats.total_restaurants }
  ];
  const PIE_COLORS = ['#3B82F6', '#F59E0B'];

  const barData = [
    { name: 'Total Users', count: stats.total_users },
    { name: 'Total Restaurants', count: stats.total_restaurants },
    { name: 'Active Offers', count: stats.active_offers },
    { name: 'Pending Actions', count: stats.pending_approvals }
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider">Admin Panel</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {/* Active Navigation Link for Overview */}
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Overview</span>
          </Link>
          
          <Link to="/users" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <Users className="w-5 h-5" />
            <span className="font-medium">Users</span>
          </Link>
          
          <Link to="/restaurants" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <Store className="w-5 h-5" />
            <span className="font-medium">Restaurants</span>
          </Link>
          
          <Link to="/pending-docs" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <FileText className="w-5 h-5" />
            <span className="font-medium">Pending Docs</span>
          </Link>
          
          <Link to="/offers" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <UtensilsCrossed className="w-5 h-5" />
            <span className="font-medium">Active Offers</span>
          </Link>

          {/* new */ }
          <Link to="/audit-logs" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-medium">Security Logs</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-0">
          <h1 className="text-2xl font-bold text-gray-800">System Overview</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-500">Welcome, Super Admin</span>
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold border-2 border-emerald-500 shadow-sm">
              SA
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Top Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Users</h3>
              <p className="text-4xl font-black text-slate-800 mt-2">{isLoading ? "..." : stats.total_users}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Restaurants</h3>
              <p className="text-4xl font-black text-slate-800 mt-2">{isLoading ? "..." : stats.total_restaurants}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Active Offers</h3>
              <p className="text-4xl font-black text-slate-800 mt-2">{isLoading ? "..." : stats.active_offers}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Pending Approvals</h3>
              <p className="text-4xl font-black text-amber-500 mt-2">{isLoading ? "..." : stats.pending_approvals}</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            
            {/* Pie Chart: User vs Restaurant Distribution */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm col-span-1 flex flex-col items-center">
              <h3 className="text-gray-800 font-bold text-lg w-full text-left mb-4">User Distribution</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart: Overall Platform Activity */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm col-span-1 lg:col-span-2">
              <h3 className="text-gray-800 font-bold text-lg mb-4">Platform Activity</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#F3F4F6'}} 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                    />
                    <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
          
          {/* Pending Approvals Data Table */}
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                Pending Verifications
              </h2>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                {pendingUsers.length} Actions Required
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">User Details</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Document</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading data...</td>
                    </tr>
                  ) : pendingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <CheckCircle className="w-12 h-12 text-emerald-200 mb-3" />
                          <p className="text-gray-500 font-medium text-lg">All caught up!</p>
                          <p className="text-gray-400 text-sm">No pending verifications at the moment.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pendingUsers.map((user) => (
                      <tr key={user.user_id} className="hover:bg-gray-50/50 transition-colors">
                        
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-800">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase
                            ${user.type === 'restaurant' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {user.type}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              {user.type === 'restaurant' ? 'Business License' : formatDocType(user.doc_type)}
                            </span>
                            
                            {user.doc ? (
                              <a 
                                href={user.doc} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                              >
                                <Eye className="w-4 h-4" /> View Image
                              </a>
                            ) : (
                              <span className="text-sm text-gray-400 italic">No file attached</span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleAction(user.user_id, 'approve')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-bold transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" /> Approve
                            </button>
                            <button 
                              onClick={() => handleAction(user.user_id, 'reject')}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-colors"
                            >
                              <XCircle className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}

                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
}