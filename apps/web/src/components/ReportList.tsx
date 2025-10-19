// components/ReportList.tsx - Displays list of generated and generating reports

import { useEffect } from 'preact/hooks';
import { useReportsStore } from '../stores/reportsStore';

export default function ReportList() {
  const {
    reports,
    loading,
    error,
    fetchReports,
    startPolling,
    stopPolling,
    downloadReport
  } = useReportsStore();

  useEffect(() => {
    fetchReports();
    startPolling();

    return () => {
      stopPolling();
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'generating': return <span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Generating</span>;
      case 'complete': return <span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Complete</span>;
      case 'failed': return <span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Failed</span>;
      default: return <span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Unknown</span>;
    }
  };

  const getReportTypeName = (type: string) => {
    switch (type) {
      case 'annual_summary': return 'Annual Summary';
      case 'quarterly_summary': return 'Quarterly Summary';
      case 'csrd_disclosure': return 'CSRD Disclosure';
      case 'tcfd_disclosure': return 'TCFD Disclosure';
      case 'gri_report': return 'GRI Report';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Generated Reports</h2>
            <p class="text-sm text-gray-600 mt-1">
              All reports previously generated and in progress
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div class="mx-6 mt-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div class="overflow-x-auto">
        {loading ? (
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <div class="text-sm text-gray-600">Loading reports...</div>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div class="flex items-center justify-center h-64 bg-gray-50">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">📄</div>
              <div class="text-sm font-medium">No reports found</div>
              <div class="text-xs mt-1">Generate your first report using the form above</div>
            </div>
          </div>
        ) : (
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} class="hover:bg-gray-50 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {getReportTypeName(report.reportType)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {formatDate(report.reportingPeriodStart)} - {formatDate(report.reportingPeriodEnd)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      {formatDate(report.generatedAt)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(report.status)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      disabled={report.status !== 'complete'}
                      onClick={() => downloadReport(report.id)}
                      class={`px-3 py-1 text-sm rounded-md border ${
                        report.status === 'complete' 
                          ? 'border-green-600 text-green-600 hover:bg-green-50' 
                          : 'border-gray-300 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reports.length > 0 && (
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between text-sm">
            <div class="text-gray-600">
              {reports.length} report{reports.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
