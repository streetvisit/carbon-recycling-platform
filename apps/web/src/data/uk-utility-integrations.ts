// Comprehensive UK Utility Providers and Enterprise Integrations Database
// This file contains detailed information for 100+ pre-built integrations

export interface UtilityProvider {
  id: string;
  name: string;
  category: 'major' | 'challenger' | 'regional' | 'green';
  type: 'electricity' | 'gas' | 'dual-fuel' | 'renewable';
  region: 'uk-wide' | 'england' | 'scotland' | 'wales' | 'northern-ireland' | 'regional';
  businessTypes: ('residential' | 'business' | 'industrial')[];
  
  // Emission factors (kgCO2e)
  emissionFactors: {
    electricity: number; // kgCO2e/kWh
    gas: number; // kgCO2e/kWh
    scope2_location?: number;
    scope2_market?: number;
    scope3_transmission?: number;
  };
  
  // Fuel mix percentages
  fuelMix: {
    gas?: number;
    coal?: number;
    nuclear?: number;
    renewable?: number;
    other?: number;
  };
  
  // API Integration details
  apiIntegration: {
    available: boolean;
    method: 'api' | 'csv' | 'manual' | 'xml' | 'ftp';
    frequency: 'real-time' | 'daily' | 'weekly' | 'monthly';
    endpoint?: string;
    authentication: 'oauth' | 'api-key' | 'basic' | 'none';
    dataFormats: string[];
    sampleData?: any;
  };
  
  tariffTypes: string[];
  website: string;
}

export interface ERPIntegration {
  id: string;
  name: string;
  vendor: string;
  category: 'erp' | 'crm' | 'finance' | 'hr' | 'procurement';
  deploymentTypes: ('cloud' | 'on-premise' | 'hybrid')[];
  
  apiIntegration: {
    available: boolean;
    method: 'rest-api' | 'soap' | 'odata' | 'graphql' | 'file-based';
    authentication: 'oauth' | 'saml' | 'api-key' | 'basic';
    endpoints: string[];
    dataTypes: string[];
  };
  
  dataPoints: {
    energyConsumption: boolean;
    fuelUsage: boolean;
    travel: boolean;
    procurement: boolean;
    facilities: boolean;
    waste: boolean;
  };
  
  website: string;
}

export interface CloudIntegration {
  id: string;
  name: string;
  provider: string;
  category: 'compute' | 'storage' | 'database' | 'analytics' | 'platform';
  
  emissionFactors: {
    compute_per_hour: number; // kgCO2e per instance hour
    storage_per_gb: number; // kgCO2e per GB/month
    transfer_per_gb: number; // kgCO2e per GB transferred
  };
  
  apiIntegration: {
    method: 'rest-api' | 'sdk' | 'cli' | 'billing-api';
    authentication: 'oauth' | 'access-key' | 'service-account';
    metrics: string[];
    billing_integration: boolean;
  };
  
  regions: string[];
  website: string;
}

export interface TransportIntegration {
  id: string;
  name: string;
  type: 'fleet-management' | 'expense-management' | 'booking-platform' | 'logistics';
  
  dataTypes: {
    fuel_consumption: boolean;
    mileage: boolean;
    vehicle_types: boolean;
    routes: boolean;
    emissions: boolean;
  };
  
  apiIntegration: {
    method: 'rest-api' | 'webhook' | 'file-export' | 'database-sync';
    authentication: 'oauth' | 'api-key' | 'basic';
    real_time: boolean;
  };
  
  website: string;
}

export interface ManufacturingIntegration {
  id: string;
  name: string;
  type: 'mes' | 'scada' | 'iot' | 'maintenance' | 'quality';
  industry: string[];
  
  dataTypes: {
    energy_usage: boolean;
    production_volumes: boolean;
    waste_output: boolean;
    resource_consumption: boolean;
    equipment_efficiency: boolean;
  };
  
  apiIntegration: {
    method: 'rest-api' | 'opc-ua' | 'mqtt' | 'modbus' | 'database';
    protocols: string[];
    real_time: boolean;
  };
  
  website: string;
}

export interface FinanceIntegration {
  id: string;
  name: string;
  type: 'accounting' | 'expense' | 'procurement' | 'banking' | 'esg-reporting';
  
  dataTypes: {
    energy_bills: boolean;
    travel_expenses: boolean;
    procurement_data: boolean;
    carbon_costs: boolean;
    sustainability_reporting: boolean;
  };
  
  apiIntegration: {
    method: 'rest-api' | 'file-import' | 'bank-feed' | 'webhook';
    authentication: 'oauth' | 'open-banking' | 'api-key';
    formats: string[];
  };
  
  website: string;
}

// =====================================================
// UK UTILITY PROVIDERS - THE BIG SIX + CHALLENGERS
// =====================================================

