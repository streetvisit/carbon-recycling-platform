// types/reports.ts - TypeScript interfaces for Module 5

export interface Report {
  id: string;
  organizationId: string;
  reportType: string;
  reportingPeriodStart: string; // ISO date string
  reportingPeriodEnd: string; // ISO date string
  status: 'generating' | 'complete' | 'failed';
  fileUrl?: string;
  version: number;
  generatedAt: string;
}

export interface CreateReportRequest {
  reportType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
}

export interface ReportGenerationData {
  organizationId: string;
  reportType: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  emissionsSummary: {
    totalCo2e: number;
    byScope: {
      scope_1: number;
      scope_2: number;
      scope_3: number;
    };
  };
  emissionsBreakdown: Array<{
    category: string;
    scope: string;
    totalCo2e: number;
    percentage: number;
  }>;
  initiatives: Array<{
    name: string;
    status: string;
    projectedCo2eReduction: number;
    estimatedCost?: number;
  }>;
  timeseriesData: Array<{
    date: string;
    totalCo2e: number;
  }>;
}

export const REPORT_TYPES = {
  ANNUAL_SUMMARY: 'annual_summary',
  QUARTERLY_SUMMARY: 'quarterly_summary',
  CSRD_DISCLOSURE: 'csrd_disclosure',
  TCFD_DISCLOSURE: 'tcfd_disclosure',
  GRI_REPORT: 'gri_report',
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];