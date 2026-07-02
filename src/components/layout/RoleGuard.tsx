import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 * Owner > Manager > Receptionist
 */
export default function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { profile, isLoading } = useAuth();

  if (isLoading) return null;

  if (!profile) {
    return <>{fallback}</>;
  }

  // Define role hierarchy
  const roleHierarchy: Record<UserRole, number> = {
    Owner: 3,
    Manager: 2,
    Receptionist: 1
  };

  const userRoleLevel = roleHierarchy[profile.role] || 0;
  
  // Find the minimum required level from allowed roles
  // If allowedRoles is ['Manager'], then level required is 2. So Owner (3) and Manager (2) can access.
  const requiredLevels = allowedRoles.map(role => roleHierarchy[role]);
  const minRequiredLevel = Math.min(...requiredLevels);

  if (userRoleLevel >= minRequiredLevel) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
