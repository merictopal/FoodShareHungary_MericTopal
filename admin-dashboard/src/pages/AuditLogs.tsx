import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Calendar, Globe, User, LayoutDashboard, 
  Users, Store, UtensilsCrossed, FileText, LogOut 
} from 'lucide-react';
import { client } from '../api/client';

interface LogEntry {
  id: number;
  user_id: number | null;
  action: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

export default function AuditLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await client.get('/admin/audit-logs');
        setLogs(res.data.logs);
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const handleLogout = () => {
    navigate('/'); 
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10 flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-wider">Admin Panel</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
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

          {/* Active Navigation Link for Security Logs */}
          <Link to="/audit-logs" className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors">
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
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-0">
          <h1 className="text-2xl font-bold text-gray-800">Security Control Room</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-500">Welcome, Super Admin</span>
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold border-2 border-emerald-500 shadow-sm">
              SA
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-200">
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800">System Audit Logs</h1>
                <p className="text-slate-500 font-medium">Monitoring every critical action in real-time</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase">Timestamp</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase">Action</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase">User ID</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase">IP Address</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                       <tr><td colSpan={5} className="p-10 text-center text-slate-400">Loading security records...</td></tr>
                    ) : logs.length === 0 ? (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-400">No security logs found.</td></tr>
                    ) : logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {log.timestamp}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            log.action.includes('SUCCESS') ? 'bg-emerald-100 text-emerald-700' :
                            log.action.includes('FAILED') || log.action.includes('DENIED') ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            {log.user_id || 'Guest'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">
                           <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-slate-400" />
                            {log.ip_address}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 italic">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}