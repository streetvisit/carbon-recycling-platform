/**
 * Report Generation Test Routes
 * 
 * Provides test endpoints to demonstrate report generation features
 */

import { Hono } from 'hono';
import { createReport } from '../services/reportService';
import { createActivityData, processAllActivityData } from '../services/calculationService';
import { authMiddleware } from '../middleware/auth';

const reportsTest = new Hono();

// Apply authentication middleware
reportsTest.use('*', authMiddleware);

/**
 * POST /test/create-sample-data
 * Create sample activity data for report generation
 */
reportsTest.post('/create-sample-data', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    // Sample activity data for report generation
    const sampleActivities = [
      {
        dataSourceId: 'test_source',
        activityType: 'electricity_usage',
        value: 15000,
        unit: 'kWh',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
      {
        dataSourceId: 'test_source',
        activityType: 'natural_gas',
        value: 8000,
        unit: 'kWh',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
      {
        dataSourceId: 'test_source',
        activityType: 'diesel_fuel',
        value: 2000,
        unit: 'litres',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
      {
        dataSourceId: 'test_source',
        activityType: 'air_travel_short_haul',
        value: 25000,
        unit: 'passenger_km',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      },
      {
        dataSourceId: 'test_source',
        activityType: 'air_travel_long_haul',
        value: 35000,
        unit: 'passenger_km',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      }
    ];
    
    const createdActivities = [];
    
    for (const activity of sampleActivities) {
      const activityData = createActivityData({
        ...activity,
        organizationId
      });
      createdActivities.push(activityData);
    }
    
    // Process all the activity data to create emissions
    const processingResults = await processAllActivityData(organizationId);
    
    return c.json({
      success: true,
      message: `Created ${createdActivities.length} sample activities and processed ${processingResults.processed} emissions calculations`,
      data: {
        activities: createdActivities,
        processing: processingResults
      }
    });
  } catch (error) {
    console.error('Error creating sample data:', error);
    return c.json({
      success: false,
      error: 'Failed to create sample data'
    }, 500);
  }
});

/**
 * POST /test/demo-annual-report
 * Create and generate a demo annual report
 */
reportsTest.post('/demo-annual-report', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    const reportData = {
      reportType: 'annual_summary',
      reportingPeriodStart: '2024-01-01',
      reportingPeriodEnd: '2024-12-31'
    };
    
    const report = await createReport(c.env, organizationId, reportData);
    
    return c.json({
      success: true,
      data: report,
      message: 'Demo annual report created. Note: PDF generation requires Browserless API key and R2 storage configuration.',
      instructions: [
        '1. Set up environment variables: BROWSERLESS_API_KEY, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT',
        '2. Use POST /api/v1/reports to create reports that will automatically generate PDFs',
        '3. Check report status with GET /api/v1/reports/:id',
        '4. Download completed reports with GET /api/v1/reports/:id/download'
      ]
    }, 201);
  } catch (error) {
    console.error('Error creating demo report:', error);
    return c.json({
      success: false,
      error: 'Failed to create demo report'
    }, 500);
  }
});

/**
 * POST /test/demo-all-report-types
 * Create sample reports for all available types
 */
reportsTest.post('/demo-all-report-types', async (c) => {
  try {
    const { organizationId } = c.get('user');
    
    const reportTypes = [
      'annual_summary',
      'quarterly_summary', 
      'csrd_disclosure',
      'tcfd_disclosure',
      'gri_report'
    ];
    
    const createdReports = [];
    
    for (const reportType of reportTypes) {
      const reportData = {
        reportType,
        reportingPeriodStart: '2024-01-01',
        reportingPeriodEnd: reportType === 'quarterly_summary' ? '2024-03-31' : '2024-12-31'
      };
      
      const report = await createReport(c.env, organizationId, reportData);
      createdReports.push(report);
    }
    
    return c.json({
      success: true,
      data: createdReports,
      message: `Created ${createdReports.length} sample reports of different types`,
      note: 'PDF generation requires proper environment variable configuration'
    });
  } catch (error) {
    console.error('Error creating demo reports:', error);
    return c.json({
      success: false,
      error: 'Failed to create demo reports'
    }, 500);
  }
});

export { reportsTest };