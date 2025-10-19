// services/reportService.ts - CRUD operations for reports

import { Report, CreateReportRequest } from '../types/reports';
import { getD1Database, generateId } from '../../../../../packages/db/d1-connection';

interface Env {
  DB: D1Database;
}

export async function createReport(
  env: Env,
  organizationId: string,
  data: CreateReportRequest
): Promise<Report> {
  const db = getD1Database(env);
  const id = generateId('rept');
  const generatedAt = new Date().toISOString();

  const report: Report = {
    id,
    organizationId,
    reportType: data.reportType,
    reportingPeriodStart: data.reportingPeriodStart,
    reportingPeriodEnd: data.reportingPeriodEnd,
    status: 'generating',
    version: 1,
    generatedAt,
  };

  await db.prepare(`
    INSERT INTO reports (
      id, organizationId, reportType, reportingPeriodStart, reportingPeriodEnd,
      status, version, generatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, organizationId, data.reportType, data.reportingPeriodStart,
    data.reportingPeriodEnd, 'generating', 1, generatedAt
  ).run();

  return report;
}

export async function getAllReports(env: Env, organizationId: string): Promise<Report[]> {
  const db = getD1Database(env);
  const result = await db.prepare(`
    SELECT * FROM reports 
    WHERE organizationId = ? 
    ORDER BY generatedAt DESC
  `).bind(organizationId).all();
  
  return result.results as Report[];
}

export async function getReportById(
  env: Env,
  organizationId: string, 
  reportId: string
): Promise<Report | null> {
  const db = getD1Database(env);
  const result = await db.prepare(`
    SELECT * FROM reports 
    WHERE id = ? AND organizationId = ?
  `).bind(reportId, organizationId).first();
  
  return result ? result as Report : null;
}

export async function updateReportStatus(
  env: Env,
  organizationId: string,
  reportId: string,
  status: 'generating' | 'complete' | 'failed',
  fileUrl?: string
): Promise<Report | null> {
  const db = getD1Database(env);
  
  // Update the report
  await db.prepare(`
    UPDATE reports 
    SET status = ?, fileUrl = ? 
    WHERE id = ? AND organizationId = ?
  `).bind(status, fileUrl || null, reportId, organizationId).run();
  
  // Return the updated report
  return getReportById(env, organizationId, reportId);
}

export async function deleteReport(
  env: Env,
  organizationId: string,
  reportId: string
): Promise<boolean> {
  const db = getD1Database(env);
  
  const result = await db.prepare(`
    DELETE FROM reports 
    WHERE id = ? AND organizationId = ?
  `).bind(reportId, organizationId).run();
  
  return result.changes > 0;
}

// Helper function to get available report types
export function getAvailableReportTypes(): Array<{type: string, name: string, description: string}> {
  return [
    {
      type: 'annual_summary',
      name: 'Annual Summary',
      description: 'Comprehensive yearly emissions report with analytics and initiatives'
    },
    {
      type: 'quarterly_summary',
      name: 'Quarterly Summary',
      description: 'Quarterly emissions overview with key metrics and trends'
    },
    {
      type: 'csrd_disclosure',
      name: 'CSRD Disclosure',
      description: 'Corporate Sustainability Reporting Directive compliance report'
    },
    {
      type: 'tcfd_disclosure',
      name: 'TCFD Disclosure',
      description: 'Task Force on Climate-related Financial Disclosures report'
    },
    {
      type: 'gri_report',
      name: 'GRI Standards Report',
      description: 'Global Reporting Initiative sustainability standards report'
    }
  ];
}