import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('portal_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    let userRole = '';
    try {
      const user = JSON.parse(localStorage.getItem('portal_user') || '{}');
      userRole = user.role || '';
    } catch {
      userRole = '';
    }

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