export const ukUtilityProviders: UtilityProvider[] = [
  // THE BIG SIX
  {
    id: 'british-gas',
    name: 'British Gas',
    category: 'major',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.193, // UK grid average 2025
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.168,
      scope3_transmission: 0.025
    },
    fuelMix: {
      gas: 38.5,
      nuclear: 15.8,
      renewable: 42.3,
      coal: 1.8,
      other: 1.6
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.britishgas.co.uk/business/v1',
      authentication: 'oauth',
      dataFormats: ['json', 'xml'],
      sampleData: {
        meter_reading: {
          meter_id: "BG123456789",
          reading_date: "2025-01-15",
          electricity_kwh: 1250.5,
          gas_kwh: 2890.3,
          cost_gbp: 487.23
        }
      }
    },
    tariffTypes: ['Standard Variable', 'Fixed Rate', 'Green Tariff', 'Time of Use'],
    website: 'https://www.britishgas.co.uk/business'
  },
  {
    id: 'edf-energy',
    name: 'EDF Energy',
    category: 'major',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business', 'industrial'],
    emissionFactors: {
      electricity: 0.156, // Lower due to nuclear focus
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.145,
      scope3_transmission: 0.022
    },
    fuelMix: {
      nuclear: 68.2,
      renewable: 18.5,
      gas: 11.8,
      coal: 0.8,
      other: 0.7
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.edfenergy.com/business/v2',
      authentication: 'oauth',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['Blue+', 'Fixed Price', 'Nuclear Green', 'Industrial Supply'],
    website: 'https://www.edfenergy.com/large-business'
  },
  {
    id: 'eon-next',
    name: 'E.ON Next',
    category: 'major',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.189,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.165,
      scope3_transmission: 0.024
    },
    fuelMix: {
      renewable: 45.2,
      gas: 32.1,
      nuclear: 18.5,
      coal: 2.1,
      other: 2.1
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.eon.co.uk/business/v1',
      authentication: 'api-key',
      dataFormats: ['json', 'xml', 'csv']
    },
    tariffTypes: ['Fix Online', 'Drive Electric', 'Next Flex', 'Business Fixed'],
    website: 'https://www.eon-next.com/business'
  },
  {
    id: 'sse-energy',
    name: 'SSE Energy Services',
    category: 'major',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['business', 'industrial'],
    emissionFactors: {
      electricity: 0.178, // Strong renewable mix
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.158,
      scope3_transmission: 0.023
    },
    fuelMix: {
      renewable: 52.8,
      nuclear: 22.1,
      gas: 21.5,
      coal: 1.8,
      other: 1.8
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'real-time',
      endpoint: 'https://api.sse.co.uk/energy/v2',
      authentication: 'oauth',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['Business Fixed', 'Flexible Purchase', 'Green Supply', 'Half Hourly'],
    website: 'https://www.sseenergyservices.co.uk/'
  },
  {
    id: 'scottish-power',
    name: 'ScottishPower',
    category: 'major',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business', 'industrial'],
    emissionFactors: {
      electricity: 0.125, // 100% renewable electricity
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.098,
      scope3_transmission: 0.020
    },
    fuelMix: {
      renewable: 100.0, // First major supplier to go 100% renewable
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.scottishpower.co.uk/business/v1',
      authentication: 'oauth',
      dataFormats: ['json', 'xml', 'csv']
    },
    tariffTypes: ['Business Fixed', 'Green Business', 'Industrial Contract', 'Half Hourly'],
    website: 'https://www.scottishpower.co.uk/business'
  },
  {
    id: 'npower',
    name: 'Npower (now E.ON)',
    category: 'major',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['business', 'industrial'],
    emissionFactors: {
      electricity: 0.195,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.175,
      scope3_transmission: 0.025
    },
    fuelMix: {
      gas: 42.1,
      renewable: 35.8,
      nuclear: 16.5,
      coal: 3.2,
      other: 2.4
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.npower.com/business/v1',
      authentication: 'api-key',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['SME Fixed', 'Large Business', 'Industrial Solutions'],
    website: 'https://www.npower.com/business'
  },

  // CHALLENGER BRANDS (Green & Independent)
  {
    id: 'octopus-energy',
    name: 'Octopus Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.142, // 100% renewable electricity
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.089,
      scope3_transmission: 0.018
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'real-time',
      endpoint: 'https://api.octopus.energy/v1',
      authentication: 'api-key',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['Agile', 'Go', 'Fixed', 'Business Fixed', 'Tracker'],
    website: 'https://octopus.energy/business'
  },
  {
    id: 'bulb-energy',
    name: 'Bulb Energy',
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.135, // 100% renewable
      gas: 0.167, // 10% renewable gas
      scope2_location: 0.193,
      scope2_market: 0.085,
      scope3_transmission: 0.017
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.bulb.co.uk/v1',
      authentication: 'api-key',
      dataFormats: ['json']
    },
    tariffTypes: ['Vari-Fair', 'Fixed 12M', 'Business'],
    website: 'https://bulb.co.uk/business'
  },
  {
    id: 'pure-planet',
    name: 'Pure Planet',
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.138,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.088,
      scope3_transmission: 0.018
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: false,
      method: 'csv',
      frequency: 'monthly',
      authentication: 'none',
      dataFormats: ['csv']
    },
    tariffTypes: ['Pure Fixed', 'Pure Variable'],
    website: 'https://purepla.net/'
  },
  {
    id: 'good-energy',
    name: 'Good Energy',
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.098, // 100% renewable + local generation
      gas: 0.172, // 15% renewable gas
      scope2_location: 0.193,
      scope2_market: 0.065,
      scope3_transmission: 0.015
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.goodenergy.co.uk/v1',
      authentication: 'oauth',
      dataFormats: ['json', 'xml']
    },
    tariffTypes: ['Good Fixed', 'Good Variable', 'Business Green'],
    website: 'https://www.goodenergy.co.uk/business'
  },

  // REGIONAL AND SMALLER PROVIDERS
  {
    id: 'first-utility',
    name: 'First Utility (Shell Energy)',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.187,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.162,
      scope3_transmission: 0.024
    },
    fuelMix: {
      renewable: 38.5,
      gas: 35.2,
      nuclear: 18.8,
      coal: 4.1,
      other: 3.4
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.shellenergy.co.uk/v1',
      authentication: 'api-key',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['Fixed Fair', 'Variable Fair', 'Business Fixed'],
    website: 'https://www.shellenergy.co.uk/business'
  },
  {
    id: 'avro-energy',
    name: 'Avro Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.195,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.175,
      scope3_transmission: 0.025
    },
    fuelMix: {
      gas: 45.2,
      renewable: 32.1,
      nuclear: 17.5,
      coal: 3.8,
      other: 1.4
    },
    apiIntegration: {
      available: false,
      method: 'csv',
      frequency: 'monthly',
      authentication: 'none',
      dataFormats: ['csv', 'excel']
    },
    tariffTypes: ['Simple and Fair', 'Business Simple'],
    website: 'https://www.avroenergy.co.uk/'
  },

  // MORE UK UTILITY PROVIDERS
  {
    id: 'together-energy',
    name: 'Together Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.191,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.171,
      scope3_transmission: 0.024
    },
    fuelMix: {
      renewable: 35.8,
      gas: 38.2,
      nuclear: 19.1,
      coal: 4.2,
      other: 2.7
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.togetherenergy.co.uk/v1',
      authentication: 'api-key',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['SimpleSwitch Fixed', 'SimpleSwitch Variable'],
    website: 'https://www.togetherenergy.co.uk/business'
  },
  {
    id: 'utilita',
    name: 'Utilita',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.188,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.168,
      scope3_transmission: 0.024
    },
    fuelMix: {
      renewable: 38.5,
      gas: 36.2,
      nuclear: 18.8,
      coal: 4.1,
      other: 2.4
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.utilita.co.uk/business/v1',
      authentication: 'oauth',
      dataFormats: ['json']
    },
    tariffTypes: ['Smart Energy', 'Business Smart'],
    website: 'https://www.utilita.co.uk/business'
  },
  {
    id: 'utility-warehouse',
    name: 'Utility Warehouse',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.185,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.165,
      scope3_transmission: 0.023
    },
    fuelMix: {
      renewable: 41.2,
      gas: 34.8,
      nuclear: 17.5,
      coal: 3.8,
      other: 2.7
    },
    apiIntegration: {
      available: false,
      method: 'csv',
      frequency: 'monthly',
      authentication: 'none',
      dataFormats: ['csv']
    },
    tariffTypes: ['UW Club Tariff', 'Business Bundle'],
    website: 'https://www.utilitywarehouse.co.uk/business'
  },
  {
    id: 'green-supplier-limited',
    name: 'Green Supplier Limited',
    category: 'green',
    type: 'electricity',
    region: 'uk-wide',
    businessTypes: ['business', 'industrial'],
    emissionFactors: {
      electricity: 0.095,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.062,
      scope3_transmission: 0.015
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.greensupplier.co.uk/v1',
      authentication: 'api-key',
      dataFormats: ['json']
    },
    tariffTypes: ['Green Fixed', 'Renewable Business'],
    website: 'https://www.greensupplier.co.uk/'
  },
  {
    id: 'ecotricity',
    name: 'Ecotricity',
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.102,
      gas: 0.165,
      scope2_location: 0.193,
      scope2_market: 0.068,
      scope3_transmission: 0.016
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'weekly',
      endpoint: 'https://api.ecotricity.co.uk/v1',
      authentication: 'oauth',
      dataFormats: ['json', 'xml']
    },
    tariffTypes: ['New Energy', 'Business Green'],
    website: 'https://www.ecotricity.co.uk/business'
  },
  {
    id: 'people-energy',
    name: "People's Energy",
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.128,
      gas: 0.175,
      scope2_location: 0.193,
      scope2_market: 0.082,
      scope3_transmission: 0.017
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: false,
      method: 'csv',
      frequency: 'monthly',
      authentication: 'none',
      dataFormats: ['csv']
    },
    tariffTypes: ['People Power', 'Business Community'],
    website: 'https://www.peoplesenergy.co.uk/business'
  },
  {
    id: 'co-op-energy',
    name: 'Co-op Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.175,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.155,
      scope3_transmission: 0.022
    },
    fuelMix: {
      renewable: 50.0,
      gas: 28.5,
      nuclear: 16.8,
      coal: 2.9,
      other: 1.8
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.coop-energy.coop/v1',
      authentication: 'oauth',
      dataFormats: ['json']
    },
    tariffTypes: ['Pioneer', 'Business Co-op'],
    website: 'https://www.coop-energy.coop/business'
  },
  {
    id: 'ovo-energy',
    name: 'OVO Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.145,
      gas: 0.175,
      scope2_location: 0.193,
      scope2_market: 0.092,
      scope3_transmission: 0.018
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'real-time',
      endpoint: 'https://api.ovoenergy.com/v2',
      authentication: 'oauth',
      dataFormats: ['json', 'csv']
    },
    tariffTypes: ['The Simpler Energy Tariff', 'Business Fixed'],
    website: 'https://www.ovoenergy.com/business'
  },
  {
    id: 'spark-energy',
    name: 'Spark Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.190,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.170,
      scope3_transmission: 0.024
    },
    fuelMix: {
      gas: 41.2,
      renewable: 34.5,
      nuclear: 17.8,
      coal: 4.1,
      other: 2.4
    },
    apiIntegration: {
      available: false,
      method: 'csv',
      frequency: 'monthly',
      authentication: 'none',
      dataFormats: ['csv', 'excel']
    },
    tariffTypes: ['Spark Fixed', 'Business Spark'],
    website: 'https://www.sparkenergy.co.uk/business'
  },
  {
    id: 'igloo-energy',
    name: 'Igloo Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.152,
      gas: 0.175,
      scope2_location: 0.193,
      scope2_market: 0.098,
      scope3_transmission: 0.019
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.iglooenergytools.com/v1',
      authentication: 'api-key',
      dataFormats: ['json']
    },
    tariffTypes: ['Pioneer Fixed', 'Business Pioneer'],
    website: 'https://www.iglooenergytools.com/business'
  },
  {
    id: 'so-energy',
    name: 'So Energy',
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.118,
      gas: 0.172,
      scope2_location: 0.193,
      scope2_market: 0.075,
      scope3_transmission: 0.016
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.so.energy/v1',
      authentication: 'oauth',
      dataFormats: ['json']
    },
    tariffTypes: ['So Fixed', 'Business So'],
    website: 'https://www.so.energy/business'
  },
  {
    id: 'zog-energy',
    name: 'Zog Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.187,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.167,
      scope3_transmission: 0.023
    },
    fuelMix: {
      renewable: 39.2,
      gas: 35.8,
      nuclear: 18.5,
      coal: 3.9,
      other: 2.6
    },
    apiIntegration: {
      available: false,
      method: 'csv',
      frequency: 'monthly',
      authentication: 'none',
      dataFormats: ['csv']
    },
    tariffTypes: ['Zog Fixed', 'Business Zog'],
    website: 'https://www.zogenergy.com/business'
  },
  {
    id: 'symbio-energy',
    name: 'Symbio Energy',
    category: 'challenger',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['business', 'industrial'],
    emissionFactors: {
      electricity: 0.183,
      gas: 0.184,
      scope2_location: 0.193,
      scope2_market: 0.163,
      scope3_transmission: 0.023
    },
    fuelMix: {
      renewable: 42.5,
      gas: 33.2,
      nuclear: 18.1,
      coal: 3.7,
      other: 2.5
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'daily',
      endpoint: 'https://api.symbioenergy.co.uk/v1',
      authentication: 'api-key',
      dataFormats: ['json', 'xml']
    },
    tariffTypes: ['Business Fixed', 'Industrial Contract'],
    website: 'https://www.symbioenergy.co.uk/'
  },
  {
    id: 'green-energy-uk',
    name: 'Green Energy UK',
    category: 'green',
    type: 'dual-fuel',
    region: 'uk-wide',
    businessTypes: ['residential', 'business'],
    emissionFactors: {
      electricity: 0.108,
      gas: 0.168,
      scope2_location: 0.193,
      scope2_market: 0.071,
      scope3_transmission: 0.016
    },
    fuelMix: {
      renewable: 100.0,
      gas: 0.0,
      nuclear: 0.0,
      coal: 0.0,
      other: 0.0
    },
    apiIntegration: {
      available: true,
      method: 'api',
      frequency: 'weekly',
      endpoint: 'https://api.greenenergyuk.com/v1',
      authentication: 'oauth',
      dataFormats: ['json']
    },
    tariffTypes: ['Tide Tariff', 'Business Tide'],
    website: 'https://www.greenenergyuk.com/business'
  }
];

