/**
 * UK Government Data Sources Registry
 * 
 * Comprehensive registry of UK government emissions data sources,
 * reports, and APIs for gap analysis and benchmarking
 */

export interface UKDataSource {
  id: string;
  name: string;
  department: 'DEFRA' | 'ONS' | 'BEIS' | 'CCC' | 'UKETS' | 'HMT' | 'DECC';
  type: 'api' | 'dataset' | 'report' | 'statistics';
  url: string;
  description: string;
  updateFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  format: 'json' | 'csv' | 'xml' | 'pdf' | 'excel';
  sectors?: string[];
  lastUpdated?: string;
  nextUpdate?: string;
  accessMethod: 'open' | 'api_key' | 'registration';
}

export const UK_GOVERNMENT_DATA_SOURCES: UKDataSource[] = [
  // DEFRA (Department for Environment, Food & Rural Affairs)
  {
    id: 'defra-emission-factors-2024',
    name: 'UK Government GHG Conversion Factors 2024',
    department: 'DEFRA',
    type: 'dataset',
    url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024',
    description: 'Official UK government greenhouse gas emission factors for company reporting',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['all'],
    lastUpdated: '2024-06-01',
    nextUpdate: '2025-06-01',
    accessMethod: 'open'
  },
  {
    id: 'defra-uk-emissions-statistics',
    name: 'UK Greenhouse Gas Emissions Statistics',
    department: 'DEFRA',
    type: 'statistics',
    url: 'https://www.gov.uk/government/statistics/uk-greenhouse-gas-emissions-statistics',
    description: 'National greenhouse gas emissions by sector and gas type',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['energy', 'transport', 'agriculture', 'waste', 'industrial'],
    accessMethod: 'open'
  },
  {
    id: 'defra-local-authority-emissions',
    name: 'UK Local Authority CO2 Emissions',
    department: 'DEFRA',
    type: 'dataset',
    url: 'https://www.gov.uk/government/statistics/uk-local-authority-and-regional-greenhouse-gas-emissions-statistics',
    description: 'CO2 emissions estimates for local authorities and regions',
    updateFrequency: 'annually',
    format: 'csv',
    accessMethod: 'open'
  },

  // ONS (Office for National Statistics)
  {
    id: 'ons-environmental-accounts',
    name: 'UK Environmental Accounts',
    department: 'ONS',
    type: 'dataset',
    url: 'https://www.ons.gov.uk/economy/environmentalaccounts',
    description: 'Environmental and economic data including emissions by industry',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['all'],
    accessMethod: 'open'
  },
  {
    id: 'ons-atmospheric-emissions',
    name: 'Atmospheric Emissions by Industry',
    department: 'ONS',
    type: 'dataset',
    url: 'https://www.ons.gov.uk/economy/environmentalaccounts/datasets/ukatmosphericemissions',
    description: 'Detailed atmospheric emissions data by UK industry sector',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['manufacturing', 'services', 'construction', 'agriculture'],
    accessMethod: 'open'
  },

  // BEIS/DESNZ (Department for Energy Security and Net Zero)
  {
    id: 'desnz-energy-statistics',
    name: 'UK Energy Statistics',
    department: 'BEIS',
    type: 'dataset',
    url: 'https://www.gov.uk/government/statistics/uk-energy-statistics',
    description: 'Comprehensive UK energy consumption and generation statistics',
    updateFrequency: 'quarterly',
    format: 'excel',
    sectors: ['energy'],
    accessMethod: 'open'
  },
  {
    id: 'desnz-electricity-generation',
    name: 'Electricity Generation by Fuel Type',
    department: 'BEIS',
    type: 'api',
    url: 'https://api.carbonintensity.org.uk/',
    description: 'Real-time and historical UK electricity generation mix and carbon intensity',
    updateFrequency: 'daily',
    format: 'json',
    sectors: ['energy'],
    accessMethod: 'open'
  },
  {
    id: 'desnz-industrial-energy',
    name: 'Industrial Energy Consumption',
    department: 'BEIS',
    type: 'dataset',
    url: 'https://www.gov.uk/government/statistics/energy-consumption-in-the-uk',
    description: 'Energy consumption by industrial sectors and fuel types',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['industrial', 'manufacturing'],
    accessMethod: 'open'
  },

  // Climate Change Committee
  {
    id: 'ccc-progress-reports',
    name: 'CCC Progress Reports',
    department: 'CCC',
    type: 'report',
    url: 'https://www.theccc.org.uk/publications/',
    description: 'Annual progress reports on UK carbon budgets and net zero',
    updateFrequency: 'annually',
    format: 'pdf',
    sectors: ['all'],
    accessMethod: 'open'
  },
  {
    id: 'ccc-carbon-budgets',
    name: 'UK Carbon Budgets Data',
    department: 'CCC',
    type: 'dataset',
    url: 'https://www.theccc.org.uk/charts-data/',
    description: 'Carbon budget data and sectoral pathways to net zero',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['all'],
    accessMethod: 'open'
  },
  {
    id: 'ccc-sectoral-scenarios',
    name: 'Sectoral Decarbonisation Scenarios',
    department: 'CCC',
    type: 'dataset',
    url: 'https://www.theccc.org.uk/publication/sixth-carbon-budget/',
    description: 'Detailed sectoral emission reduction scenarios and pathways',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['transport', 'buildings', 'manufacturing', 'agriculture', 'aviation'],
    accessMethod: 'open'
  },

  // UK ETS (Emissions Trading System)
  {
    id: 'uk-ets-registry',
    name: 'UK ETS Registry Data',
    department: 'UKETS',
    type: 'dataset',
    url: 'https://ukets-registry.service.gov.uk/reports',
    description: 'UK Emissions Trading System verified emissions and allowances',
    updateFrequency: 'annually',
    format: 'csv',
    sectors: ['power', 'industrial', 'aviation'],
    accessMethod: 'open'
  },
  {
    id: 'uk-ets-carbon-prices',
    name: 'UK ETS Carbon Prices',
    department: 'UKETS',
    type: 'api',
    url: 'https://ukets-registry.service.gov.uk/api/carbon-prices',
    description: 'Historical and current UK ETS carbon allowance prices',
    updateFrequency: 'daily',
    format: 'json',
    accessMethod: 'open'
  },

  // Additional High-Value Sources
  {
    id: 'companies-house-accounts',
    name: 'Companies House Annual Returns',
    department: 'BEIS',
    type: 'api',
    url: 'https://api.companieshouse.gov.uk/',
    description: 'Company financial and environmental reporting data (SECR)',
    updateFrequency: 'daily',
    format: 'json',
    accessMethod: 'api_key'
  },
  {
    id: 'environment-agency-permits',
    name: 'Environment Agency Industrial Permits',
    department: 'DEFRA',
    type: 'dataset',
    url: 'https://environment.data.gov.uk/public-register/',
    description: 'Industrial installation permits and emissions reporting',
    updateFrequency: 'monthly',
    format: 'csv',
    sectors: ['industrial', 'waste', 'water'],
    accessMethod: 'open'
  },
  {
    id: 'transport-emissions-statistics',
    name: 'Transport Emissions Statistics',
    department: 'BEIS',
    type: 'dataset',
    url: 'https://www.gov.uk/government/statistics/transport-and-environment-statistics',
    description: 'Detailed transport sector emissions by mode and fuel type',
    updateFrequency: 'annually',
    format: 'excel',
    sectors: ['transport'],
    accessMethod: 'open'
  },

  // Regional and Local Data
  {
    id: 'local-energy-statistics',
    name: 'Sub-national Energy Statistics',
    department: 'BEIS',
    type: 'dataset',
    url: 'https://www.gov.uk/government/statistics/sub-national-energy-consumption-statistics',
    description: 'Energy consumption statistics at local authority level',
    updateFrequency: 'annually',
    format: 'csv',
    sectors: ['energy'],
    accessMethod: 'open'
  }
];

