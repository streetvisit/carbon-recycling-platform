/**
 * Authentication Middleware
 * 
 * Handles authentication for supplier collaboration routes
 */

import { MiddlewareHandler } from 'hono';
import { authenticateRequest, requireAuth } from '../services/authService';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    const authContext = await authenticateRequest(c.env, c.req.raw);
    c.set('authContext', authContext);
    
    if (!authContext.isAuthenticated || !authContext.user) {
      return c.json({ 
        success: false,
        error: 'Authentication required' 
      }, 401);
    }
    
    c.set('user', authContext.user);
    
    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return c.json({ 
      success: false,
      error: 'Authentication failed' 
    }, 401);
  }
};