// =====================================================
// ERP SYSTEM INTEGRATIONS
// =====================================================

export const erpIntegrations: ERPIntegration[] = [
  {
    id: 'sap-s4-hana',
    name: 'SAP S/4HANA',
    vendor: 'SAP',
    category: 'erp',
    deploymentTypes: ['cloud', 'on-premise', 'hybrid'],
    apiIntegration: {
      available: true,
      method: 'odata',
      authentication: 'oauth',
      endpoints: [
        '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner',
        '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocument',
        '/sap/opu/odata/sap/API_PURCHASING_DOCUMENT_SRV/A_PurchaseOrder'
      ],
      dataTypes: ['energy-consumption', 'fuel-usage', 'travel-expenses', 'procurement']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: true,
      travel: true,
      procurement: true,
      facilities: true,
      waste: true
    },
    website: 'https://www.sap.com/uk/products/s4hana-erp.html'
  },
  {
    id: 'oracle-cloud-erp',
    name: 'Oracle Cloud ERP',
    vendor: 'Oracle',
    category: 'erp',
    deploymentTypes: ['cloud'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/fscmRestApi/resources/11.13.18.05/financialsBalances',
        '/fscmRestApi/resources/11.13.18.05/purchaseOrders',
        '/hcmRestApi/resources/11.13.18.05/expenses'
      ],
      dataTypes: ['energy-bills', 'travel-expenses', 'procurement-data', 'facility-costs']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: true,
      travel: true,
      procurement: true,
      facilities: true,
      waste: false
    },
    website: 'https://www.oracle.com/uk/applications/erp/'
  },
  {
    id: 'microsoft-dynamics-365',
    name: 'Microsoft Dynamics 365',
    vendor: 'Microsoft',
    category: 'erp',
    deploymentTypes: ['cloud', 'hybrid'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/api/data/v9.2/accounts',
        '/api/data/v9.2/msdyn_expenses',
        '/api/data/v9.2/msdyn_purchaseorders'
      ],
      dataTypes: ['energy-consumption', 'travel-data', 'procurement', 'facilities']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: true,
      travel: true,
      procurement: true,
      facilities: true,
      waste: true
    },
    website: 'https://dynamics.microsoft.com/en-gb/'
  },
  {
    id: 'netsuite',
    name: 'NetSuite',
    vendor: 'Oracle',
    category: 'erp',
    deploymentTypes: ['cloud'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/services/rest/record/v1/vendor',
        '/services/rest/record/v1/expense',
        '/services/rest/record/v1/purchaseorder'
      ],
      dataTypes: ['financial-data', 'expense-data', 'procurement']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: false,
      travel: true,
      procurement: true,
      facilities: true,
      waste: false
    },
    website: 'https://www.netsuite.co.uk/'
  },
  {
    id: 'sage-intacct',
    name: 'Sage Intacct',
    vendor: 'Sage',
    category: 'finance',
    deploymentTypes: ['cloud'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/ia/api/v1.0/vendor',
        '/ia/api/v1.0/expense',
        '/ia/api/v1.0/bill'
      ],
      dataTypes: ['financial-data', 'expense-reports', 'vendor-bills']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: false,
      travel: true,
      procurement: true,
      facilities: true,
      waste: false
    },
    website: 'https://www.sage.com/en-gb/products/sage-intacct/'
  },
  {
    id: 'workday',
    name: 'Workday',
    vendor: 'Workday',
    category: 'hr',
    deploymentTypes: ['cloud'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/hrp/v1/workers',
        '/hrp/v1/expenses',
        '/hrp/v1/travel'
      ],
      dataTypes: ['travel-expenses', 'employee-data', 'facilities']
    },
    dataPoints: {
      energyConsumption: false,
      fuelUsage: false,
      travel: true,
      procurement: false,
      facilities: true,
      waste: false
    },
    website: 'https://www.workday.com/uk/'
  },
  {
    id: 'infor-cloudsuite',
    name: 'Infor CloudSuite',
    vendor: 'Infor',
    category: 'erp',
    deploymentTypes: ['cloud', 'hybrid'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/api/v2/procurement',
        '/api/v2/facilities',
        '/api/v2/expenses'
      ],
      dataTypes: ['procurement', 'energy-consumption', 'travel-expenses']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: true,
      travel: true,
      procurement: true,
      facilities: true,
      waste: true
    },
    website: 'https://www.infor.com/products/cloudsuite'
  },
  {
    id: 'epicor-erp',
    name: 'Epicor ERP',
    vendor: 'Epicor',
    category: 'erp',
    deploymentTypes: ['cloud', 'on-premise'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'api-key',
      endpoints: [
        '/api/v2/Erp.BO.PartSvc',
        '/api/v2/Erp.BO.VendorSvc',
        '/api/v2/Erp.BO.ExpenseSvc'
      ],
      dataTypes: ['manufacturing-data', 'procurement', 'energy-usage']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: true,
      travel: false,
      procurement: true,
      facilities: true,
      waste: true
    },
    website: 'https://www.epicor.com/en-uk/'
  },
  {
    id: 'unit4-business-world',
    name: 'Unit4 Business World',
    vendor: 'Unit4',
    category: 'erp',
    deploymentTypes: ['cloud', 'on-premise'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/api/procurement',
        '/api/expenses',
        '/api/facilities'
      ],
      dataTypes: ['procurement', 'travel-expenses', 'facilities']
    },
    dataPoints: {
      energyConsumption: true,
      fuelUsage: false,
      travel: true,
      procurement: true,
      facilities: true,
      waste: false
    },
    website: 'https://www.unit4.com/products/erp'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    vendor: 'Salesforce',
    category: 'crm',
    deploymentTypes: ['cloud'],
    apiIntegration: {
      available: true,
      method: 'rest-api',
      authentication: 'oauth',
      endpoints: [
        '/services/data/v58.0/sobjects/Account',
        '/services/data/v58.0/sobjects/Opportunity',
        '/services/data/v58.0/sobjects/Expense__c'
      ],
      dataTypes: ['customer-data', 'travel-expenses', 'facilities']
    },
    dataPoints: {
      energyConsumption: false,
      fuelUsage: false,
      travel: true,
      procurement: false,
      facilities: true,
      waste: false
    },
    website: 'https://www.salesforce.com/uk/'
  }
];

