import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users as UsersIcon, Store, UtensilsCrossed, 
  LogOut, FileText, Search, Ban, ChevronUp, ChevronDown, ChevronsUpDown 
} from 'lucide-react';
import { client } from '../api/client';

// Interface for offer data from the backend
interface SystemOffer {
  id: number;
  restaurant_name: string;
  title: string;
  quantity: number;
  status: string;
  created_at: string;
}

// Type for table sorting configuration
type SortConfig = {
  key: keyof SystemOffer;
  direction: 'asc' | 'desc';
} | null;

export default function Offers() {
  const navigate = useNavigate();
  
  // State management
  const [offers, setOffers] = useState<SystemOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // Fetch all offers on mount
  const fetchOffers = async () => {
    try {
      const response = await client.get('/admin/offers');
      if (response.data.success) {
        setOffers(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch offers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleLogout = () => navigate('/');

  // Cancel an offer action
  const handleCancelOffer = async (offerId: number, offerTitle: string, restaurantName: string) => {
    if (!window.confirm(`Are you sure you want to cancel the offer "${offerTitle}" by ${restaurantName}?`)) return;

    try {
      const response = await client.post('/admin/offer/cancel', { offer_id: offerId });
      if (response.data.success) {
        fetchOffers(); // Refresh table to show cancelled status
      } else {
        alert("Failed to cancel offer: " + response.data.message);
      }
    } catch (error) {
      console.error("Error cancelling offer:", error);
      alert("An error occurred while trying to cancel the offer.");
    }
  };

  // Sorting Engine
  const handleSort = (key: keyof SystemOffer) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Search and Sort logic combined
  const processedOffers = useMemo(() => {
    let filterableOffers = offers.filter(offer => 
      offer.restaurant_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      offer.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig !== null) {
      filterableOffers.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        // Handle string comparison nicely
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filterableOffers;
  }, [offers, searchTerm, sortConfig]);

  // Helper for sort icons
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ChevronsUpDown className="w-4 h-4 text-gray-300 ml-1" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-emerald-500 ml-1" />
      : <ChevronDown className="w-4 h-4 text-emerald-500 ml-1" />;
  };

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
          
          <Link to="/pending-docs" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors">
            <FileText className="w-5 h-5" />
            <span className="font-medium">Pending Docs</span>
          </Link>
          
          {/* Active Navigation Link for Offers */}
          <Link to="/offers" className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl transition-colors">
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
        
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-0">
          <h1 className="text-2xl font-bold text-gray-800">Offers Management</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search offers or restaurants..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none w-72"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider select-none">
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('id')}>
                      <div className="flex items-center">ID <SortIcon columnKey="id" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('restaurant_name')}>
                      <div className="flex items-center">Restaurant <SortIcon columnKey="restaurant_name" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('title')}>
                      <div className="flex items-center">Offer Detail <SortIcon columnKey="title" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('quantity')}>
                      <div className="flex items-center">Portions <SortIcon columnKey="quantity" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center">Status <SortIcon columnKey="status" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center">Date <SortIcon columnKey="created_at" /></div>
                    </th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  
                  {isLoading ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Loading offers...</td></tr>
                  ) : processedOffers.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No offers found.</td></tr>
                  ) : (
                    processedOffers.map((offer) => (
                      <tr key={offer.id} className={`transition-colors ${offer.status === 'cancelled' ? 'bg-red-50/30' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-6 py-4 text-sm font-bold text-gray-400">#{offer.id}</td>
                        
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {offer.restaurant_name}
                        </td>
                        
                        <td className="px-6 py-4 text-sm font-medium text-slate-600">
                          {offer.title}
                        </td>
                        
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">
                            {offer.quantity}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase
                            ${offer.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                              offer.status === 'completed' ? 'bg-blue-100 text-blue-700' : 
                              offer.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                            {offer.status}
                          </span>
                        </td>
                        
                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                          {offer.created_at}
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          {/* Only show Cancel button if the offer is active */}
                          {offer.status === 'active' ? (
                            <button 
                              onClick={() => handleCancelOffer(offer.id, offer.title, offer.restaurant_name)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-colors ml-auto"
                            >
                              <Ban className="w-4 h-4" /> Cancel
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium mr-2">No actions</span>
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

    </div>
  );
}