/**
 * Basic integrations registry for API
 */

export interface Integration {
  id: string;
  name: string;
  provider: string;
  category: 'energy' | 'cloud' | 'ai' | 'transport' | 'finance' | 'enterprise' | 'manufacturing' | 'retail' | 'utilities' | 'other';
  type: 'oauth' | 'api_key' | 'file_upload' | 'manual_entry' | 'webhook';
  description: string;
  logo: string;
  status: 'production' | 'beta' | 'development';
  authentication_guide: string;
  setup_complexity: 'easy' | 'medium' | 'complex';
  estimated_setup_time: string;
  data_types: string[];
  emission_scopes: ('scope1' | 'scope2' | 'scope3')[];
  has_info_page: boolean;
  has_setup_guide: boolean;
  has_faq: boolean;
  api_documentation_url?: string;
  official_website?: string;
}

// Basic integrations for API functionality
export const allIntegrations: Integration[] = [
  {
    id: 'british-gas',
    name: 'British Gas',
    provider: 'british_gas',
    category: 'energy',
    type: 'oauth',
    description: 'Connect to British Gas Business accounts for electricity and gas consumption data',
    logo: '⚡',
    status: 'production',
    authentication_guide: 'OAuth 2.0 client credentials flow with business API access',
    setup_complexity: 'medium',
    estimated_setup_time: '15-30 minutes',
    data_types: ['electricity_consumption', 'gas_consumption', 'costs', 'tariff_details'],
    emission_scopes: ['scope1', 'scope2'],
    has_info_page: true,
    has_setup_guide: true,
    has_faq: true,
    official_website: 'https://www.britishgas.co.uk/business'
  },
  {
    id: 'octopus-energy',
    name: 'Octopus Energy',
    provider: 'octopus_energy',
    category: 'energy',
    type: 'api_key',
    description: 'Industry-leading API for smart meter data and renewable energy tracking',
    logo: '🐙',
    status: 'production',
    authentication_guide: 'API key authentication with excellent developer documentation',
    setup_complexity: 'easy',
    estimated_setup_time: '5-15 minutes',
    data_types: ['smart_meter_data', 'tariff_info', 'renewable_energy', 'agile_pricing'],
    emission_scopes: ['scope2'],
    has_info_page: true,
    has_setup_guide: true,
    has_faq: true,
    api_documentation_url: 'https://developer.octopus.energy/',
    official_website: 'https://octopus.energy/business'
  },
  {
    id: 'openai-carbon',
    name: 'OpenAI',
    provider: 'openai',
    category: 'ai',
    type: 'api_key',
    description: 'Track AI usage emissions from GPT models and API calls',
    logo: '🤖',
    status: 'production',
    authentication_guide: 'API key authentication with usage tracking',
    setup_complexity: 'easy',
    estimated_setup_time: '5-15 minutes',
    data_types: ['token_usage', 'model_usage', 'api_costs', 'compute_time'],
    emission_scopes: ['scope2'],
    has_info_page: true,
    has_setup_guide: true,
    has_faq: true,
    api_documentation_url: 'https://platform.openai.com/docs',
    official_website: 'https://openai.com'
  },
  {
    id: 'anthropic-carbon',
    name: 'Anthropic',
    provider: 'anthropic',
    category: 'ai',
    type: 'api_key',
    description: 'Track Claude AI usage and compute emissions',
    logo: '🧠',
    status: 'production',
    authentication_guide: 'API key authentication for Claude usage data',
    setup_complexity: 'easy',
    estimated_setup_time: '5-15 minutes',
    data_types: ['token_usage', 'model_usage', 'api_costs'],
    emission_scopes: ['scope2'],
    has_info_page: true,
    has_setup_guide: true,
    has_faq: true,
    api_documentation_url: 'https://docs.anthropic.com/',
    official_website: 'https://www.anthropic.com'
  }
];

// Helper functions
export function getIntegrationsByCategory(category: string): Integration[] {
  return allIntegrations.filter(integration => integration.category === category);
}

export function getProductionIntegrations(): Integration[] {
  return allIntegrations.filter(integration => integration.status === 'production');
}

export function searchIntegrations(query: string): Integration[] {
  const searchTerm = query.toLowerCase();
  return allIntegrations.filter(integration => 
    integration.name.toLowerCase().includes(searchTerm) ||
    integration.provider.toLowerCase().includes(searchTerm) ||
    integration.description.toLowerCase().includes(searchTerm) ||
    integration.category.toLowerCase().includes(searchTerm)
  );
}
