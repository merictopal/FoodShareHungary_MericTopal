import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users as UsersIcon, Store, UtensilsCrossed, 
  LogOut, FileText, Search, MoreVertical, Activity, Ban, X,
  ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import { client } from '../api/client';

// Interface for table row data
interface SystemUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joined_at: string;
}

// Interface for detailed statistics inside the modal
interface UserDetailedStats {
  name: string;
  role: string;
  status: string;
  xp: number;
  level: number;
  joined_at: string;
  meals_claimed?: number;
  offers_created?: number;
  total_portions?: number; 
}

// Type for sorting configuration
type SortConfig = {
  key: keyof SystemUser | 'user_info';
  direction: 'asc' | 'desc';
} | null;

export default function Users() {
  const navigate = useNavigate();
  
  // Table states
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserStats, setSelectedUserStats] = useState<UserDetailedStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Fetch users on component mount
  const fetchUsers = async () => {
    try {
      const response = await client.get('/admin/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleLogout = () => navigate('/');

  const toggleDropdown = (userId: number) => {
    setOpenDropdownId(openDropdownId === userId ? null : userId);
  };

  // Suspend action
  const handleSuspend = async (userId: number, userName: string) => {
    setOpenDropdownId(null);
    if (!window.confirm(`Are you sure you want to suspend ${userName}? They will lose access to the app.`)) return;

    try {
      const response = await client.post('/admin/suspend', { user_id: userId });
      if (response.data.success) {
        fetchUsers(); // Refresh the table
      } else {
        alert("Failed to suspend user: " + response.data.message);
      }
    } catch (error) {
      console.error("Error suspending user:", error);
      alert("An error occurred during suspension.");
    }
  };

  // Fetch and show detailed stats in modal
  const handleViewStats = async (userId: number) => {
    setOpenDropdownId(null);
    setIsModalOpen(true);
    setIsStatsLoading(true);
    setSelectedUserStats(null);

    try {
      const response = await client.get(`/admin/user/${userId}/stats`);
      if (response.data.success) {
        setSelectedUserStats(response.data.data);
      } else {
        alert(response.data.message || "Failed to load stats.");
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to load user stats:", error);
      alert("Could not load user statistics.");
      setIsModalOpen(false);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Sorting Engine Logic
  const handleSort = (key: keyof SystemUser | 'user_info') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply search filter and sorting dynamically
  const processedUsers = useMemo(() => {
    let filterableUsers = users.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig !== null) {
      filterableUsers.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof SystemUser];
        let bValue: any = b[sortConfig.key as keyof SystemUser];

        if (sortConfig.key === 'user_info') {
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filterableUsers;
  }, [users, searchTerm, sortConfig]);

  // Helper component to render sort icons
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="w-4 h-4 text-gray-300 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-emerald-500 ml-1" />
      : <ChevronDown className="w-4 h-4 text-emerald-500 ml-1" />;
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
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
          
          {/* Active Navigation Link for Users */}
          <Link to="/users" className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors">
            <UsersIcon className="w-5 h-5" />
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
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col overflow-hidden" onClick={() => openDropdownId && setOpenDropdownId(null)}>
        
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-0">
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none w-64"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
            <div className="overflow-x-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider select-none">
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('id')}>
                      <div className="flex items-center">ID <SortIcon columnKey="id" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('user_info')}>
                      <div className="flex items-center">User Information <SortIcon columnKey="user_info" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('role')}>
                      <div className="flex items-center">Role <SortIcon columnKey="role" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center">Status <SortIcon columnKey="status" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('joined_at')}>
                      <div className="flex items-center">Joined At <SortIcon columnKey="joined_at" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading users...</td></tr>
                  ) : processedUsers.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No users found.</td></tr>
                  ) : (
                    processedUsers.map((user) => (
                      <tr key={user.id} className={`transition-colors ${user.status === 'suspended' ? 'bg-red-50/30 opacity-75' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-6 py-4 text-sm font-bold text-gray-400">#{user.id}</td>
                        <td className="px-6 py-4">
                          <div className={`font-bold ${user.status === 'suspended' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase
                            ${user.role === 'restaurant' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {user.role === 'student' ? 'user' : user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase
                            ${user.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 
                              user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                              user.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">{user.joined_at}</td>
                        
                        <td className="px-6 py-4 text-right relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleDropdown(user.id); }}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {/* Action Dropdown */}
                          {openDropdownId === user.id && (
                            <div className="absolute right-12 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleViewStats(user.id); }}
                                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-medium"
                              >
                                <Activity className="w-4 h-4" /> View Stats
                              </button>
                              
                              {user.status !== 'suspended' && (
                                <>
                                  <div className="h-px bg-gray-100 w-full" />
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleSuspend(user.id, user.name); }}
                                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                                  >
                                    <Ban className="w-4 h-4" /> Suspend User
                                  </button>
                                </>
                              )}
                            </div>
                          )}
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

      {/* --- DETAILED STATS MODAL OVERLAY --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Performance Report
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {isStatsLoading ? (
                <div className="py-8 text-center text-gray-400 font-medium">Gathering data from servers...</div>
              ) : selectedUserStats ? (
                <div className="space-y-6">
                  
                  {/* User Profile Info */}
                  <div className="text-center">
                    <div className="text-2xl font-black text-gray-800 tracking-tight">{selectedUserStats.name}</div>
                    <div className="text-sm font-bold text-emerald-600 uppercase tracking-widest mt-1">
                      {selectedUserStats.role === 'student' ? 'user' : selectedUserStats.role} • Lvl {selectedUserStats.level}
                    </div>
                  </div>

                  {/* Dynamic Stats Grid based on Role */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center flex flex-col justify-center">
                      <div className="text-xs font-bold text-gray-400 uppercase">Total XP</div>
                      <div className="text-2xl font-black text-slate-700">{selectedUserStats.xp}</div>
                    </div>
                    
                    {selectedUserStats.role === 'restaurant' ? (
                      <>
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center flex flex-col justify-center">
                          <div className="text-xs font-bold text-amber-500 uppercase">Published</div>
                          <div className="text-2xl font-black text-amber-700">{selectedUserStats.offers_created || 0} <span className="text-sm font-bold text-amber-500">Offers</span></div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center col-span-2">
                          <div className="text-xs font-bold text-orange-500 uppercase">Total Portions Shared</div>
                          <div className="text-3xl font-black text-orange-700">{selectedUserStats.total_portions || 0} <span className="text-lg">🍱</span></div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center flex flex-col justify-center">
                        <div className="text-xs font-bold text-blue-500 uppercase">Meals Claimed</div>
                        <div className="text-2xl font-black text-blue-700">{selectedUserStats.meals_claimed || 0}</div>
                      </div>
                    )}
                  </div>

                  {/* Verification Status Banner */}
                  <div className={`p-4 rounded-xl flex justify-between items-center font-bold text-sm border
                    ${selectedUserStats.status === 'suspended' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                    <span>Current Status:</span>
                    <span className="uppercase">{selectedUserStats.status}</span>
                  </div>

                </div>
              ) : (
                <div className="py-8 text-center text-red-500 font-medium">Error loading statistics.</div>
              )}
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}