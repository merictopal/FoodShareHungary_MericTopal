import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import all page components
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Offers from './pages/Offers';
import Restaurants from './pages/Restaurants';
import PendingDocs from './pages/PendingDocs';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Base public route for the login screen */}
        <Route path="/" element={<Login />} />
        
        {/* Protected Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/restaurants" element={<Restaurants />} />
        <Route path="/pending-docs" element={<PendingDocs />} />
        <Route path="/offers" element={<Offers />} />
        
        {/* Fallback route: Redirects any unknown URL back to the login page */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}