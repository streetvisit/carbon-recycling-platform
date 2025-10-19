// Mock data service for development
export interface MockDataSource {
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

export const mockDataSources: MockDataSource[] = [
  {
    id: '1',
    provider: 'aws',
    type: 'cloud_compute',
    status: 'active',
    lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    integration_id: 'aws_ec2',
    metadata: {
      name: 'AWS EC2 Compute',
      description: 'Track carbon emissions from AWS EC2 instances and cloud compute usage',
      setup_complexity: 'Medium',
      estimated_setup_time: '15-30 minutes',
      data_types: ['compute_hours', 'instance_types', 'regional_data'],
      emission_scopes: ['scope_2', 'scope_3']
    }
  },
  {
    id: '2',
    provider: 'edf_energy',
    type: 'electricity',
    status: 'active',
    lastSyncedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    integration_id: 'edf_energy',
    metadata: {
      name: 'EDF Energy',
      description: 'Direct electricity consumption data from EDF Energy smart meters',
      setup_complexity: 'Easy',
      estimated_setup_time: '5-10 minutes',
      data_types: ['electricity_usage', 'time_of_use', 'tariff_data'],
      emission_scopes: ['scope_2']
    }
  },
  {
    id: '3',
    provider: 'british_gas',
    type: 'gas',
    status: 'pending',
    lastSyncedAt: null,
    integration_id: 'british_gas',
    metadata: {
      name: 'British Gas',
      description: 'Natural gas consumption data for heating and cooking',
      setup_complexity: 'Easy',
      estimated_setup_time: '5-10 minutes',
      data_types: ['gas_usage', 'meter_readings', 'billing_data'],
      emission_scopes: ['scope_1']
    }
  },
  {
    id: '4',
    provider: 'csv_fleet_data',
    type: 'transport',
    status: 'active',
    lastSyncedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    integration_id: 'csv_import',
    metadata: {
      name: 'Fleet Vehicle Data',
      description: 'Vehicle fuel consumption and mileage data imported from CSV files',
      setup_complexity: 'Easy',
      estimated_setup_time: '10-15 minutes',
      data_types: ['fuel_consumption', 'mileage', 'vehicle_types'],
      emission_scopes: ['scope_1', 'scope_3']
    }
  },
  {
    id: '5',
    provider: 'openai',
    type: 'ai_services',
    status: 'active',
    lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    integration_id: 'openai_api',
    metadata: {
      name: 'OpenAI API Usage',
      description: 'Track carbon emissions from AI model usage and API calls',
      setup_complexity: 'Medium',
      estimated_setup_time: '10-20 minutes',
      data_types: ['api_calls', 'model_usage', 'compute_time'],
      emission_scopes: ['scope_3']
    }
  }
];

// Mock API response format
export interface MockApiResponse {
  success: boolean;
  data: MockDataSource[];
  message?: string;
}

export function getMockDataSources(): Promise<MockApiResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: mockDataSources,
        message: 'Mock data loaded successfully'
      });
    }, 500); // Simulate network delay
  });
}

export function createMockDataSource(provider: string, type: string): Promise<MockApiResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newDataSource: MockDataSource = {
        id: (mockDataSources.length + 1).toString(),
        provider,
        type,
        status: 'pending',
        lastSyncedAt: null,
        metadata: {
          name: `${provider.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Integration`,
          description: `${type.replace(/_/g, ' ')} data source integration`,
          setup_complexity: 'Medium',
          estimated_setup_time: '10-20 minutes',
          data_types: ['usage_data', 'consumption_metrics'],
          emission_scopes: ['scope_2']
        }
      };
      
      mockDataSources.push(newDataSource);
      
      resolve({
        success: true,
        data: [newDataSource],
        message: 'Data source created successfully'
      });
    }, 800);
  });
}

export function deleteMockDataSource(id: string): Promise<MockApiResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const index = mockDataSources.findIndex(ds => ds.id === id);
      if (index !== -1) {
        mockDataSources.splice(index, 1);
        resolve({
          success: true,
          data: [],
          message: 'Data source deleted successfully'
        });
      } else {
        resolve({
          success: false,
          data: [],
          message: 'Data source not found'
        });
      }
    }, 300);
  });
}