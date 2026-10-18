import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { hasAdminSession } from './api/client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Offers from './pages/Offers';
import Restaurants from './pages/Restaurants';
import PendingDocs from './pages/PendingDocs';
import AuditLogs from './pages/AuditLogs'; 

// Admin pages are only rendered while an admin token is stored; otherwise go to the login page.
// (The backend still enforces admin rights on every request.)
function RequireAdmin({ children }: { children: ReactElement }) {
  return hasAdminSession() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Admin Routes */}
        <Route path="/dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
        <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
        <Route path="/restaurants" element={<RequireAdmin><Restaurants /></RequireAdmin>} />
        <Route path="/pending-docs" element={<RequireAdmin><PendingDocs /></RequireAdmin>} />
        <Route path="/offers" element={<RequireAdmin><Offers /></RequireAdmin>} />
        <Route path="/audit-logs" element={<RequireAdmin><AuditLogs /></RequireAdmin>} /> {/*NEW: Added route for Audit Logs */}
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}