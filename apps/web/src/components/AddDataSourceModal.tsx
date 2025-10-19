import { useState } from 'preact/hooks';

interface Integration {
  id: string;
  name: string;
  provider: string;
  type: 'api_integration' | 'file_upload' | 'manual_entry';
  description: string;
  logo: string;
}

interface AddDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl?: string;
}

const integrations: Integration[] = [
  {
    id: 'aws',
    name: 'Amazon Web Services',
    provider: 'aws',
    type: 'api_integration',
    description: 'Connect your AWS account to pull EC2, S3, and other service usage data',
    logo: '☁️'
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    provider: 'azure',
    type: 'api_integration',
    description: 'Integrate with Azure services for cloud infrastructure emissions',
    logo: '🔷'
  },
  {
    id: 'edf_energy',
    name: 'EDF Energy',
    provider: 'edf_energy',
    type: 'api_integration',
    description: 'Connect to your EDF Energy account for electricity consumption data',
    logo: '⚡'
  },
  {
    id: 'csv_fleet',
    name: 'Fleet Data Upload',
    provider: 'csv_fleet_data',
    type: 'file_upload',
    description: 'Upload CSV files containing vehicle fleet and fuel consumption data',
    logo: '🚛'
  },
  {
    id: 'csv_facilities',
    name: 'Facilities Data Upload',
    provider: 'csv_facilities_data',
    type: 'file_upload',
    description: 'Upload CSV files with office and facility energy consumption data',
    logo: '🏢'
  },
  {
    id: 'manual_entry',
    name: 'Manual Data Entry',
    provider: 'manual_entry',
    type: 'manual_entry',
    description: 'Manually input emission data for smaller data sources',
    logo: '✏️'
  }
];

export default function AddDataSourceModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  apiBaseUrl = 'http://localhost:8787' 
}: AddDataSourceModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (integration: Integration) => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/datasources`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: integration.type,
          provider: integration.provider,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create data source');
      }

      // Success - close modal and refresh list
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal positioning element */}
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <div>
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg leading-6 font-medium text-gray-900">
                Add New Data Source
              </h3>
              <button 
                onClick={onClose}
                class="text-gray-400 hover:text-gray-600"
              >
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => (
                <div key={integration.id} class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  <div class="flex items-start">
                    <div class="text-2xl mr-3">{integration.logo}</div>
                    <div class="flex-1">
                      <h4 class="text-sm font-medium text-gray-900 mb-1">
                        {integration.name}
                      </h4>
                      <p class="text-xs text-gray-600 mb-3">
                        {integration.description}
                      </p>
                      <button
                        onClick={() => handleConnect(integration)}
                        disabled={isConnecting}
                        class={`w-full text-xs px-3 py-2 rounded-md font-medium transition-colors ${
                          isConnecting
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                        }`}
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}