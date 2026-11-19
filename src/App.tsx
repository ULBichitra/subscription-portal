import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui/ToastProvider';
import OfflineBanner from './components/OfflineBanner';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy-loaded routes for code-splitting and sub-500kB chunks
const LandingPage = lazy(() => import('./views/LandingPage'));
const Login = lazy(() => import('./views/Login'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const TowerManagement = lazy(() => import('./views/TowerManagement'));
const TowerDetail = lazy(() => import('./views/TowerDetail'));
const SubscriptionManagement = lazy(() => import('./views/SubscriptionManagement'));
// Postpaid mode active
const SessionLogs = lazy(() => import('./views/SessionLogs'));
const AuditTrail = lazy(() => import('./views/AuditTrail'));
const FieldSupport = lazy(() => import('./views/FieldSupport'));
const CustomerManagement = lazy(() => import('./views/CustomerManagement'));
const RBACMatrix = lazy(() => import('./views/RBACMatrix'));
const UserManagement = lazy(() => import('./views/UserManagement'));
const ActivateAccount = lazy(() => import('./views/ActivateAccount'));
const AccountSettings = lazy(() => import('./views/AccountSettings'));
const ResetPassword = lazy(() => import('./views/ResetPassword'));
const RequestsManagement = lazy(() => import('./views/RequestsManagement'));
const ComplaintsManagement = lazy(() => import('./views/ComplaintsManagement'));
const CommercialCalculator = lazy(() => import('./views/CommercialCalculator'));
const BillingManagement = lazy(() => import('./views/BillingManagement'));
const PricingConfiguration = lazy(() => import('./views/PricingConfiguration'));

const RouteLoadingFallback: React.FC = () => (
  <div className="flex h-64 w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
      <span className="text-xs font-mono tracking-wider text-cyan-400/80 animate-pulse">LOADING SUBSYSTEM...</span>
    </div>
  </div>
);

const WildcardFallback: React.FC = () => {
  const token = localStorage.getItem('portal_token');
  return <Navigate to={token ? '/dashboard' : '/'} replace />;
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <OfflineBanner />
      <Router>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/activate" element={<ActivateAccount />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected Routes wrapped in Layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/roi-studio" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager']}><CommercialCalculator /></ProtectedRoute>} />
              <Route path="/commercial-calculator" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager']}><CommercialCalculator /></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager', 'hospital_admin']}><BillingManagement /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager', 'hospital_admin']}><BillingManagement /></ProtectedRoute>} />
              <Route path="/pricing-config" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager']}><PricingConfiguration /></ProtectedRoute>} />
              <Route path="/complaints" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager', 'hospital_admin', 'field_support']}><ComplaintsManagement /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager']}><RequestsManagement /></ProtectedRoute>} />
              <Route path="/settings" element={<AccountSettings />} />
              <Route path="/customers" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager']}><CustomerManagement /></ProtectedRoute>} />
              <Route path="/towers" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager', 'hospital_admin', 'field_support']}><TowerManagement /></ProtectedRoute>} />
              <Route path="/towers/:towerId" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager', 'hospital_admin', 'field_support']}><TowerDetail /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['superadmin']}><UserManagement /></ProtectedRoute>} />
              <Route path="/subscriptions" element={<ProtectedRoute allowedRoles={['superadmin', 'subscription_manager']}><SubscriptionManagement /></ProtectedRoute>} />
              <Route path="/balance" element={<Navigate to="/invoices" replace />} />
              <Route path="/logs" element={<ProtectedRoute allowedRoles={['superadmin', 'hospital_admin', 'field_support']}><SessionLogs /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute allowedRoles={['superadmin']}><AuditTrail /></ProtectedRoute>} />
              <Route path="/rbac" element={<ProtectedRoute allowedRoles={['superadmin']}><RBACMatrix /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute allowedRoles={['superadmin', 'field_support']}><FieldSupport /></ProtectedRoute>} />
            </Route>
            
            {/* Wildcard Fallback */}
            <Route path="*" element={<WildcardFallback />} />
          </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  );
};

export default App;
