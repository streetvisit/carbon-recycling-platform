// components/ReportGeneratorForm.tsx - Form for configuring and requesting new reports

import { useState, useEffect } from 'preact/hooks';
import { useReportsStore } from '../stores/reportsStore';

export default function ReportGeneratorForm() {
  const {
    reportTypes,
    isGenerating,
    error,
    fetchReportTypes,
    createReport,
    startPolling
  } = useReportsStore();

  const [formData, setFormData] = useState({
    reportType: '',
    reportingPeriodStart: '',
    reportingPeriodEnd: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchReportTypes();
    
    // Set default dates (last 12 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);
    
    setFormData(prev => ({
      ...prev,
      reportingPeriodStart: startDate.toISOString().split('T')[0],
      reportingPeriodEnd: endDate.toISOString().split('T')[0]
    }));
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.reportType) {
      errors.reportType = 'Please select a report type';
    }
    
    if (!formData.reportingPeriodStart) {
      errors.reportingPeriodStart = 'Start date is required';
    }
    
    if (!formData.reportingPeriodEnd) {
      errors.reportingPeriodEnd = 'End date is required';
    }
    
    if (formData.reportingPeriodStart && formData.reportingPeriodEnd) {
      const startDate = new Date(formData.reportingPeriodStart);
      const endDate = new Date(formData.reportingPeriodEnd);
      
      if (startDate >= endDate) {
        errors.reportingPeriodEnd = 'End date must be after start date';
      }
      
      // Check if period is too long (more than 5 years)
      const yearsDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsDiff > 5) {
        errors.reportingPeriodEnd = 'Reporting period cannot exceed 5 years';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    await createReport(formData);
    
    // Start polling for status updates if report was created successfully
    if (!error) {
      startPolling();
    }
  };

  const selectedReportType = reportTypes.find(type => type.type === formData.reportType);

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-2">
          Generate New Report
        </h2>
        <p class="text-sm text-gray-600">
          Create professional sustainability reports based on your emissions data and initiatives
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Report Type Selection */}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Report Type *
          </label>
          <select
            value={formData.reportType}
            onChange={(e) => handleInputChange('reportType', (e.target as HTMLSelectElement).value)}
            class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
              formErrors.reportType ? 'border-red-300' : 'border-gray-300'
            }`}
            disabled={isGenerating}
          >
            <option value="">Select a report type...</option>
            {reportTypes.map((type) => (
              <option key={type.type} value={type.type}>
                {type.name}
              </option>
            ))}
          </select>
          {formErrors.reportType && (
            <p class="mt-1 text-xs text-red-600">{formErrors.reportType}</p>
          )}
          {selectedReportType && (
            <p class="mt-1 text-xs text-gray-500">{selectedReportType.description}</p>
          )}
        </div>

        {/* Reporting Period */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              value={formData.reportingPeriodStart}
              onChange={(e) => handleInputChange('reportingPeriodStart', (e.target as HTMLInputElement).value)}
              class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                formErrors.reportingPeriodStart ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={isGenerating}
            />
            {formErrors.reportingPeriodStart && (
              <p class="mt-1 text-xs text-red-600">{formErrors.reportingPeriodStart}</p>
            )}
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <input
              type="date"
              value={formData.reportingPeriodEnd}
              onChange={(e) => handleInputChange('reportingPeriodEnd', (e.target as HTMLInputElement).value)}
              class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                formErrors.reportingPeriodEnd ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={isGenerating}
            />
            {formErrors.reportingPeriodEnd && (
              <p class="mt-1 text-xs text-red-600">{formErrors.reportingPeriodEnd}</p>
            )}
          </div>
        </div>

        {/* Quick Date Presets */}
        <div>
          <p class="text-sm font-medium text-gray-700 mb-2">Quick Presets:</p>
          <div class="flex flex-wrap gap-2">
            {[
              { label: 'Last 12 Months', months: 12 },
              { label: 'Current Year', months: 'year' },
              { label: 'Last Year', months: 'lastYear' },
              { label: 'Last 3 Years', months: 36 }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const endDate = new Date();
                  let startDate = new Date();
                  
                  if (preset.months === 'year') {
                    startDate = new Date(endDate.getFullYear(), 0, 1);
                  } else if (preset.months === 'lastYear') {
                    startDate = new Date(endDate.getFullYear() - 1, 0, 1);
                    endDate.setFullYear(endDate.getFullYear() - 1);
                    endDate.setMonth(11, 31);
                  } else {
                    startDate.setMonth(endDate.getMonth() - (preset.months as number));
                  }
                  
                  setFormData(prev => ({
                    ...prev,
                    reportingPeriodStart: startDate.toISOString().split('T')[0],
                    reportingPeriodEnd: endDate.toISOString().split('T')[0]
                  }));
                }}
                class="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isGenerating}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div class="pt-4">
          <button
            type="submit"
            disabled={isGenerating || reportTypes.length === 0}
            class="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Report...
              </>
            ) : (
              <>
                <span class="mr-2">📄</span>
                Generate Report
              </>
            )}
          </button>
        </div>
      </form>

      {/* Information Panel */}
      <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 class="text-sm font-medium text-blue-900 mb-2">📋 Report Generation Process</h3>
        <ul class="text-xs text-blue-700 space-y-1">
          <li>• Data aggregation from all modules (emissions, analytics, initiatives)</li>
          <li>• Professional PDF generation with charts and tables</li>
          <li>• Secure storage with download links valid for 24 hours</li>
          <li>• Automatic polling for status updates during generation</li>
        </ul>
      </div>
    </div>
  );
}