/**
 * Authentication Service
 * 
 * Real Clerk authentication for API endpoints
 */

import { verifyToken } from '@clerk/backend';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'member';
}

export interface AuthContext {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}

/**
 * Verify Clerk JWT token and extract user information
 */
export async function verifyClerkToken(env: any, authHeader: string | null): Promise<AuthContext> {
  const token = extractToken(authHeader);
  
  if (!token) {
    return { user: null, isAuthenticated: false };
  }

  try {
    // Verify the token with Clerk
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY,
    });

    // Extract user information from the payload
    if (!payload.sub) {
      return { user: null, isAuthenticated: false };
    }

    // In a real implementation, you would fetch user details from your database
    // For now, we'll extract what we can from the token
    const user: AuthenticatedUser = {
      userId: payload.sub,
      organizationId: payload.org_id || 'org_default', // Fallback organization
      email: payload.email || '',
      role: payload.org_role === 'admin' ? 'admin' : 'member',
    };

    return { user, isAuthenticated: true };

  } catch (error) {
    console.error('Token verification failed:', error);
    return { user: null, isAuthenticated: false };
  }
}

/**
 * Mock authentication for development (fallback)
 */
export function createMockAuthContext(): AuthContext {
  return {
    user: {
      userId: 'user_dev_12345',
      organizationId: 'org_dev_12345',
      email: 'dev@example.com',
      role: 'admin',
    },
    isAuthenticated: true,
  };
}

/**
 * Middleware to authenticate requests
 */
export async function authenticateRequest(env: any, request: Request): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  
  // Try real Clerk authentication first
  if (env.CLERK_SECRET_KEY) {
    return await verifyClerkToken(env, authHeader);
  }
  
  // Fallback to mock authentication for development
  console.warn('Using mock authentication - set CLERK_SECRET_KEY for production');
  return createMockAuthContext();
}

/**
 * Require authentication middleware
 */
export function requireAuth(authContext: AuthContext): AuthenticatedUser {
  if (!authContext.isAuthenticated || !authContext.user) {
    throw new Error('Authentication required');
  }
  
  return authContext.user;
}

/**
 * Require admin role middleware
 */
export function requireAdmin(authContext: AuthContext): AuthenticatedUser {
  const user = requireAuth(authContext);
  
  if (user.role !== 'admin') {
    throw new Error('Admin privileges required');
  }
  
  return user;
}