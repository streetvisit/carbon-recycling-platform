/**
 * Supplier Collaboration API Routes
 * 
 * Provides REST endpoints for:
 * - Supplier management (CRUD operations)
 * - Invitation system
 * - Data request workflows
 * - Submission processing
 * - Progress tracking and analytics
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { SupplierCollaborationService } from '../services/supplierCollaborationService';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const suppliers = new Hono();

// Validation schemas
const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactEmail: z.string().email('Valid email is required'),
  industry: z.string().optional(),
  country: z.string().optional(),
  relationship: z.enum(['tier_1', 'tier_2', 'tier_3', 'other']).optional(),
  spendCategory: z.string().optional(),
  estimatedEmissions: z.number().min(0).optional()
});

const sendInviteSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  customMessage: z.string().optional()
});

const createDataRequestSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  requestedDataType: z.string().min(1, 'Data type is required'),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dueDate: z.string().optional(),
  template: z.any().optional(),
  instructions: z.string().optional()
});

const submitDataSchema = z.object({
  submittedValue: z.number().optional(),
  submittedUnit: z.string().optional(),
  submittedData: z.any().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional()
});

const validateSubmissionSchema = z.object({
  validationStatus: z.enum(['validated', 'needs_review', 'rejected']),
  validationNotes: z.string().optional()
});

// Apply authentication middleware to all routes
suppliers.use('*', authMiddleware);

/**
 * GET /suppliers
 * List suppliers for the organization
 */
suppliers.get('/', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const { status, industry, relationship } = c.req.query();
    
    const service = new SupplierCollaborationService(c.env);
    const filters = { status, industry, relationship };
    
    const supplierList = await service.getSuppliers(organizationId, filters);
    
    return c.json({
      success: true,
      data: supplierList,
      count: supplierList.length
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch suppliers'
    }, 500);
  }
});

/**
 * POST /suppliers
 * Create a new supplier
 */
suppliers.post('/', validateRequest(createSupplierSchema), async (c) => {
  try {
    const { organizationId } = c.get('user');
    const supplierData = await c.req.json();
    
    const service = new SupplierCollaborationService(c.env);
    const supplier = await service.createSupplier(organizationId, supplierData);
    
    return c.json({
      success: true,
      data: supplier
    }, 201);
  } catch (error) {
    console.error('Error creating supplier:', error);
    return c.json({
      success: false,
      error: 'Failed to create supplier'
    }, 500);
  }
});

/**
 * GET /suppliers/:id
 * Get supplier by ID
 */
suppliers.get('/:id', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const supplierId = c.req.param('id');
    
    const service = new SupplierCollaborationService(c.env);
    const supplier = await service.getSupplierById(organizationId, supplierId);
    
    if (!supplier) {
      return c.json({
        success: false,
        error: 'Supplier not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch supplier'
    }, 500);
  }
});

/**
 * POST /suppliers/invite
 * Send invitation to supplier
 */
suppliers.post('/invite', validateRequest(sendInviteSchema), async (c) => {
  try {
    const { organizationId, userId, name } = c.get('user');
    const { supplierId, customMessage } = await c.req.json();
    
    const service = new SupplierCollaborationService(c.env);
    const invite = await service.sendSupplierInvite(
      organizationId,
      supplierId,
      userId,
      name,
      customMessage
    );
    
    return c.json({
      success: true,
      data: invite,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to send invitation'
    }, 500);
  }
});

/**
 * GET /suppliers/invite/validate/:token
 * Validate supplier invitation (public endpoint for suppliers)
 */
suppliers.get('/invite/validate/:token', async (c) => {
  try {
    const token = c.req.param('token');
    
    const service = new SupplierCollaborationService(c.env);
    const validation = await service.validateInvitation(token);
    
    if (!validation.success) {
      return c.json({
        success: false,
        error: validation.error
      }, 400);
    }
    
    return c.json({
      success: true,
      hostCompanyName: validation.hostCompanyName,
      invitedByName: validation.invitedByName,
      supplierEmail: validation.supplierEmail
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return c.json({
      success: false,
      error: 'Failed to validate invitation'
    }, 500);
  }
});

/**
 * POST /suppliers/invite/accept/:token
 * Accept supplier invitation (public endpoint for suppliers)
 */
suppliers.post('/invite/accept/:token', async (c) => {
  try {
    const token = c.req.param('token');
    
    const service = new SupplierCollaborationService(c.env);
    const result = await service.acceptInvitation(token);
    
    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }
    
    return c.json({
      success: true,
      data: { supplierId: result.supplierId },
      message: 'Invitation accepted successfully'
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return c.json({
      success: false,
      error: 'Failed to accept invitation'
    }, 500);
  }
});

/**
 * GET /suppliers/data-requests
 * List data requests for the organization
 */
suppliers.get('/data-requests', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const { status, supplierId, priority } = c.req.query();
    
    const service = new SupplierCollaborationService(c.env);
    const filters = { status, supplierId, priority };
    
    const requests = await service.getDataRequests(organizationId, filters);
    
    return c.json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    console.error('Error fetching data requests:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch data requests'
    }, 500);
  }
});

