/**
 * Report Generation API Routes
 * 
 * Provides REST endpoints for:
 * - Report management (CRUD operations)
 * - PDF report generation
 * - Report download and access
 * - Report template management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateReport } from '../services/reportGenerationService';
import { 
  createReport, 
  getAllReports, 
  getReportById, 
  updateReportStatus,
  deleteReport,
  getAvailableReportTypes 
} from '../services/reportService';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const reports = new Hono();

// Validation schemas
const createReportSchema = z.object({
  reportType: z.enum(['annual_summary', 'quarterly_summary', 'csrd_disclosure', 'tcfd_disclosure', 'gri_report']),
  reportingPeriodStart: z.string().min(1, 'Period start is required'),
  reportingPeriodEnd: z.string().min(1, 'Period end is required')
});

// Apply authentication middleware
reports.use('*', authMiddleware);

/**
 * GET /reports
 * List all reports for the organization
 */
reports.get('/', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    const reportsList = await getAllReports(c.env, organizationId);
    
    return c.json({
      success: true,
      data: reportsList,
      count: reportsList.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch reports'
    }, 500);
  }
});

/**
 * POST /reports
 * Create a new report and start generation
 */
reports.post('/', validateRequest(createReportSchema), async (c) => {
  try {
    const { organizationId } = c.get('user');
    const reportData = await c.req.json();
    
    // Create report record
    const report = await createReport(c.env, organizationId, reportData);
    
    // Start background report generation
    // In production, this would use a queue or background worker
    generateReport(
      report.id,
      organizationId,
      reportData.reportType,
      reportData.reportingPeriodStart,
      reportData.reportingPeriodEnd,
      c.env
    ).catch(error => {
      console.error(`Background report generation failed for ${report.id}:`, error);
    });
    
    return c.json({
      success: true,
      data: report,
      message: 'Report generation started'
    }, 201);
  } catch (error) {
    console.error('Error creating report:', error);
    return c.json({
      success: false,
      error: 'Failed to create report'
    }, 500);
  }
});

/**
 * GET /reports/:id
 * Get report by ID
 */
reports.get('/:id', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const reportId = c.req.param('id');
    
    const report = await getReportById(c.env, organizationId, reportId);
    
    if (!report) {
      return c.json({
        success: false,
        error: 'Report not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch report'
    }, 500);
  }
});

/**
 * DELETE /reports/:id
 * Delete report by ID
 */
reports.delete('/:id', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const reportId = c.req.param('id');
    
    const deleted = await deleteReport(c.env, organizationId, reportId);
    
    if (!deleted) {
      return c.json({
        success: false,
        error: 'Report not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    return c.json({
      success: false,
      error: 'Failed to delete report'
    }, 500);
  }
});

/**
 * GET /reports/types
 * Get available report types
 */
reports.get('/types', async (c) => {
  try {
    const reportTypes = getAvailableReportTypes();
    
    return c.json({
      success: true,
      data: reportTypes
    });
  } catch (error) {
    console.error('Error fetching report types:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch report types'
    }, 500);
  }
});

/**
 * POST /reports/:id/regenerate
 * Regenerate an existing report
 */
reports.post('/:id/regenerate', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const reportId = c.req.param('id');
    
    const report = await getReportById(c.env, organizationId, reportId);
    
    if (!report) {
      return c.json({
        success: false,
        error: 'Report not found'
      }, 404);
    }
    
    // Update status to generating
    await updateReportStatus(c.env, organizationId, reportId, 'generating');
    
    // Start background regeneration
    generateReport(
      reportId,
      organizationId,
      report.reportType,
      report.reportingPeriodStart,
      report.reportingPeriodEnd,
      c.env
    ).catch(error => {
      console.error(`Background report regeneration failed for ${reportId}:`, error);
    });
    
    return c.json({
      success: true,
      message: 'Report regeneration started'
    });
  } catch (error) {
    console.error('Error regenerating report:', error);
    return c.json({
      success: false,
      error: 'Failed to regenerate report'
    }, 500);
  }
});

/**
 * GET /reports/:id/download
 * Download report PDF (redirect to signed URL)
 */
reports.get('/:id/download', async (c) => {
  try {
    const { organizationId } = c.get('user');
    const reportId = c.req.param('id');
    
    const report = await getReportById(c.env, organizationId, reportId);
    
    if (!report) {
      return c.json({
        success: false,
        error: 'Report not found'
      }, 404);
    }
    
    if (report.status !== 'complete' || !report.fileUrl) {
      return c.json({
        success: false,
        error: 'Report is not ready for download',
        status: report.status
      }, 400);
    }
    
    // For direct file URLs, redirect
    // For signed URLs, you would generate one here
    return c.redirect(report.fileUrl);
  } catch (error) {
    console.error('Error downloading report:', error);
    return c.json({
      success: false,
      error: 'Failed to download report'
    }, 500);
  }
});

/**
 * GET /reports/dashboard
 * Get reports dashboard data
 */
reports.get('/dashboard', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    const allReports = await getAllReports(c.env, organizationId);
    const recentReports = allReports.slice(0, 5);
    
    // Calculate stats
    const stats = {
      total: allReports.length,
      completed: allReports.filter(r => r.status === 'complete').length,
      failed: allReports.filter(r => r.status === 'failed').length,
      generating: allReports.filter(r => r.status === 'generating').length
    };
    
    // Group by report type
    const byType = allReports.reduce((acc, report) => {
      acc[report.reportType] = (acc[report.reportType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return c.json({
      success: true,
      data: {
        stats,
        recentReports,
        byType,
        availableTypes: getAvailableReportTypes()
      }
    });
  } catch (error) {
    console.error('Error fetching reports dashboard:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch reports dashboard'
    }, 500);
  }
});

export { reports };