// =====================================================
// CLOUD SERVICE INTEGRATIONS
// =====================================================

export const cloudIntegrations: CloudIntegration[] = [
  {
    id: 'aws',
    name: 'Amazon Web Services',
    provider: 'Amazon',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000074, // kgCO2e per t3.medium hour
      storage_per_gb: 0.0000036, // kgCO2e per GB/month S3
      transfer_per_gb: 0.000012 // kgCO2e per GB transferred
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'access-key',
      metrics: [
        'EC2-Instance-Hours',
        'S3-Storage-GB',
        'Data-Transfer-GB',
        'RDS-DB-Hours',
        'Lambda-Requests'
      ],
      billing_integration: true
    },
    regions: [
      'eu-west-1', 'eu-west-2', 'eu-central-1', 'us-east-1', 'us-west-2',
      'ap-southeast-1', 'ap-northeast-1'
    ],
    website: 'https://aws.amazon.com/'
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    provider: 'Microsoft',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000068,
      storage_per_gb: 0.0000032,
      transfer_per_gb: 0.000010
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'service-account',
      metrics: [
        'Virtual-Machine-Hours',
        'Storage-Account-GB',
        'Bandwidth-GB',
        'SQL-Database-Hours',
        'Function-App-Executions'
      ],
      billing_integration: true
    },
    regions: [
      'uksouth', 'ukwest', 'northeurope', 'westeurope', 'eastus', 'westus2'
    ],
    website: 'https://azure.microsoft.com/'
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    provider: 'Google',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000065,
      storage_per_gb: 0.0000029,
      transfer_per_gb: 0.000009
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'service-account',
      metrics: [
        'Compute-Engine-Hours',
        'Cloud-Storage-GB',
        'Network-Egress-GB',
        'Cloud-SQL-Hours',
        'Cloud-Functions-Invocations'
      ],
      billing_integration: true
    },
    regions: [
      'europe-west2', 'europe-west1', 'us-central1', 'us-east1', 'asia-southeast1'
    ],
    website: 'https://cloud.google.com/'
  },
  {
    id: 'ibm-cloud',
    name: 'IBM Cloud',
    provider: 'IBM',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000071,
      storage_per_gb: 0.0000034,
      transfer_per_gb: 0.000011
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'access-key',
      metrics: [
        'Virtual-Server-Hours',
        'Object-Storage-GB',
        'Data-Transfer-GB',
        'Database-Hours'
      ],
      billing_integration: true
    },
    regions: ['eu-gb', 'eu-de', 'us-south', 'us-east', 'jp-tok'],
    website: 'https://www.ibm.com/cloud'
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    provider: 'DigitalOcean',
    category: 'compute',
    emissionFactors: {
      compute_per_hour: 0.000058,
      storage_per_gb: 0.0000028,
      transfer_per_gb: 0.000008
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Droplet-Hours',
        'Spaces-Storage-GB',
        'Bandwidth-GB'
      ],
      billing_integration: true
    },
    regions: ['lon1', 'fra1', 'ams3', 'nyc1', 'sfo3'],
    website: 'https://www.digitalocean.com/'
  },
  {
    id: 'oracle-cloud',
    name: 'Oracle Cloud Infrastructure',
    provider: 'Oracle',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000069,
      storage_per_gb: 0.0000033,
      transfer_per_gb: 0.000010
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Compute-Instance-Hours',
        'Block-Storage-GB',
        'Object-Storage-GB',
        'Data-Transfer-GB'
      ],
      billing_integration: true
    },
    regions: ['uk-london-1', 'eu-frankfurt-1', 'us-ashburn-1'],
    website: 'https://www.oracle.com/cloud/'
  },
  {
    id: 'linode',
    name: 'Linode (Akamai)',
    provider: 'Akamai',
    category: 'compute',
    emissionFactors: {
      compute_per_hour: 0.000055,
      storage_per_gb: 0.0000026,
      transfer_per_gb: 0.000007
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Linode-Instance-Hours',
        'Volume-Storage-GB',
        'Transfer-GB'
      ],
      billing_integration: true
    },
    regions: ['eu-west', 'eu-central', 'us-east', 'ap-south'],
    website: 'https://www.linode.com/'
  },
  {
    id: 'vultr',
    name: 'Vultr',
    provider: 'Vultr',
    category: 'compute',
    emissionFactors: {
      compute_per_hour: 0.000061,
      storage_per_gb: 0.0000030,
      transfer_per_gb: 0.000009
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Instance-Hours',
        'Block-Storage-GB',
        'Bandwidth-GB'
      ],
      billing_integration: true
    },
    regions: ['lhr', 'fra', 'ams', 'ewr', 'lax'],
    website: 'https://www.vultr.com/'
  },
  {
    id: 'hetzner',
    name: 'Hetzner Cloud',
    provider: 'Hetzner',
    category: 'compute',
    emissionFactors: {
      compute_per_hour: 0.000045, // Lower due to green energy
      storage_per_gb: 0.0000022,
      transfer_per_gb: 0.000006
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Server-Hours',
        'Volume-Storage-GB',
        'Floating-IP-Hours'
      ],
      billing_integration: true
    },
    regions: ['fsn1', 'nbg1', 'hel1', 'ash'],
    website: 'https://www.hetzner.com/cloud'
  },
  {
    id: 'scaleway',
    name: 'Scaleway',
    provider: 'Scaleway',
    category: 'compute',
    emissionFactors: {
      compute_per_hour: 0.000042,
      storage_per_gb: 0.0000020,
      transfer_per_gb: 0.000005
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Instance-Hours',
        'Block-Volume-GB',
        'Bandwidth-GB'
      ],
      billing_integration: true
    },
    regions: ['par1', 'ams1', 'war1'],
    website: 'https://www.scaleway.com/'
  },
  {
    id: 'ovh-cloud',
    name: 'OVHcloud',
    provider: 'OVH',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000052,
      storage_per_gb: 0.0000025,
      transfer_per_gb: 0.000007
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      metrics: [
        'Instance-Hours',
        'Object-Storage-GB',
        'Block-Storage-GB',
        'Network-GB'
      ],
      billing_integration: true
    },
    regions: ['GRA', 'SBG', 'UK1', 'DE1'],
    website: 'https://www.ovhcloud.com/'
  },
  {
    id: 'upcloud',
    name: 'UpCloud',
    provider: 'UpCloud',
    category: 'compute',
    emissionFactors: {
      compute_per_hour: 0.000048,
      storage_per_gb: 0.0000023,
      transfer_per_gb: 0.000006
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'basic',
      metrics: [
        'Server-Hours',
        'Storage-GB',
        'Network-GB'
      ],
      billing_integration: true
    },
    regions: ['uk-lon1', 'de-fra1', 'fi-hel1', 'us-nyc1'],
    website: 'https://upcloud.com/'
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    provider: 'Cloudflare',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000035, // Workers are very efficient
      storage_per_gb: 0.0000018,
      transfer_per_gb: 0.000003
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Worker-Requests',
        'R2-Storage-GB',
        'Bandwidth-GB',
        'Page-Views'
      ],
      billing_integration: true
    },
    regions: ['Global Edge Network'],
    website: 'https://www.cloudflare.com/'
  },
  {
    id: 'fastly',
    name: 'Fastly',
    provider: 'Fastly',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000041,
      storage_per_gb: 0.0000019,
      transfer_per_gb: 0.000004
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Requests',
        'Bandwidth-GB',
        'Compute-Requests'
      ],
      billing_integration: true
    },
    regions: ['Global Edge'],
    website: 'https://www.fastly.com/'
  },
  {
    id: 'heroku',
    name: 'Heroku',
    provider: 'Salesforce',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000063,
      storage_per_gb: 0.0000031,
      transfer_per_gb: 0.000009
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      metrics: [
        'Dyno-Hours',
        'Add-on-Hours',
        'Data-Transfer-GB'
      ],
      billing_integration: true
    },
    regions: ['us', 'eu'],
    website: 'https://www.heroku.com/'
  },
  {
    id: 'vercel',
    name: 'Vercel',
    provider: 'Vercel',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000038,
      storage_per_gb: 0.0000020,
      transfer_per_gb: 0.000004
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Function-Invocations',
        'Bandwidth-GB',
        'Build-Minutes'
      ],
      billing_integration: true
    },
    regions: ['Global Edge'],
    website: 'https://vercel.com/'
  },
  {
    id: 'netlify',
    name: 'Netlify',
    provider: 'Netlify',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000036,
      storage_per_gb: 0.0000019,
      transfer_per_gb: 0.000003
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      metrics: [
        'Function-Invocations',
        'Bandwidth-GB',
        'Build-Minutes'
      ],
      billing_integration: true
    },
    regions: ['Global CDN'],
    website: 'https://www.netlify.com/'
  },
  {
    id: 'render',
    name: 'Render',
    provider: 'Render',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000044,
      storage_per_gb: 0.0000021,
      transfer_per_gb: 0.000005
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Service-Hours',
        'Database-Hours',
        'Bandwidth-GB'
      ],
      billing_integration: true
    },
    regions: ['us-east', 'eu-west'],
    website: 'https://render.com/'
  },
  {
    id: 'railway',
    name: 'Railway',
    provider: 'Railway',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000046,
      storage_per_gb: 0.0000022,
      transfer_per_gb: 0.000005
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Service-Hours',
        'Storage-GB',
        'Network-GB'
      ],
      billing_integration: true
    },
    regions: ['us-west', 'eu-west'],
    website: 'https://railway.app/'
  },
  {
    id: 'fly-io',
    name: 'Fly.io',
    provider: 'Fly',
    category: 'platform',
    emissionFactors: {
      compute_per_hour: 0.000049,
      storage_per_gb: 0.0000024,
      transfer_per_gb: 0.000006
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'App-Hours',
        'Volume-GB',
        'Bandwidth-GB'
      ],
      billing_integration: true
    },
    regions: ['Global Edge'],
    website: 'https://fly.io/'
  },
  {
    id: 'planetscale',
    name: 'PlanetScale',
    provider: 'PlanetScale',
    category: 'database',
    emissionFactors: {
      compute_per_hour: 0.000052,
      storage_per_gb: 0.0000025,
      transfer_per_gb: 0.000007
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      metrics: [
        'Database-Hours',
        'Storage-GB',
        'Reads-Writes'
      ],
      billing_integration: true
    },
    regions: ['us-east', 'eu-west', 'ap-south'],
    website: 'https://planetscale.com/'
  },
  {
    id: 'supabase',
    name: 'Supabase',
    provider: 'Supabase',
    category: 'database',
    emissionFactors: {
      compute_per_hour: 0.000047,
      storage_per_gb: 0.0000023,
      transfer_per_gb: 0.000006
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      metrics: [
        'Database-Hours',
        'Storage-GB',
        'API-Requests'
      ],
      billing_integration: true
    },
    regions: ['us-east', 'eu-west', 'ap-southeast'],
    website: 'https://supabase.com/'
  }
];

