/**
 * Request Validation Middleware
 * 
 * Validates request bodies using Zod schemas
 */

import { MiddlewareHandler } from 'hono';
import { z } from 'zod';

export const validateRequest = (schema: z.ZodSchema): MiddlewareHandler => {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      
      // Store validated data for use in the route handler
      c.set('validatedData', validatedData);
      
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }, 400);
      }
      
      console.error('Validation middleware error:', error);
      return c.json({
        success: false,
        error: 'Request validation failed'
      }, 400);
    }
  };
};