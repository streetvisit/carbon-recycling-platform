// components/InitiativeList.tsx - Main list view for all reduction initiatives

import { useEffect } from 'preact/hooks';
import { usePlannerStore } from '../stores/plannerStore';

export default function InitiativeList() {
  const { 
    initiatives, 
    loading, 
    error,
    selectedInitiative,
    fetchInitiatives,
    fetchInitiativeDetails,
    setShowCreateModal,
    deleteInitiative
  } = usePlannerStore();

  useEffect(() => {
    fetchInitiatives();
  }, []);

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
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on_hold': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const handleInitiativeClick = (id: string) => {
    fetchInitiativeDetails(id);
  };

  const handleDeleteClick = async (e: Event, id: string) => {
    e.stopPropagation(); // Prevent row click
    if (confirm('Are you sure you want to delete this initiative?')) {
      await deleteInitiative(id);
    }
  };

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Decarbonisation Initiatives</h2>
            <p class="text-sm text-gray-600 mt-1">
              Manage and track your emission reduction projects
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
          >
            <span class="mr-2">+</span>
            New Initiative
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        {loading ? (
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <div class="text-sm text-gray-600">Loading initiatives...</div>
            </div>
          </div>
        ) : error ? (
          <div class="flex items-center justify-center h-64 bg-red-50">
            <div class="text-center text-red-600">
              <div class="text-2xl mb-2">⚠️</div>
              <div class="text-sm font-medium">Error loading initiatives</div>
              <div class="text-xs mt-1">{error}</div>
            </div>
          </div>
        ) : initiatives.length === 0 ? (
          <div class="flex items-center justify-center h-64 bg-gray-50">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">🎯</div>
              <div class="text-sm font-medium">No initiatives yet</div>
              <div class="text-xs mt-1">Click "New Initiative" to create your first decarbonisation project</div>
            </div>
          </div>
        ) : (
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initiative Name
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projected Reduction
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timeline
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {initiatives.map((initiative) => (
                <tr 
                  key={initiative.id} 
                  class={`cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedInitiative?.id === initiative.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                  }`}
                  onClick={() => handleInitiativeClick(initiative.id)}
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div class="text-sm font-medium text-gray-900">
                        {initiative.name}
                      </div>
                      {initiative.description && (
                        <div class="text-xs text-gray-500 mt-1 max-w-xs truncate">
                          {initiative.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(initiative.status)}`}>
                      <span class="mr-1">{getStatusIcon(initiative.status)}</span>
                      {initiative.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-semibold text-gray-900">
                      {initiative.projectedCo2eReduction ? 
                        `${initiative.projectedCo2eReduction.toFixed(2)} tCO₂e/yr` : 
                        'Calculating...'
                      }
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                      <div class="flex items-center space-x-2">
                        <span class="text-xs text-gray-500">Start:</span>
                        <span class="font-medium">{formatDate(initiative.startDate)}</span>
                      </div>
                      {initiative.endDate && (
                        <div class="flex items-center space-x-2 mt-1">
                          <span class="text-xs text-gray-500">End:</span>
                          <span class="font-medium">{formatDate(initiative.endDate)}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => handleDeleteClick(e, initiative.id)}
                      class="text-red-600 hover:text-red-900 text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {initiatives.length > 0 && (
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between text-sm">
            <div class="text-gray-600">
              {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''} • Total potential reduction: {' '}
              <span class="font-semibold text-green-600">
                {initiatives
                  .reduce((sum, init) => sum + (init.projectedCo2eReduction || 0), 0)
                  .toFixed(2)} tCO₂e/yr
              </span>
            </div>
            <div class="text-gray-500">
              Click on an initiative to view details
            </div>
          </div>
        </div>
      )}
    </div>
  );
}