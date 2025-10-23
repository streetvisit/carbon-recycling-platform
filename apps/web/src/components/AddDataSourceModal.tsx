import { useState, useEffect } from 'preact/hooks';
import { allIntegrations, getIntegrationsByCategory, type Integration } from '../data/integrations';
import Clerk from '@clerk/clerk-js';

// Initialize Clerk instance
let clerkInstance: Clerk | null = null;

function useAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function initClerk() {
      if (typeof window === 'undefined') return;
      
      try {
        // Get publishable key from env or window
        const publishableKey = (window as any).__CLERK_PUBLISHABLE_KEY || 
                              import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
        
        if (!publishableKey) {
          console.warn('Clerk publishable key not found');
          setIsLoaded(true);
          return;
        }

        if (!clerkInstance) {
          clerkInstance = new Clerk(publishableKey);
          await clerkInstance.load();
        }
        
        setIsSignedIn(!!clerkInstance.user);
        setIsLoaded(true);

        // Listen for auth changes
        clerkInstance.addListener((event) => {
          setIsSignedIn(!!clerkInstance?.user);
        });
      } catch (error) {
        console.error('Failed to initialize Clerk:', error);
        setIsLoaded(true);
      }
    }

    initClerk();
  }, []);

  const getToken = async () => {
    if (!clerkInstance?.session) return null;
    return clerkInstance.session.getToken();
  };

  return { isSignedIn, isLoaded, getToken };
}
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth';

interface AddDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customApiUrl?: string;
}

// Convert integration type to API type
const getApiType = (integration: Integration) => {
  switch (integration.type) {
    case 'oauth':
    case 'api_key':
      return 'api_integration';
    case 'file_upload':
      return 'file_upload';
    case 'manual_entry':
      return 'manual_entry';
    case 'webhook':
      return 'webhook';
    default:
      return 'manual_entry';
  }
};

export default function AddDataSourceModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  customApiUrl
}: AddDataSourceModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { getToken, isSignedIn } = useAuth();
  
  // Filter integrations based on category and search
  const filteredIntegrations = allIntegrations.filter(integration => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const categories = [
    { value: 'all', label: 'All Integrations' },
    { value: 'energy', label: 'Energy Suppliers' },
    { value: 'ai', label: 'AI Platforms' },
    { value: 'cloud', label: 'Cloud Infrastructure' },
    { value: 'transport', label: 'Transport & Fleet' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'enterprise', label: 'Enterprise Software' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'retail', label: 'Retail & E-commerce' },
    { value: 'utilities', label: 'Utilities & Water' },
    { value: 'other', label: 'Other' }
  ];

  const handleConnect = async (integration: Integration) => {
    if (!isSignedIn) {
      setError('Please sign in to connect integrations');
      return;
    }

    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    setIsConnecting(true);
    setError(null);

    try {
      let credentials = {};
      
      // Handle different authentication types
      if (integration.type === 'api_key') {
        const apiKey = prompt(`Enter your ${integration.name} API key:`);
        if (!apiKey) {
          setIsConnecting(false);
          return;
        }
        credentials = { apiKey };
      }

      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/datasources`, {
        method: 'POST',
        body: JSON.stringify({
          integration_id: integration.id,
          authentication_type: integration.type,
          category: integration.category,
          credentials,
          metadata: {
            name: integration.name,
            description: integration.description,
            setup_complexity: integration.setup_complexity,
            estimated_setup_time: integration.estimated_setup_time,
            data_types: integration.data_types,
            emission_scopes: integration.emission_scopes
          }
        }),
      });

      if (!response.ok) {
        handleAuthError(response);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create data source: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle OAuth flow - redirect to authorization URL
      if (result.auth_url) {
        window.location.href = result.auth_url;
        return;
      }

      // Success - close modal and refresh list
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error connecting integration:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsConnecting(false);
    }
  };
  
  const getStatusBadge = (integration: Integration) => {
    const statusColors = {
      production: 'bg-green-100 text-green-800',
      beta: 'bg-yellow-100 text-yellow-800', 
      development: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[integration.status]}`}>
        {integration.status}
      </span>
    );
  };
  
  const getComplexityBadge = (complexity: string) => {
    const complexityColors = {
      easy: 'bg-green-50 text-green-700 border-green-200',
      medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      complex: 'bg-red-50 text-red-700 border-red-200'
    };
    
    return (
      <span class={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${complexityColors[complexity]}`}>
        {complexity}
      </span>
    );
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
        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full sm:p-6">
          <div>
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-lg leading-6 font-medium text-gray-900">
                  Add New Data Source
                </h3>
                <p class="text-sm text-gray-600 mt-1">
                  Connect to one of {allIntegrations.length}+ available integrations
                </p>
              </div>
              <button 
                onClick={onClose}
                class="text-gray-400 hover:text-gray-600"
              >
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search and Filters */}
            <div class="mb-6 space-y-4">
              <div class="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div class="flex-1">
                  <input
                    type="text"
                    placeholder="Search integrations..."
                    value={searchQuery}
                    onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                {/* Category Filter */}
                <div class="sm:w-64">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Results count */}
              <div class="text-sm text-gray-600">
                Showing {filteredIntegrations.length} of {allIntegrations.length} integrations
              </div>
            </div>

            {error && (
              <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            {/* Integration Grid */}
            <div class="max-h-96 overflow-y-auto">
              {filteredIntegrations.length === 0 ? (
                <div class="text-center py-8">
                  <div class="text-gray-400 text-4xl mb-4">🔍</div>
                  <p class="text-gray-600">No integrations found matching your criteria</p>
                </div>
              ) : (
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredIntegrations.map((integration) => (
                    <div key={integration.id} class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors border">
                      <div class="flex items-start justify-between mb-3">
                        <div class="text-2xl">{integration.logo}</div>
                        <div class="flex gap-1">
                          {getStatusBadge(integration)}
                        </div>
                      </div>
                      
                      <h4 class="text-sm font-medium text-gray-900 mb-1">
                        {integration.name}
                      </h4>
                      
                      <p class="text-xs text-gray-600 mb-2 line-clamp-2">
                        {integration.description}
                      </p>
                      
                      <div class="flex items-center justify-between mb-3">
                        {getComplexityBadge(integration.setup_complexity)}
                        <span class="text-xs text-gray-500">
                          {integration.estimated_setup_time}
                        </span>
                      </div>
                      
                      <div class="mb-3">
                        <div class="text-xs text-gray-500 mb-1">Authentication:</div>
                        <div class="text-xs font-medium text-gray-700">
                          {integration.type.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      
                      {integration.has_setup_guide && (
                        <div class="text-xs text-green-600 mb-2 flex items-center">
                          <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                          </svg>
                          Setup guide available
                        </div>
                      )}
                      
                      <button
                        onClick={() => handleConnect(integration)}
                        disabled={isConnecting || integration.status === 'development'}
                        class={`w-full text-xs px-3 py-2 rounded-md font-medium transition-colors ${
                          integration.status === 'development'
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : isConnecting
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                        }`}
                        title={integration.status === 'development' ? 'Coming soon - in development' : ''}
                      >
                        {integration.status === 'development' ? 'Coming Soon' : isConnecting ? 'Connecting...' : 'Connect'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
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