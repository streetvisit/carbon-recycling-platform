import { useState } from 'preact/hooks';
import { useAnalyticsStore, BreakdownDataPoint } from '../stores/analyticsStore';

type SortField = 'category' | 'scope' | 'totalCo2e' | 'percentage';
type SortDirection = 'asc' | 'desc';

export default function CategoryBreakdownTable() {
  const { breakdownData, breakdownLoading, breakdownError } = useAnalyticsStore();
  const [sortField, setSortField] = useState<SortField>('totalCo2e');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'scope_1':
        return '🔥';
      case 'scope_2':
        return '⚡';
      case 'scope_3':
        return '🚛';
      default:
        return '📊';
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'scope_1':
        return 'bg-red-100 text-red-800';
      case 'scope_2':
        return 'bg-orange-100 text-orange-800';
      case 'scope_3':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'category' || field === 'scope' ? 'asc' : 'desc');
    }
  };

  const sortedData = [...breakdownData].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle numeric values
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Handle string values
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    }

    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    );
  };

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Category Breakdown</h3>
            <p class="text-sm text-gray-600 mt-1">
              Detailed emissions by category and scope
            </p>
          </div>
          <div class="text-sm text-gray-500">
            {breakdownData.length} {breakdownData.length === 1 ? 'category' : 'categories'}
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        {breakdownLoading ? (
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <div class="text-sm text-gray-600">Loading breakdown data...</div>
            </div>
          </div>
        ) : breakdownError ? (
          <div class="flex items-center justify-center h-64 bg-red-50">
            <div class="text-center text-red-600">
              <div class="text-2xl mb-2">⚠️</div>
              <div class="text-sm font-medium">Error loading breakdown data</div>
              <div class="text-xs mt-1">{breakdownError}</div>
            </div>
          </div>
        ) : breakdownData.length === 0 ? (
          <div class="flex items-center justify-center h-64 bg-gray-50">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">📊</div>
              <div class="text-sm font-medium">No breakdown data available</div>
              <div class="text-xs mt-1">Calculate emissions to see category breakdown</div>
            </div>
          </div>
        ) : (
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('category')}
                >
                  <div class="flex items-center space-x-1">
                    <span>Category</span>
                    <SortIcon field="category" />
                  </div>
                </th>
                <th 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('scope')}
                >
                  <div class="flex items-center space-x-1">
                    <span>Scope</span>
                    <SortIcon field="scope" />
                  </div>
                </th>
                <th 
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('totalCo2e')}
                >
                  <div class="flex items-center justify-end space-x-1">
                    <span>Emissions (tCO₂e)</span>
                    <SortIcon field="totalCo2e" />
                  </div>
                </th>
                <th 
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('percentage')}
                >
                  <div class="flex items-center justify-end space-x-1">
                    <span>% of Total</span>
                    <SortIcon field="percentage" />
                  </div>
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visualization
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {sortedData.map((item, index) => (
                <tr key={`${item.category}-${item.scope}`} class="hover:bg-gray-50 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {item.category}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScopeColor(item.scope)}`}>
                      <span class="mr-1">{getScopeIcon(item.scope)}</span>
                      {item.scope.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-semibold text-gray-900">
                      {item.totalCo2e.toFixed(2)}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm text-gray-900 font-medium">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="w-20 bg-gray-200 rounded-full h-2 ml-auto">
                      <div 
                        class="bg-green-600 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(item.percentage, 2)}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {breakdownData.length > 0 && (
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between text-sm">
            <div class="text-gray-600">
              Total emissions from {breakdownData.length} source{breakdownData.length !== 1 ? 's' : ''}
            </div>
            <div class="font-semibold text-gray-900">
              {breakdownData.reduce((sum, item) => sum + item.totalCo2e, 0).toFixed(2)} tCO₂e
            </div>
          </div>
        </div>
      )}
    </div>
  );
}