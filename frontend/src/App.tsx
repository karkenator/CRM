import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import Layout from './components/Layout';
import Login from './components/Login';
import ActionCenter from './pages/ActionCenter';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Agents from './pages/Agents';
import AgentDetails from './pages/AgentDetails';
import TopCreatives from './pages/TopCreatives';
import TopAds from './pages/TopAds';
import { ToastContainer, useToast } from './components/Toast';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('access_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <WorkspaceProvider>
      <Layout>{children}</Layout>
    </WorkspaceProvider>
  );
};

const AppContent: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Routes>
                  <Route path="/action-center" element={<ActionCenter />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/top-creatives" element={<TopCreatives />} />
                  <Route path="/top-ads" element={<TopAds />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/agents/:agentId" element={<AgentDetails />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/" element={<Navigate to="/action-center" />} />
                </Routes>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
