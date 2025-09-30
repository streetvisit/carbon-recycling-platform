// services/reportService.ts - CRUD operations for reports

import { Report, CreateReportRequest } from '../types/reports';

// Mock database - in production this would connect to PlanetScale
let mockReports: Report[] = [];
let idCounter = 1;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function createReport(
  organizationId: string,
  data: CreateReportRequest
): Promise<Report> {
  const report: Report = {
    id: generateId('rept'),
    organizationId,
    reportType: data.reportType,
    reportingPeriodStart: data.reportingPeriodStart,
    reportingPeriodEnd: data.reportingPeriodEnd,
    status: 'generating',
    version: 1,
    generatedAt: new Date().toISOString(),
  };

  mockReports.push(report);
  return report;
}

export async function getAllReports(organizationId: string): Promise<Report[]> {
  return mockReports
    .filter(report => report.organizationId === organizationId)
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export async function getReportById(
  organizationId: string, 
  reportId: string
): Promise<Report | null> {
  return mockReports.find(
    report => report.id === reportId && report.organizationId === organizationId
  ) || null;
}

export async function updateReportStatus(
  organizationId: string,
  reportId: string,
  status: 'generating' | 'complete' | 'failed',
  fileUrl?: string
): Promise<Report | null> {
  const index = mockReports.findIndex(
    report => report.id === reportId && report.organizationId === organizationId
  );

  if (index === -1) {
    return null;
  }

  mockReports[index] = {
    ...mockReports[index],
    status,
    fileUrl: fileUrl || mockReports[index].fileUrl,
  };

  return mockReports[index];
}

export async function deleteReport(
  organizationId: string,
  reportId: string
): Promise<boolean> {
  const index = mockReports.findIndex(
    report => report.id === reportId && report.organizationId === organizationId
  );

  if (index === -1) {
    return false;
  }

  mockReports.splice(index, 1);
  return true;
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