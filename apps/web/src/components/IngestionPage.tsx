import { useState } from 'preact/hooks';
import DataSourceList from './DataSourceList';
import AddDataSourceModal from './AddDataSourceModal';
import { getApiBaseUrl } from '../utils/auth';

interface IngestionPageProps {
  customApiUrl?: string;
}

export default function IngestionPage({ customApiUrl }: IngestionPageProps) {
  const apiBaseUrl = customApiUrl || getApiBaseUrl();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshFunction, setRefreshFunction] = useState<(() => void) | null>(null);

  const handleModalSuccess = () => {
    // Refresh the data sources list when a new source is added
    if (refreshFunction) {
      refreshFunction();
    }
  };

  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <header class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-6">
            <div>
              <h1 class="text-3xl font-bold text-gray-900">Data Ingestion Hub</h1>
              <p class="mt-2 text-sm text-gray-600">
                Connect and manage your carbon data sources
              </p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
              Add New Data Source
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="space-y-8">
          <DataSourceList 
            onRefresh={setRefreshFunction}
            customApiUrl={apiBaseUrl} 
          />
        </div>
      </main>

      {/* Modal */}
      <AddDataSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        customApiUrl={apiBaseUrl}
      />
    </div>
  );
}