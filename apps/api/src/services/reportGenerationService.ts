// services/reportGenerationService.ts - Core report generation with data aggregation and PDF creation

import { ReportGenerationData } from '../types/reports';
import { updateReportStatus } from './reportService';
import { calculateEmissionsSummary } from './calculationService';
import { getEmissionsBreakdown, getEmissionsTimeseries } from './analyticsService';
import { getAllInitiatives } from './initiativeService';
import { R2Client } from '../utils/r2Client';

// Environment variables for external services
interface ReportEnv {
  BROWSERLESS_API_KEY: string;
  BROWSERLESS_ENDPOINT: string; // e.g., 'wss://chrome.browserless.io?token=YOUR_TOKEN'
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ENDPOINT: string;
}

/**
 * Main report generation function - orchestrates data collection, PDF creation, and storage
 */
export async function generateReport(
  reportId: string,
  organizationId: string,
  reportType: string,
  reportingPeriodStart: string,
  reportingPeriodEnd: string,
  env: ReportEnv
): Promise<void> {
  try {
    console.log(`Starting report generation for ${reportId}`);

    // Step 1: Aggregate data from all modules
    const reportData = await aggregateReportData(
      organizationId,
      reportType,
      reportingPeriodStart,
      reportingPeriodEnd
    );

    // Step 2: Generate HTML content from template
    const htmlContent = await generateHtmlFromTemplate(reportData);

    // Step 3: Convert HTML to PDF using Browserless
    const pdfBuffer = await generatePdfFromHtml(htmlContent, env);

    // Step 4: Upload PDF to Cloudflare R2
    const fileUrl = await uploadPdfToR2(pdfBuffer, reportId, env);

    // Step 5: Update report status to complete
    await updateReportStatus(organizationId, reportId, 'complete', fileUrl);

    console.log(`Report generation completed for ${reportId}`);

  } catch (error) {
    console.error(`Report generation failed for ${reportId}:`, error);
    
    // Update report status to failed
    await updateReportStatus(organizationId, reportId, 'failed');
    
    throw error;
  }
}

/**
 * Aggregate data from all modules for report generation
 */
