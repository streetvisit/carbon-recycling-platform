import { useState, useEffect } from 'preact/hooks';
import { getIntegrationById, type Integration } from '../data/integrations';
// Note: useAuth will be handled differently in static build
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth';
import { getMockDataSources, type MockDataSource } from '../utils/mockData';

interface DataSource {
  id: string;
  provider: string;
  type: string;
  status: string;
  lastSyncedAt: string | null;
  integration_id?: string;
  metadata?: {
    name?: string;
    description?: string;
    setup_complexity?: string;
    estimated_setup_time?: string;
    data_types?: string[];
    emission_scopes?: string[];
  };
}

interface DataSourceListProps {
  customApiUrl?: string;
  onRefresh?: (fetchFunction: () => void) => void;
}

export default function DataSourceList({ customApiUrl, onRefresh }: DataSourceListProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Mock auth for static build - will be replaced with real auth in production
  const isSignedIn = true; // Always true for demo

  const fetchDataSources = async () => {
    if (!isSignedIn) {
      setError('Please sign in to view your data sources');
      setLoading(false);
      return;
    }

    const apiBaseUrl = customApiUrl || getApiBaseUrl();

    try {
      setLoading(true);
      
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/datasources`);

      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Failed to fetch data sources: ${response.status}`);
      }

      const data = await response.json();
      setDataSources(data.data || []);
      setError(null);
    } catch (err) {
      console.warn('API unavailable, loading mock data:', err);
      
      // Fallback to mock data
      try {
        const mockResponse = await getMockDataSources();
        setDataSources(mockResponse.data);
        setError(null);
      } catch (mockErr) {
        console.error('Error loading mock data:', mockErr);
        setError('Failed to load data sources');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteDataSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this data source?')) {
      return;
    }

    const apiBaseUrl = customApiUrl || getApiBaseUrl();

    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/datasources/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Failed to delete data source: ${response.status}`);
      }

      // Remove from local state
      setDataSources(prev => prev.filter(ds => ds.id !== id));
    } catch (err) {
      console.error('Error deleting data source:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete data source');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProviderIcon = (dataSource: DataSource) => {
    // First try to get icon from integration registry
    if (dataSource.integration_id) {
      const integration = getIntegrationById(dataSource.integration_id);
      if (integration) {
        return integration.logo;
      }
    }
    
    // Fallback to provider-based icons
    switch (dataSource.provider) {
      case 'aws':
        return '☁️';
      case 'azure':
        return '🔷';
      case 'edf_energy':
        return '⚡';
      case 'british_gas':
        return '⚡';
      case 'octopus_energy':
        return '🐙';
      case 'scottish_power':
        return '💨';
      case 'sse_energy':
        return '🔋';
      case 'eon_next':
        return '⚡';
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🧠';
      case 'google_cloud':
        return '☁️';
      case 'csv_fleet_data':
        return '🚛';
      case 'csv_facilities_data':
        return '🏢';
      case 'manual_entry':
        return '✏️';
      default:
        return '📊';
    }
  };
  
  const getProviderName = (dataSource: DataSource) => {
    // First try to get name from metadata or integration registry
    if (dataSource.metadata?.name) {
      return dataSource.metadata.name;
    }
    
    if (dataSource.integration_id) {
      const integration = getIntegrationById(dataSource.integration_id);
      if (integration) {
        return integration.name;
      }
    }
    
    // Fallback to formatted provider name
    return dataSource.provider.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  const getProviderDescription = (dataSource: DataSource) => {
    if (dataSource.metadata?.description) {
      return dataSource.metadata.description;
    }
    
    if (dataSource.integration_id) {
      const integration = getIntegrationById(dataSource.integration_id);
      if (integration) {
        return integration.description;
      }
    }
    
    return dataSource.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Expose fetchDataSources to parent component via callback
  useEffect(() => {
    if (onRefresh) {
      onRefresh(fetchDataSources);
    }
  }, [onRefresh]);

  useEffect(() => {
    fetchDataSources();
  }, []);

  if (loading) {
    return (
      <div class="bg-white shadow rounded-lg">
        <div class="p-6">
          <div class="flex items-center justify-center h-32">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="bg-white shadow rounded-lg">
        <div class="p-6">
          <div class="text-center">
            <div class="text-4xl mb-4">⚠️</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              Unable to connect to API
            </h3>
            <div class="text-red-600 text-sm mb-4">{error}</div>
            <p class="text-sm text-gray-500 mb-4">
              This is expected during development. The API backend is being configured.
              You can still explore the interface - mock data will be used where possible.
            </p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={fetchDataSources}
                class="text-green-600 hover:text-green-800 text-sm font-medium px-4 py-2 border border-green-300 rounded-md hover:bg-green-50 transition-colors"
              >
                Try again
              </button>
              <a 
                href="/dashboard/analytics"
                class="text-blue-600 hover:text-blue-800 text-sm font-medium px-4 py-2 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
              >
                View Analytics Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (dataSources.length === 0) {
    return (
      <div class="bg-white shadow rounded-lg">
        <div class="p-6">
          <div class="text-center">
            <div class="text-4xl mb-4">📊</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              No data sources connected
            </h3>
            <p class="text-sm text-gray-500 mb-4">
              Get started by connecting your first data source to begin tracking your carbon emissions.
            </p>
            <button 
              onClick={() => document.getElementById('add-datasource-btn')?.click()}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Add Your First Data Source
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">Connected Data Sources</h2>
      </div>
      <div class="divide-y divide-gray-200">
        {dataSources.map((dataSource) => {
          const integration = dataSource.integration_id ? getIntegrationById(dataSource.integration_id) : null;
          
          return (
            <div key={dataSource.id} class="p-6">
              <div class="flex items-start justify-between">
                <div class="flex items-start">
                  <div class="text-3xl mr-4">
                    {getProviderIcon(dataSource)}
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center mb-1">
                      <h3 class="text-lg font-medium text-gray-900 mr-3">
                        {getProviderName(dataSource)}
                      </h3>
                      <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dataSource.status)}`}>
                        {dataSource.status.charAt(0).toUpperCase() + dataSource.status.slice(1)}
                      </span>
                    </div>
                    
                    <p class="text-sm text-gray-600 mb-3 max-w-2xl">
                      {getProviderDescription(dataSource)}
                    </p>
                    
                    <div class="flex flex-wrap gap-4 text-sm text-gray-500">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Last sync: {formatDate(dataSource.lastSyncedAt)}
                      </div>
                      
                      <div class="flex items-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Type: {dataSource.type.replace(/_/g, ' ')}
                      </div>
                      
                      {integration && (
                        <div class="flex items-center">
                          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Setup: {integration.setup_complexity} ({integration.estimated_setup_time})
                        </div>
                      )}
                    </div>
                    
                    {(dataSource.metadata?.data_types || integration?.data_types) && (
                      <div class="mt-3">
                        <div class="text-xs text-gray-500 mb-1">Data Types:</div>
                        <div class="flex flex-wrap gap-1">
                          {(dataSource.metadata?.data_types || integration?.data_types || []).slice(0, 4).map(type => (
                            <span key={type} class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {type.replace('_', ' ')}
                            </span>
                          ))}
                          {(dataSource.metadata?.data_types || integration?.data_types || []).length > 4 && (
                            <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              +{(dataSource.metadata?.data_types || integration?.data_types || []).length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {(dataSource.metadata?.emission_scopes || integration?.emission_scopes) && (
                      <div class="mt-2">
                        <div class="text-xs text-gray-500 mb-1">Emission Scopes:</div>
                        <div class="flex flex-wrap gap-1">
                          {(dataSource.metadata?.emission_scopes || integration?.emission_scopes || []).map(scope => (
                            <span key={scope} class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {scope.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div class="flex items-center space-x-2 ml-4">
                  {integration?.has_setup_guide && (
                    <button 
                      onClick={() => window.open(`/integrations/${dataSource.integration_id}`, '_blank')}
                      class="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                      title="View integration guide"
                    >
                      <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Guide
                    </button>
                  )}
                  <button 
                    onClick={() => deleteDataSource(dataSource.id)}
                    class="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 border border-red-200 rounded hover:bg-red-50 transition-colors"
                    title="Delete data source"
                  >
                    <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
