import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Offers from './pages/Offers';
import Restaurants from './pages/Restaurants';
import PendingDocs from './pages/PendingDocs';
import AuditLogs from './pages/AuditLogs'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/restaurants" element={<Restaurants />} />
        <Route path="/pending-docs" element={<PendingDocs />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/audit-logs" element={<AuditLogs />} /> {/*NEW: Added route for Audit Logs */}
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}