/**
 * Sector mapping for UK government data
 */
export const UK_SECTOR_MAPPING = {
  'agriculture': ['Agriculture, Forestry and Fishing', 'A'],
  'energy': ['Electricity, Gas, Steam and Air Conditioning Supply', 'D'],
  'manufacturing': ['Manufacturing', 'C'],
  'construction': ['Construction', 'F'],
  'transport': ['Transportation and Storage', 'H'],
  'services': ['Professional, Scientific and Technical Activities', 'M'],
  'public': ['Public Administration and Defence', 'O'],
  'waste': ['Water Supply; Sewerage, Waste Management', 'E'],
  'industrial': ['Manufacturing', 'Mining and Quarrying', 'C', 'B']
};

/**
 * UK Government API Keys and Access Configuration
 */
export const UK_DATA_ACCESS_CONFIG = {
  companiesHouse: {
    baseUrl: 'https://api.companieshouse.gov.uk',
    keyRequired: true,
    rateLimitPerSecond: 600
  },
  carbonIntensity: {
    baseUrl: 'https://api.carbonintensity.org.uk',
    keyRequired: false,
    rateLimitPerSecond: 100
  },
  environmentAgency: {
    baseUrl: 'https://environment.data.gov.uk/public-register/api',
    keyRequired: false,
    rateLimitPerSecond: 50
  }
};

/**
 * Priority data sources for initial implementation
 */
export const PRIORITY_DATA_SOURCES = [
  'defra-emission-factors-2024',
  'defra-uk-emissions-statistics',
  'ons-atmospheric-emissions',
  'desnz-electricity-generation',
  'ccc-carbon-budgets',
  'uk-ets-registry'
];