/**
 * POST /suppliers/data-requests
 * Create a new data request
 */
suppliers.post('/data-requests', validateRequest(createDataRequestSchema), async (c) => {
  try {
    const { organizationId } = c.get('user');
    const requestData = await c.req.json();
    
    const service = new SupplierCollaborationService(c.env);
    const dataRequest = await service.createDataRequest(organizationId, requestData);
    
    return c.json({
      success: true,
      data: dataRequest
    }, 201);
  } catch (error) {
    console.error('Error creating data request:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to create data request'
    }, 500);
  }
});

/**
 * POST /suppliers/data-requests/:id/send
 * Send data request to supplier
 */
suppliers.post('/data-requests/:id/send', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const dataRequestId = c.req.param('id');
    
    const service = new SupplierCollaborationService(c.env);
    await service.sendDataRequest(organizationId, dataRequestId);
    
    return c.json({
      success: true,
      message: 'Data request sent successfully'
    });
  } catch (error) {
    console.error('Error sending data request:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to send data request'
    }, 500);
  }
});

/**
 * GET /suppliers/data-requests/:id/submissions
 * Get submissions for a data request
 */
suppliers.get('/data-requests/:id/submissions', async (c) => {
  try {
    const dataRequestId = c.req.param('id');
    
    const service = new SupplierCollaborationService(c.env);
    const submissions = await service.getSubmissions(dataRequestId);
    
    return c.json({
      success: true,
      data: submissions,
      count: submissions.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch submissions'
    }, 500);
  }
});

/**
 * POST /suppliers/data-requests/:id/submit
 * Submit data for a request (supplier endpoint)
 */
suppliers.post('/data-requests/:id/submit', validateRequest(submitDataSchema), async (c) => {
  try {
    const dataRequestId = c.req.param('id');
    const submissionData = await c.req.json();
    
    // For supplier submissions, we need to identify the supplier
    // This could be done through a separate authentication mechanism for suppliers
    // For now, we'll assume supplierId is passed in the request body
    const { supplierId, ...actualSubmissionData } = submissionData;
    
    if (!supplierId) {
      return c.json({
        success: false,
        error: 'Supplier ID is required for submission'
      }, 400);
    }
    
    const service = new SupplierCollaborationService(c.env);
    const submission = await service.submitSupplierData(
      supplierId,
      dataRequestId,
      actualSubmissionData
    );
    
    return c.json({
      success: true,
      data: submission,
      message: 'Data submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting data:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to submit data'
    }, 500);
  }
});

/**
 * POST /suppliers/submissions/:id/validate
 * Validate and approve/reject supplier submission
 */
suppliers.post('/submissions/:id/validate', validateRequest(validateSubmissionSchema), async (c) => {
  try {
    const { organizationId, userId, name } = c.get('user');
    const submissionId = c.req.param('id');
    const validationData = await c.req.json();
    
    const service = new SupplierCollaborationService(c.env);
    await service.validateSubmission(organizationId, submissionId, {
      ...validationData,
      reviewedBy: name || userId
    });
    
    return c.json({
      success: true,
      message: 'Submission validation updated successfully'
    });
  } catch (error) {
    console.error('Error validating submission:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to validate submission'
    }, 500);
  }
});

/**
 * GET /suppliers/metrics
 * Get collaboration metrics and analytics
 */
suppliers.get('/metrics', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    const service = new SupplierCollaborationService(c.env);
    const metrics = await service.getCollaborationMetrics(organizationId);
    
    return c.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch collaboration metrics'
    }, 500);
  }
});

/**
 * GET /suppliers/dashboard
 * Get dashboard summary data
 */
suppliers.get('/dashboard', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    const service = new SupplierCollaborationService(c.env);
    
    // Get multiple data sets in parallel
    const [metrics, recentRequests, activeSuppliers] = await Promise.all([
      service.getCollaborationMetrics(organizationId),
      service.getDataRequests(organizationId, { status: 'sent' }),
      service.getSuppliers(organizationId, { status: 'active' })
    ]);
    
    return c.json({
      success: true,
      data: {
        metrics,
        recentRequests: recentRequests.slice(0, 5), // Latest 5
        activeSuppliers: activeSuppliers.slice(0, 10), // Top 10
        summary: {
          needsAttention: recentRequests.filter(r => 
            r.priority === 'high' || r.priority === 'critical'
          ).length,
          overdueRequests: recentRequests.filter(r => 
            r.dueDate && new Date(r.dueDate) < new Date()
          ).length
        }
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

export { suppliers };