import { useState, useEffect } from 'preact/hooks';

interface DataSource {
  id: string;
  provider: string;
  type: string;
  status: string;
  lastSyncedAt: string | null;
}

interface DataSourceListProps {
  apiBaseUrl?: string;
  onRefresh?: (fetchFunction: () => void) => void;
}

export default function DataSourceList({ apiBaseUrl = 'http://localhost:8787', onRefresh }: DataSourceListProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/v1/datasources`, {
        headers: {
          'Authorization': 'Bearer mock-token', // Mock auth for now
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data sources');
      }

      const data = await response.json();
      setDataSources(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const deleteDataSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this data source?')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/datasources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete data source');
      }

      // Remove from local state
      setDataSources(prev => prev.filter(ds => ds.id !== id));
    } catch (err) {
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

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'aws':
        return '☁️';
      case 'azure':
        return '🔷';
      case 'edf_energy':
        return '⚡';
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
            <div class="text-red-600 text-sm">{error}</div>
            <button 
              onClick={fetchDataSources}
              class="mt-2 text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Try again
            </button>
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
        {dataSources.map((dataSource) => (
          <div key={dataSource.id} class="p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="text-2xl mr-4">
                  {getProviderIcon(dataSource.provider)}
                </div>
                <div>
                  <h3 class="text-sm font-medium text-gray-900">
                    {dataSource.provider.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h3>
                  <p class="text-sm text-gray-500">
                    {dataSource.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
              </div>
              <div class="flex items-center space-x-4">
                <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dataSource.status)}`}>
                  {dataSource.status.charAt(0).toUpperCase() + dataSource.status.slice(1)}
                </span>
                <div class="text-sm text-gray-500">
                  <div>Last sync:</div>
                  <div>{formatDate(dataSource.lastSyncedAt)}</div>
                </div>
                <button 
                  onClick={() => deleteDataSource(dataSource.id)}
                  class="text-red-600 hover:text-red-800 text-sm font-medium"
                  title="Delete data source"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
