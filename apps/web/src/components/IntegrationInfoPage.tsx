import { useEffect, useState } from 'preact/hooks';
import { getIntegrationById, type Integration } from '../data/integrations';

interface IntegrationInfoPageProps {
  integrationId: string;
}

export default function IntegrationInfoPage({ integrationId }: IntegrationInfoPageProps) {
  const [integration, setIntegration] = useState<Integration | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'overview' | 'setup' | 'faq' | 'api-docs'>('overview');
  
  useEffect(() => {
    const foundIntegration = getIntegrationById(integrationId);
    setIntegration(foundIntegration);
  }, [integrationId]);
  
  if (!integration) {
    return (
      <div class="min-h-screen bg-gray-50 flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-4">❓</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Integration Not Found</h1>
          <p class="text-gray-600">The requested integration could not be found.</p>
        </div>
      </div>
    );
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'production':
        return 'bg-green-100 text-green-800';
      case 'beta':
        return 'bg-yellow-100 text-yellow-800';
      case 'development':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'easy':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'complex':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };
  
  const renderOverviewTab = () => (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 mb-3">About this Integration</h3>
        <p class="text-gray-700">{integration.description}</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 class="text-md font-medium text-gray-900 mb-3">Integration Details</h4>
          <dl class="space-y-2">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-600">Status:</dt>
              <dd>
                <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                  {integration.status}
                </span>
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-600">Authentication:</dt>
              <dd class="text-sm font-medium text-gray-900">
                {integration.type.replace('_', ' ').toUpperCase()}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-600">Setup Complexity:</dt>
              <dd class={`text-sm font-medium ${getComplexityColor(integration.setup_complexity)}`}>
                {integration.setup_complexity}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-600">Estimated Setup Time:</dt>
              <dd class="text-sm font-medium text-gray-900">{integration.estimated_setup_time}</dd>
            </div>
          </dl>
        </div>
        
        <div>
          <h4 class="text-md font-medium text-gray-900 mb-3">Data & Emissions</h4>
          <div class="space-y-3">
            <div>
              <h5 class="text-sm font-medium text-gray-700 mb-1">Data Types:</h5>
              <div class="flex flex-wrap gap-1">
                {integration.data_types.map(type => (
                  <span key={type} class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h5 class="text-sm font-medium text-gray-700 mb-1">Emission Scopes:</h5>
              <div class="flex flex-wrap gap-1">
                {integration.emission_scopes.map(scope => (
                  <span key={scope} class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {scope.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {integration.official_website && (
        <div>
          <h4 class="text-md font-medium text-gray-900 mb-2">Official Resources</h4>
          <div class="flex gap-4">
            <a 
              href={integration.official_website}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Visit Official Website
              <svg class="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {integration.api_documentation_url && (
              <a 
                href={integration.api_documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                API Documentation
                <svg class="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
  
  const renderSetupTab = () => (
    <div class="space-y-6">
      {integration.has_setup_guide ? (
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Setup Guide</h3>
          
          <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div class="flex">
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Estimated setup time:</strong> {integration.estimated_setup_time}
                </p>
                <p class="text-sm text-blue-700">
                  <strong>Difficulty level:</strong> {integration.setup_complexity}
                </p>
              </div>
            </div>
          </div>
          
          <div class="prose max-w-none">
            <h4>Prerequisites</h4>
            <ul>
              <li>Active {integration.name} account with appropriate permissions</li>
              <li>Access to your organization's carbon tracking dashboard</li>
              {integration.type === 'oauth' && <li>Admin rights to authorize third-party applications</li>}
              {integration.type === 'api_key' && <li>Ability to generate or access API keys</li>}
            </ul>
            
            <h4>Step-by-step Instructions</h4>
            
            {integration.type === 'oauth' && (
              <>
                <p><strong>OAuth Setup:</strong></p>
                <ol>
                  <li>Click the "Connect" button in the CarbonRecycling.co.uk dashboard</li>
                  <li>You'll be redirected to {integration.name}'s authorization page</li>
                  <li>Sign in with your {integration.name} account credentials</li>
                  <li>Review the permissions and click "Authorize"</li>
                  <li>You'll be redirected back to complete the setup</li>
                </ol>
              </>
            )}
            
            {integration.type === 'api_key' && (
              <>
                <p><strong>API Key Setup:</strong></p>
                <ol>
                  <li>Log in to your {integration.name} account</li>
                  <li>Navigate to API settings or developer section</li>
                  <li>Generate a new API key with read permissions for usage data</li>
                  <li>Copy the API key (keep it secure!)</li>
                  <li>Return to CarbonRecycling.co.uk and paste the API key when prompted</li>
                </ol>
              </>
            )}
            
            <h4>Data Synchronization</h4>
            <p>Once connected, the integration will automatically:</p>
            <ul>
              <li>Import historical data (typically last 12 months)</li>
              <li>Sync new data daily</li>
              <li>Calculate emissions based on your usage patterns</li>
              <li>Update your carbon footprint dashboard</li>
            </ul>
          </div>
        </div>
      ) : (
        <div class="text-center py-8">
          <div class="text-gray-400 text-4xl mb-4">📖</div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Setup Guide Coming Soon</h3>
          <p class="text-gray-600">
            We're working on a comprehensive setup guide for {integration.name}.
          </p>
        </div>
      )}
    </div>
  );
  
  const renderFaqTab = () => (
    <div class="space-y-6">
      {integration.has_faq ? (
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Frequently Asked Questions</h3>
          
          <div class="space-y-6">
            <div>
              <h4 class="text-md font-medium text-gray-900 mb-2">
                How accurate are the emissions calculations?
              </h4>
              <p class="text-gray-700">
                Our emissions calculations are based on the latest emission factors from government agencies and industry standards. 
                For {integration.name}, we use {integration.category === 'energy' ? 'grid-specific emission factors' : 'industry-standard conversion rates'} 
                updated monthly for maximum accuracy.
              </p>
            </div>
            
            <div>
              <h4 class="text-md font-medium text-gray-900 mb-2">
                How often is data synchronized?
              </h4>
              <p class="text-gray-700">
                Data from {integration.name} is synchronized daily. Historical data is imported during the initial setup, 
                and new usage data is automatically pulled every 24 hours.
              </p>
            </div>
            
            <div>
              <h4 class="text-md font-medium text-gray-900 mb-2">
                What data is collected from {integration.name}?
              </h4>
              <p class="text-gray-700">
                We only collect the minimum data necessary for carbon footprint calculations:
              </p>
              <ul class="list-disc list-inside text-gray-700 mt-2">
                {integration.data_types.map(type => (
                  <li key={type}>{type.replace('_', ' ').toLowerCase()}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 class="text-md font-medium text-gray-900 mb-2">
                Can I disconnect this integration later?
              </h4>
              <p class="text-gray-700">
                Yes, you can disconnect {integration.name} at any time from your integrations dashboard. 
                This will stop future data synchronization, but historical data and calculations will be preserved 
                for reporting purposes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div class="text-center py-8">
          <div class="text-gray-400 text-4xl mb-4">❓</div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">FAQ Coming Soon</h3>
          <p class="text-gray-600">
            We're preparing answers to common questions about {integration.name} integration.
          </p>
        </div>
      )}
    </div>
  );
  
  return (
    <div class="min-h-screen bg-gray-50">
      {/* Header */}
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between py-6">
            <div class="flex items-center">
              <div class="text-4xl mr-4">{integration.logo}</div>
              <div>
                <h1 class="text-3xl font-bold text-gray-900">{integration.name}</h1>
                <p class="text-gray-600">{integration.authentication_guide}</p>
              </div>
            </div>
            <div class="flex items-center space-x-4">
              <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(integration.status)}`}>
                {integration.status}
              </span>
              <button class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                Connect Integration
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div class="bg-white border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav class="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'setup', label: 'Setup Guide' },
              { id: 'faq', label: 'FAQ' },
              ...(integration.api_documentation_url ? [{ id: 'api-docs', label: 'API Docs' }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                class={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'setup' && renderSetupTab()}
        {activeTab === 'faq' && renderFaqTab()}
        {activeTab === 'api-docs' && integration.api_documentation_url && (
          <div class="h-96">
            <iframe 
              src={integration.api_documentation_url}
              class="w-full h-full border rounded-lg"
              title={`${integration.name} API Documentation`}
            />
          </div>
        )}
      </div>
    </div>
  );
}