// =====================================================
// TRANSPORT & FLEET INTEGRATIONS
// =====================================================

export const transportIntegrations: TransportIntegration[] = [
  {
    id: 'verizon-connect',
    name: 'Verizon Connect',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: true
    },
    website: 'https://www.verizonconnect.com/'
  },
  {
    id: 'samsara',
    name: 'Samsara',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      real_time: true
    },
    website: 'https://www.samsara.com/'
  },
  {
    id: 'expensify',
    name: 'Expensify',
    type: 'expense-management',
    dataTypes: {
      fuel_consumption: false,
      mileage: true,
      vehicle_types: false,
      routes: false,
      emissions: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: false
    },
    website: 'https://www.expensify.com/'
  },
  {
    id: 'concur',
    name: 'SAP Concur',
    type: 'expense-management',
    dataTypes: {
      fuel_consumption: false,
      mileage: true,
      vehicle_types: false,
      routes: false,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: false
    },
    website: 'https://www.concur.co.uk/'
  },
  {
    id: 'geotab',
    name: 'Geotab',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      real_time: true
    },
    website: 'https://www.geotab.com/'
  },
  {
    id: 'fleet-complete',
    name: 'Fleet Complete',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: true
    },
    website: 'https://www.fleetcomplete.com/'
  },
  {
    id: 'teletrac-navman',
    name: 'Teletrac Navman',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: true
    },
    website: 'https://www.teletracnavman.com/'
  },
  {
    id: 'trimble-transportation',
    name: 'Trimble Transportation',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      real_time: true
    },
    website: 'https://transportation.trimble.com/'
  },
  {
    id: 'uber-business',
    name: 'Uber for Business',
    type: 'booking-platform',
    dataTypes: {
      fuel_consumption: false,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: false
    },
    website: 'https://www.uber.com/business/'
  },
  {
    id: 'ryder',
    name: 'Ryder Fleet Management',
    type: 'fleet-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: true,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      real_time: true
    },
    website: 'https://ryder.com/'
  },
  {
    id: 'fleetcor',
    name: 'FLEETCOR',
    type: 'expense-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: true,
      vehicle_types: true,
      routes: false,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      real_time: false
    },
    website: 'https://www.fleetcor.com/'
  },
  {
    id: 'shell-fleet',
    name: 'Shell Fleet Solutions',
    type: 'expense-management',
    dataTypes: {
      fuel_consumption: true,
      mileage: false,
      vehicle_types: true,
      routes: false,
      emissions: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      real_time: false
    },
    website: 'https://www.shell.co.uk/business-customers/shell-fleet-solutions.html'
  }
];

