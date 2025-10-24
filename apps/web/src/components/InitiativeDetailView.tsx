// components/InitiativeDetailView.tsx - Comprehensive view of a single initiative with forecasts

import { useState } from 'preact/hooks';
import { usePlannerStore } from '../stores/plannerStore';
import ForecastChart from './ForecastChart';

export default function InitiativeDetailView() {
  const { 
    selectedInitiative, 
    loading, 
    error,
    updateInitiative 
  } = usePlannerStore();

  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  if (!selectedInitiative) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center justify-center h-96">
          <div class="text-center text-gray-500">
            <div class="text-4xl mb-2">📊</div>
            <div class="text-sm font-medium">No initiative selected</div>
            <div class="text-xs mt-1">Select an initiative from the list to view details</div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning': return '📋';
      case 'in_progress': return '⚙️';
      case 'completed': return '✅';
      case 'on_hold': return '⏸️';
      default: return '📊';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'on_hold': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const handleStatusEdit = () => {
    setNewStatus(selectedInitiative.status);
    setIsEditingStatus(true);
  };

  const handleStatusSave = async () => {
    if (newStatus !== selectedInitiative.status) {
      await updateInitiative(selectedInitiative.id, { status: newStatus as any });
    }
    setIsEditingStatus(false);
  };

  const handleStatusCancel = () => {
    setNewStatus('');
    setIsEditingStatus(false);
  };

  const statusOptions = [
    { value: 'planning', label: 'Planning' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' }
  ];

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">
              {selectedInitiative.name}
            </h2>
            {selectedInitiative.description && (
              <p class="text-gray-600 mb-4">
                {selectedInitiative.description}
              </p>
            )}
            
            {/* Status */}
            <div class="flex items-center space-x-3 mb-4">
              <span class="text-sm font-medium text-gray-700">Status:</span>
              {isEditingStatus ? (
                <div class="flex items-center space-x-2">
                  <select
                    value={newStatus}
                    onChange={(e: Event) => setNewStatus((e.target as HTMLSelectElement).value)}
                    class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleStatusSave}
                    disabled={loading}
                    class="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleStatusCancel}
                    class="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div class="flex items-center space-x-2">
                  <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedInitiative.status)}`}>
                    <span class="mr-1">{getStatusIcon(selectedInitiative.status)}</span>
                    {selectedInitiative.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <button
                    onClick={handleStatusEdit}
                    class="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          <div class="ml-6">
            <div class="text-right">
              <div class="text-3xl font-bold text-green-600 mb-1">
                {selectedInitiative.projectedCo2eReduction?.toFixed(2) || '0.00'} tCO₂e/yr
              </div>
              <div class="text-sm text-gray-500">
                Projected Annual Reduction
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timeline & Cost */}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Project Details</h3>
          <div class="space-y-4">
            <div>
              <dt class="text-sm font-medium text-gray-500">Start Date</dt>
              <dd class="mt-1 text-sm text-gray-900">
                {formatDate(selectedInitiative.startDate)}
              </dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">End Date</dt>
              <dd class="mt-1 text-sm text-gray-900">
                {formatDate(selectedInitiative.endDate)}
              </dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Estimated Cost</dt>
              <dd class="mt-1 text-sm text-gray-900">
                {formatCurrency(selectedInitiative.estimatedCost)}
              </dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500">Created</dt>
              <dd class="mt-1 text-sm text-gray-900">
                {formatDate(selectedInitiative.createdAt)}
              </dd>
            </div>
          </div>
        </div>

        {/* Impact Summary */}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Impact Summary</h3>
          <div class="space-y-4">
            <div>
              <dt class="text-sm font-medium text-gray-500">Projected Annual Reduction</dt>
              <dd class="mt-1 text-lg font-semibold text-green-600">
                {selectedInitiative.projectedCo2eReduction?.toFixed(2) || '0.00'} tCO₂e
              </dd>
            </div>
            
            {selectedInitiative.projectedCo2eReduction && selectedInitiative.estimatedCost && (
              <div>
                <dt class="text-sm font-medium text-gray-500">Cost per tonne CO₂e Saved</dt>
                <dd class="mt-1 text-lg font-semibold text-blue-600">
                  {formatCurrency(selectedInitiative.estimatedCost / selectedInitiative.projectedCo2eReduction)}
                </dd>
              </div>
            )}
            
            <div>
              <dt class="text-sm font-medium text-gray-500">10-Year Impact</dt>
              <dd class="mt-1 text-lg font-semibold text-purple-600">
                {((selectedInitiative.projectedCo2eReduction || 0) * 10).toFixed(1)} tCO₂e
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      {selectedInitiative.forecasts && selectedInitiative.forecasts.length > 0 ? (
        <ForecastChart 
          forecasts={selectedInitiative.forecasts}
          title="Emission Reduction Forecast"
        />
      ) : (
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Emission Reduction Forecast</h3>
          <div class="flex items-center justify-center h-64 bg-gray-50">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">⏳</div>
              <div class="text-sm font-medium">Generating forecast data...</div>
              <div class="text-xs mt-1">This may take a moment</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <div class="text-red-400">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-800">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}