async function aggregateReportData(
  organizationId: string,
  reportType: string,
  reportingPeriodStart: string,
  reportingPeriodEnd: string
): Promise<ReportGenerationData> {
  
  try {
    // Get emissions summary from Module 2/3
    const emissionsSummary = calculateEmissionsSummary(organizationId);
    
    // Get emissions breakdown from Module 3
    const breakdownData = getEmissionsBreakdown(organizationId, {
      period: '12m', // Adjust based on reporting period
      sortBy: 'co2e_desc',
      limit: 20
    });
    
    // Get timeseries data from Module 3
    const timeseriesData = getEmissionsTimeseries(organizationId, {
      period: '12m',
      groupBy: 'month'
    });
    
    // Get initiatives from Module 4
    const initiatives = await getAllInitiatives(organizationId);

    return {
      organizationId,
      reportType,
      reportingPeriodStart,
      reportingPeriodEnd,
      emissionsSummary,
      emissionsBreakdown: breakdownData,
      timeseriesData,
      initiatives: initiatives.map(initiative => ({
        name: initiative.name,
        status: initiative.status,
        projectedCo2eReduction: initiative.projectedCo2eReduction || 0,
        estimatedCost: initiative.estimatedCost
      }))
    };

  } catch (error) {
    console.error('Error aggregating report data:', error);
    throw new Error(`Failed to aggregate report data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate HTML content from template and data
 */
async function generateHtmlFromTemplate(data: ReportGenerationData): Promise<string> {
  // Select template based on report type
  const templateHtml = getReportTemplate(data.reportType);
  
  // Replace placeholders with actual data
  return templateHtml
    .replace('{{ORGANIZATION_ID}}', data.organizationId)
    .replace('{{REPORT_TYPE}}', data.reportType.replace('_', ' ').toUpperCase())
    .replace('{{REPORTING_PERIOD_START}}', new Date(data.reportingPeriodStart).toLocaleDateString('en-GB'))
    .replace('{{REPORTING_PERIOD_END}}', new Date(data.reportingPeriodEnd).toLocaleDateString('en-GB'))
    .replace('{{TOTAL_CO2E}}', data.emissionsSummary.totalCo2e.toFixed(2))
    .replace('{{SCOPE_1_CO2E}}', data.emissionsSummary.byScope.scope_1.toFixed(2))
    .replace('{{SCOPE_2_CO2E}}', data.emissionsSummary.byScope.scope_2.toFixed(2))
    .replace('{{SCOPE_3_CO2E}}', data.emissionsSummary.byScope.scope_3.toFixed(2))
    .replace('{{BREAKDOWN_DATA}}', generateBreakdownHtml(data.emissionsBreakdown))
    .replace('{{INITIATIVES_DATA}}', generateInitiativesHtml(data.initiatives))
    .replace('{{TIMESERIES_CHART}}', generateTimeseriesChartJs(data.timeseriesData))
    .replace('{{GENERATION_DATE}}', new Date().toLocaleDateString('en-GB'));
}

/**
 * Convert HTML to PDF using Browserless.io
 */
async function generatePdfFromHtml(htmlContent: string, env: ReportEnv): Promise<ArrayBuffer> {
  const browserlessUrl = `https://chrome.browserless.io/pdf?token=${env.BROWSERLESS_API_KEY}`;
  
  const response = await fetch(browserlessUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      html: htmlContent,
      options: {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center;">CarbonRecycling.co.uk Sustainability Report</div>',
        footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Browserless PDF generation failed: ${response.status} ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

/**
 * Upload PDF to Cloudflare R2
 */
async function uploadPdfToR2(pdfBuffer: ArrayBuffer, reportId: string, env: ReportEnv): Promise<string> {
  const fileName = `reports/${reportId}.pdf`;
  
  // Initialize R2 client
  const r2Client = new R2Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    endpoint: env.R2_ENDPOINT,
    bucketName: env.R2_BUCKET_NAME,
    region: 'auto' // Cloudflare R2 uses 'auto' region
  });
  
  // Upload the file
  const result = await r2Client.uploadFile(pdfBuffer, fileName, 'application/pdf');
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to upload PDF to R2');
  }
  
  return result.fileUrl!;
}

/**
 * Get HTML template based on report type
 */
function getReportTemplate(reportType: string): string {
  const baseTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{REPORT_TYPE}} Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #16a34a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #16a34a;
      margin-bottom: 10px;
    }
    .report-title {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #1f2937;
    }
    .reporting-period {
      color: #6b7280;
      font-size: 16px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 30px 0;
    }
    .metric-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #16a34a;
      margin-bottom: 5px;
    }
    .metric-label {
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section {
      margin: 40px 0;
    }
    .section-title {
      font-size: 20px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .breakdown-table th,
    .breakdown-table td {
      border: 1px solid #e5e7eb;
      padding: 12px;
      text-align: left;
    }
    .breakdown-table th {
      background-color: #f9fafb;
      font-weight: bold;
    }
    .scope-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .scope-1 { background-color: #fee2e2; color: #dc2626; }
    .scope-2 { background-color: #fed7aa; color: #ea580c; }
    .scope-3 { background-color: #e0e7ff; color: #3730a3; }
    .chart-container {
      margin: 30px 0;
      height: 400px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    @media print {
      body { print-color-adjust: exact; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🌱 CarbonRecycling.co.uk</div>
    <h1 class="report-title">{{REPORT_TYPE}} Report</h1>
    <div class="reporting-period">
      Reporting Period: {{REPORTING_PERIOD_START}} - {{REPORTING_PERIOD_END}}
    </div>
  </div>

  <div class="summary-grid">
    <div class="metric-card">
      <div class="metric-value">{{TOTAL_CO2E}}</div>
      <div class="metric-label">Total tCO₂e</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">{{SCOPE_1_CO2E}}</div>
      <div class="metric-label">Scope 1 tCO₂e</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">{{SCOPE_2_CO2E}}</div>
      <div class="metric-label">Scope 2 tCO₂e</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">{{SCOPE_3_CO2E}}</div>
      <div class="metric-label">Scope 3 tCO₂e</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">📊 Emissions Breakdown by Category</h2>
    {{BREAKDOWN_DATA}}
  </div>

  <div class="page-break"></div>

  <div class="section">
    <h2 class="section-title">📈 Emissions Trend Analysis</h2>
    <div class="chart-container">
      <canvas id="timeseriesChart" width="600" height="300"></canvas>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">🎯 Decarbonisation Initiatives</h2>
    {{INITIATIVES_DATA}}
  </div>

  <div class="footer">
    Generated on {{GENERATION_DATE}} by CarbonRecycling.co.uk Platform<br>
    This report contains confidential information. Distribution should be limited to authorized personnel.
  </div>

  <script>
    {{TIMESERIES_CHART}}
  </script>
</body>
</html>`;

  return baseTemplate;
}

/**
 * Generate HTML for emissions breakdown table
 */
function generateBreakdownHtml(breakdown: ReportGenerationData['emissionsBreakdown']): string {
  if (breakdown.length === 0) {
    return '<p>No emissions breakdown data available for this reporting period.</p>';
  }

  const tableRows = breakdown.map(item => `
    <tr>
      <td>${item.category}</td>
      <td><span class="scope-badge scope-${item.scope.replace('_', '-')}">${item.scope.replace('_', ' ').toUpperCase()}</span></td>
      <td>${item.totalCo2e.toFixed(2)}</td>
      <td>${item.percentage.toFixed(1)}%</td>
    </tr>
  `).join('');

  return `
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Scope</th>
          <th>Emissions (tCO₂e)</th>
          <th>% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}

/**
 * Generate HTML for initiatives summary
 */
function generateInitiativesHtml(initiatives: ReportGenerationData['initiatives']): string {
  if (initiatives.length === 0) {
    return '<p>No decarbonisation initiatives have been created for this organization.</p>';
  }

  const totalProjectedReduction = initiatives.reduce((sum, init) => sum + init.projectedCo2eReduction, 0);
  const completedInitiatives = initiatives.filter(init => init.status === 'completed').length;
  const inProgressInitiatives = initiatives.filter(init => init.status === 'in_progress').length;

  const initiativeRows = initiatives.map(initiative => `
    <tr>
      <td>${initiative.name}</td>
      <td>
        <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; 
          background-color: ${getStatusColor(initiative.status)}; color: white;">
          ${initiative.status.replace('_', ' ').toUpperCase()}
        </span>
      </td>
      <td>${initiative.projectedCo2eReduction.toFixed(2)}</td>
      <td>${initiative.estimatedCost ? `£${initiative.estimatedCost.toLocaleString()}` : 'Not specified'}</td>
    </tr>
  `).join('');

  return `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
      <div class="metric-card">
        <div class="metric-value">${initiatives.length}</div>
        <div class="metric-label">Total Initiatives</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${completedInitiatives + inProgressInitiatives}</div>
        <div class="metric-label">Active Initiatives</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${totalProjectedReduction.toFixed(1)}</div>
        <div class="metric-label">Projected Annual Reduction (tCO₂e)</div>
      </div>
    </div>
    
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Initiative Name</th>
          <th>Status</th>
          <th>Projected Reduction (tCO₂e/yr)</th>
          <th>Estimated Cost</th>
        </tr>
      </thead>
      <tbody>
        ${initiativeRows}
      </tbody>
    </table>
  `;
}

/**
 * Generate Chart.js script for timeseries visualization
 */
function generateTimeseriesChartJs(timeseriesData: ReportGenerationData['timeseriesData']): string {
  const labels = timeseriesData.map(point => new Date(point.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }));
  const data = timeseriesData.map(point => point.totalCo2e);

  return `
    const ctx = document.getElementById('timeseriesChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(labels)},
        datasets: [{
          label: 'Monthly Emissions (tCO₂e)',
          data: ${JSON.stringify(data)},
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Emissions (tCO₂e)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Month'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    });
  `;
}

/**
 * Get status color for initiatives
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#16a34a';
    case 'in_progress': return '#ea580c';
    case 'planning': return '#3730a3';
    case 'on_hold': return '#6b7280';
    default: return '#6b7280';
  }
}