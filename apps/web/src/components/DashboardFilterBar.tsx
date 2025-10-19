import { useEffect } from 'preact/hooks';
import { useAnalyticsStore } from '../stores/analyticsStore';

const periodOptions = [
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
  { value: '24m', label: 'Last 24 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' }
];

const scopeOptions = [
  { value: 'all', label: 'All Scopes', icon: '🌍' },
  { value: 'scope_1', label: 'Scope 1', icon: '🔥', description: 'Direct emissions' },
  { value: 'scope_2', label: 'Scope 2', icon: '⚡', description: 'Electricity indirect' },
  { value: 'scope_3', label: 'Scope 3', icon: '🚛', description: 'Other indirect' }
];

const groupByOptions = [
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' }
];

interface DashboardFilterBarProps {
  onFiltersChange?: () => void;
}

export default function DashboardFilterBar({ onFiltersChange }: DashboardFilterBarProps) {
  const { filters, setFilters, refreshAllData, timeseriesLoading, breakdownLoading } = useAnalyticsStore();
  
  const isLoading = timeseriesLoading || breakdownLoading;

  const handleFilterChange = (filterType: string, value: string) => {
    const newFilters = { [filterType]: value };
    setFilters(newFilters);
    
    // Trigger data refresh
    setTimeout(() => {
      refreshAllData();
      if (onFiltersChange) onFiltersChange();
    }, 100);
  };

  // Initial data load
  useEffect(() => {
    refreshAllData();
  }, []);

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-8">
        
        {/* Header */}
        <div class="flex-shrink-0">
          <h2 class="text-lg font-semibold text-gray-900">Analytics Dashboard</h2>
          <p class="text-sm text-gray-600 mt-1">
            Explore your emissions data with interactive filters and visualizations
          </p>
        </div>

        {/* Filters */}
        <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          
          {/* Time Period Filter */}
          <div class="flex flex-col">
            <label class="text-xs font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={filters.period}
              onChange={(e) => handleFilterChange('period', e.currentTarget.value)}
              disabled={isLoading}
              class={`px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              }`}
            >
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Filter */}
          <div class="flex flex-col">
            <label class="text-xs font-medium text-gray-700 mb-1">GHG Scope</label>
            <select
              value={filters.scope || 'all'}
              onChange={(e) => handleFilterChange('scope', e.currentTarget.value)}
              disabled={isLoading}
              class={`px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              }`}
            >
              {scopeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Group By Filter */}
          <div class="flex flex-col">
            <label class="text-xs font-medium text-gray-700 mb-1">Group By</label>
            <select
              value={filters.groupBy || 'month'}
              onChange={(e) => handleFilterChange('groupBy', e.currentTarget.value)}
              disabled={isLoading}
              class={`px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              }`}
            >
              {groupByOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <div class="flex flex-col justify-end">
            <button
              onClick={() => refreshAllData()}
              disabled={isLoading}
              class={`px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                isLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
              }`}
            >
              {isLoading ? (
                <>
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg class="-ml-1 mr-2 h-4 w-4 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Active Filters Summary */}
      <div class="mt-4 pt-4 border-t border-gray-200">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-gray-500">Active filters:</span>
          
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            📅 {periodOptions.find(p => p.value === filters.period)?.label || filters.period}
          </span>
          
          {filters.scope && filters.scope !== 'all' && (
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {scopeOptions.find(s => s.value === filters.scope)?.icon} {scopeOptions.find(s => s.value === filters.scope)?.label}
            </span>
          )}
          
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            📊 {groupByOptions.find(g => g.value === filters.groupBy)?.label || 'Monthly'}
          </span>
        </div>
      </div>
    </div>
  );
}