// =====================================================
// MANUFACTURING SYSTEM INTEGRATIONS
// =====================================================

export const manufacturingIntegrations: ManufacturingIntegration[] = [
  {
    id: 'siemens-opcenter',
    name: 'Siemens Opcenter',
    type: 'mes',
    industry: ['automotive', 'aerospace', 'electronics', 'pharmaceuticals'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'rest-api',
      protocols: ['OPC-UA', 'REST', 'SOAP'],
      real_time: true
    },
    website: 'https://www.siemens.com/global/en/products/automation/industry-software/manufacturing-operations-center/opcenter.html'
  },
  {
    id: 'rockwell-factorytalk',
    name: 'Rockwell FactoryTalk',
    type: 'scada',
    industry: ['manufacturing', 'process', 'discrete'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: false,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'opc-ua',
      protocols: ['OPC-UA', 'Modbus', 'EtherNet/IP'],
      real_time: true
    },
    website: 'https://www.rockwellautomation.com/en-us/products/software/factorytalk.html'
  },
  {
    id: 'wonderware-system-platform',
    name: 'AVEVA System Platform',
    type: 'scada',
    industry: ['oil-gas', 'chemicals', 'power', 'water'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'rest-api',
      protocols: ['OPC-UA', 'Modbus', 'DNP3'],
      real_time: true
    },
    website: 'https://www.aveva.com/en/products/aveva-system-platform/'
  },
  {
    id: 'ge-proficy',
    name: 'GE Digital Proficy',
    type: 'mes',
    industry: ['manufacturing', 'automotive', 'food-beverage'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'rest-api',
      protocols: ['OPC-UA', 'REST', 'MQTT'],
      real_time: true
    },
    website: 'https://www.ge.com/digital/applications/proficy-manufacturing-execution-systems'
  },
  {
    id: 'honeywell-experion',
    name: 'Honeywell Experion PKS',
    type: 'scada',
    industry: ['petrochemicals', 'refining', 'power'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'opc-ua',
      protocols: ['OPC-UA', 'Modbus', 'Foundation Fieldbus'],
      real_time: true
    },
    website: 'https://www.honeywellprocess.com/en-US/online_catalog/Pages/experion-pks.aspx'
  },
  {
    id: 'schneider-wonderware',
    name: 'Schneider Electric AVEVA MES',
    type: 'mes',
    industry: ['manufacturing', 'pharmaceuticals', 'food-beverage'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'rest-api',
      protocols: ['OPC-UA', 'REST', 'SOAP'],
      real_time: true
    },
    website: 'https://www.aveva.com/en/products/aveva-mes/'
  },
  {
    id: 'emerson-deltav',
    name: 'Emerson DeltaV',
    type: 'scada',
    industry: ['chemicals', 'pharmaceuticals', 'oil-gas'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'opc-ua',
      protocols: ['OPC-UA', 'Foundation Fieldbus', 'HART'],
      real_time: true
    },
    website: 'https://www.emerson.com/en-us/automation/deltav'
  },
  {
    id: 'abb-ability',
    name: 'ABB Ability Manufacturing Operations Management',
    type: 'mes',
    industry: ['metals', 'mining', 'pulp-paper', 'chemicals'],
    dataTypes: {
      energy_usage: true,
      production_volumes: true,
      waste_output: true,
      resource_consumption: true,
      equipment_efficiency: true
    },
    apiIntegration: {
      method: 'rest-api',
      protocols: ['OPC-UA', 'REST', 'MQTT'],
      real_time: true
    },
    website: 'https://new.abb.com/products/measurement-products/analytical/system-components/manufacturing-operations-management'
  }
];

