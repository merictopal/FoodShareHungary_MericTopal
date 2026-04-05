import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users as UsersIcon, Store, UtensilsCrossed, 
  LogOut, FileText, CheckCircle, XCircle, Eye, Search 
} from 'lucide-react';
import { client } from '../api/client';

// Interface for pending users waiting for approval
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

export default function PendingDocs() {
  const navigate = useNavigate();
  
  // State management
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch pending verifications on mount
  const fetchPendingDocs = async () => {
    try {
      const response = await client.get('/admin/pending');
      if (response.data.success) {
        setPendingUsers(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch pending documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDocs();
  }, []);

  const handleLogout = () => {
    navigate('/'); 
  };

  // Handle Approve or Reject actions
  const handleAction = async (userId: number, action: 'approve' | 'reject') => {
    try {
      const response = await client.post(`/admin/${action}`, { user_id: userId });
      if (response.data.success) {
        fetchPendingDocs(); // Refresh the list after action
      } else {
        alert("Action failed: " + response.data.message);
      }
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      alert(`An error occurred while trying to ${action} the user.`);
    }
  };

  // Helper to format document types nicely
  const formatDocType = (type: string | null) => {
    if (!type || type === 'unknown') return 'Identity Document';
    if (type === 'student') return 'Student ID';
    if (type === 'pensioner') return '+65 Age Card';
    if (type === 'social') return 'Social Support Card';
    return type.toUpperCase();
  };

  // Filter functionality for the search bar
  const filteredDocs = pendingUsers.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Overview</span>
          </Link>
          
          <Link to="/users" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <UsersIcon className="w-5 h-5" />
            <span className="font-medium">Users</span>
          </Link>
          
          <Link to="/restaurants" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <Store className="w-5 h-5" />
            <span className="font-medium">Restaurants</span>
          </Link>
          
          {/* 🚀 Active Navigation Link for Pending Docs */}
          <Link to="/pending-docs" className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors">
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
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-0">
          <h1 className="text-2xl font-bold text-gray-800">Document Verification</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search pending users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none w-64"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Pending Approvals Data Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                Awaiting Action
              </h2>
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                {filteredDocs.length} Actions Required
              </span>
            </div>
            
            <div className="overflow-x-auto flex-1">
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
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading data...</td>
                    </tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <CheckCircle className="w-16 h-16 text-emerald-200 mb-4" />
                          <p className="text-gray-500 font-bold text-xl">All caught up!</p>
                          <p className="text-gray-400 text-sm mt-1">No pending verifications match your criteria.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((user) => (
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