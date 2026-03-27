import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import Automation from './pages/Automation';
import Inbox from './pages/Inbox';
import Analytics from './pages/Analytics';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <PrivateRoute>
                <Contacts />
              </PrivateRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <PrivateRoute>
                <Templates />
              </PrivateRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <PrivateRoute>
                <Campaigns />
              </PrivateRoute>
            }
          />
          <Route
            path="/campaigns/:id"
            element={
              <PrivateRoute>
                <CampaignDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/automation"
            element={
              <PrivateRoute>
                <Automation />
              </PrivateRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <PrivateRoute>
                <Inbox />
              </PrivateRoute>
            }
          />
          <Route
            path="/inbox/:phone"
            element={
              <PrivateRoute>
                <Inbox />
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <Analytics />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