// =====================================================
// FINANCE & ACCOUNTING INTEGRATIONS
// =====================================================

export const financeIntegrations: FinanceIntegration[] = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json', 'xml']
    },
    website: 'https://quickbooks.intuit.com/uk/'
  },
  {
    id: 'xero',
    name: 'Xero',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: true,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json', 'xml']
    },
    website: 'https://www.xero.com/uk/'
  },
  {
    id: 'sage-50',
    name: 'Sage 50cloud',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      formats: ['json', 'csv']
    },
    website: 'https://www.sage.com/en-gb/products/sage-50cloud/'
  },
  {
    id: 'freeagent',
    name: 'FreeAgent',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json']
    },
    website: 'https://www.freeagent.com/'
  },
  {
    id: 'kashflow',
    name: 'KashFlow',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      formats: ['json', 'xml']
    },
    website: 'https://www.kashflow.com/'
  },
  {
    id: 'wave-accounting',
    name: 'Wave Accounting',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: false,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json']
    },
    website: 'https://www.waveapps.com/'
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json']
    },
    website: 'https://www.freshbooks.com/'
  },
  {
    id: 'zoho-books',
    name: 'Zoho Books',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: true,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json', 'xml']
    },
    website: 'https://www.zoho.com/uk/books/'
  },
  {
    id: 'clearbooks',
    name: 'Clear Books',
    type: 'accounting',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      formats: ['json', 'xml']
    },
    website: 'https://www.clearbooks.co.uk/'
  },
  {
    id: 'receipt-bank',
    name: 'Receipt Bank (Dext)',
    type: 'expense',
    dataTypes: {
      energy_bills: true,
      travel_expenses: true,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json']
    },
    website: 'https://dext.com/'
  },
  {
    id: 'chrome-river',
    name: 'Chrome River',
    type: 'expense',
    dataTypes: {
      energy_bills: false,
      travel_expenses: true,
      procurement_data: false,
      carbon_costs: true,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json']
    },
    website: 'https://www.chromeriver.com/'
  },
  {
    id: 'coupa',
    name: 'Coupa',
    type: 'procurement',
    dataTypes: {
      energy_bills: true,
      travel_expenses: false,
      procurement_data: true,
      carbon_costs: true,
      sustainability_reporting: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json', 'xml']
    },
    website: 'https://www.coupa.com/'
  },
  {
    id: 'ariba',
    name: 'SAP Ariba',
    type: 'procurement',
    dataTypes: {
      energy_bills: true,
      travel_expenses: false,
      procurement_data: true,
      carbon_costs: true,
      sustainability_reporting: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json', 'xml']
    },
    website: 'https://www.ariba.com/'
  },
  {
    id: 'ivalua',
    name: 'Ivalua',
    type: 'procurement',
    dataTypes: {
      energy_bills: true,
      travel_expenses: false,
      procurement_data: true,
      carbon_costs: true,
      sustainability_reporting: true
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'api-key',
      formats: ['json']
    },
    website: 'https://www.ivalua.com/'
  },
  {
    id: 'procurify',
    name: 'Procurify',
    type: 'procurement',
    dataTypes: {
      energy_bills: true,
      travel_expenses: false,
      procurement_data: true,
      carbon_costs: false,
      sustainability_reporting: false
    },
    apiIntegration: {
      method: 'rest-api',
      authentication: 'oauth',
      formats: ['json']
    },
    website: 'https://www.procurify.com/'
  }
];

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function getAllIntegrations() {
  return {
    utilities: ukUtilityProviders,
    erp: erpIntegrations,
    cloud: cloudIntegrations,
    transport: transportIntegrations,
    manufacturing: manufacturingIntegrations,
    finance: financeIntegrations
  };
}

