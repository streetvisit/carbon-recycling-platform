/**
 * Supplier Portal API Routes
 * 
 * Provides endpoints specifically for the supplier portal:
 * - Supplier-specific data request listings
 * - Data submission workflows
 * - Portal authentication and status
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { SupplierCollaborationService } from '../services/supplierCollaborationService';

const portal = new Hono();

// Validation schemas
const submitDataSchema = z.object({
  submittedValue: z.number().optional(),
  submittedUnit: z.string().optional(),
  submittedData: z.any().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional()
});

// Simple token-based auth middleware for supplier portal
const supplierAuth = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    // For now, we'll use the token as the supplier identifier
    // In production, you might want to implement proper JWT tokens
    const service = new SupplierCollaborationService(c.env);
    const supplierInfo = await service.getSupplierByToken(token);
    
    if (!supplierInfo) {
      return c.json({ error: 'Invalid authentication token' }, 401);
    }
    
    c.set('supplier', supplierInfo);
    c.set('supplierToken', token);
    
    return next();
  } catch (error) {
    console.error('Supplier authentication failed:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
};

// Apply supplier authentication to all routes
portal.use('*', supplierAuth);

/**
 * GET /portal/api/v1/requests
 * Get data requests for the authenticated supplier
 */
portal.get('/requests', async (c) => {
  try {
    const supplier = c.get('supplier');
    const service = new SupplierCollaborationService(c.env);
    
    const requests = await service.getDataRequestsBySupplier(supplier.id);
    
    return c.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching supplier requests:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch data requests'
    }, 500);
  }
});

/**
 * GET /portal/api/v1/requests/:id
 * Get specific data request details
 */
portal.get('/requests/:id', async (c) => {
  try {
    const supplier = c.get('supplier');
    const requestId = c.req.param('id');
    const service = new SupplierCollaborationService(c.env);
    
    const request = await service.getDataRequestByIdForSupplier(supplier.id, requestId);
    
    if (!request) {
      return c.json({
        success: false,
        error: 'Request not found or not accessible'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error fetching request details:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch request details'
    }, 500);
  }
});

/**
 * POST /portal/api/v1/requests/:id/submit
 * Submit data for a specific request
 */
portal.post('/requests/:id/submit', async (c) => {
  try {
    const supplier = c.get('supplier');
    const requestId = c.req.param('id');
    const submissionData = await c.req.json();
    
    // Validate submission data
    const validatedData = submitDataSchema.parse(submissionData);
    
    const service = new SupplierCollaborationService(c.env);
    const submission = await service.submitSupplierData(supplier.id, requestId, validatedData);
    
    return c.json({
      success: true,
      data: submission,
      message: 'Data submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting data:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit data'
    }, 500);
  }
});

/**
 * GET /portal/api/v1/submissions
 * Get submission history for the supplier
 */
portal.get('/submissions', async (c) => {
  try {
    const supplier = c.get('supplier');
    const service = new SupplierCollaborationService(c.env);
    
    const submissions = await service.getSubmissionsBySupplier(supplier.id);
    
    return c.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch submission history'
    }, 500);
  }
});

/**
 * GET /portal/api/v1/dashboard
 * Get supplier dashboard summary
 */
portal.get('/dashboard', async (c) => {
  try {
    const supplier = c.get('supplier');
    const service = new SupplierCollaborationService(c.env);
    
    // Get dashboard data in parallel
    const [pendingRequests, recentSubmissions] = await Promise.all([
      service.getDataRequestsBySupplier(supplier.id, { status: 'sent' }),
      service.getSubmissionsBySupplier(supplier.id, { limit: 5 })
    ]);
    
    const overduequests = pendingRequests.filter(r => 
      r.dueDate && new Date(r.dueDate) < new Date()
    );
    
    return c.json({
      success: true,
      data: {
        summary: {
          pendingRequests: pendingRequests.length,
          overdueRequests: overduequests.length,
          totalSubmissions: recentSubmissions.length
        },
        pendingRequests: pendingRequests.slice(0, 5),
        recentSubmissions
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch dashboard data'
    }, 500);
  }
});

/**
 * GET /portal/api/v1/profile
 * Get supplier profile information
 */
portal.get('/profile', async (c) => {
  try {
    const supplier = c.get('supplier');
    
    return c.json({
      success: true,
      data: {
        id: supplier.id,
        name: supplier.name,
        contactEmail: supplier.contactEmail,
        status: supplier.status,
        industry: supplier.industry,
        country: supplier.country,
        relationship: supplier.relationship
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch profile information'
    }, 500);
  }
});

export { portal };