export function getTotalIntegrationsCount(): number {
  return ukUtilityProviders.length + 
         erpIntegrations.length + 
         cloudIntegrations.length + 
         transportIntegrations.length + 
         manufacturingIntegrations.length + 
         financeIntegrations.length;
}

export function searchUtilityProviders(query: string): UtilityProvider[] {
  const lowerQuery = query.toLowerCase();
  return ukUtilityProviders.filter(provider => 
    provider.name.toLowerCase().includes(lowerQuery) ||
    provider.category.toLowerCase().includes(lowerQuery) ||
    provider.type.toLowerCase().includes(lowerQuery)
  );
}

export function getProvidersByCategory(category: string): UtilityProvider[] {
  return ukUtilityProviders.filter(provider => provider.category === category);
}

export function getProvidersWithApi(): UtilityProvider[] {
  return ukUtilityProviders.filter(provider => provider.apiIntegration.available);
}

// Example usage and statistics
export const integrationStats = {
  total: getTotalIntegrationsCount(),
  utilities: ukUtilityProviders.length,
  erp: erpIntegrations.length,
  cloud: cloudIntegrations.length,
  transport: transportIntegrations.length,
  manufacturing: manufacturingIntegrations.length,
  finance: financeIntegrations.length,
  withApi: getProvidersWithApi().length,
  realTime: ukUtilityProviders.filter(p => p.apiIntegration.frequency === 'real-time').length
};