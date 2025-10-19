import { useState } from 'preact/hooks';

interface MockDataHelperProps {
  apiBaseUrl?: string;
}

export default function MockDataHelper({ 
  apiBaseUrl = 'http://localhost:8787' 
}: MockDataHelperProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const sampleActivities = [
    {
      name: 'Office Electricity Usage',
      dataSourceId: 'ds_1',
      activityType: 'electricity_usage',
      value: 1500,
      unit: 'kWh',
      startDate: '2025-08-01',
      endDate: '2025-08-31'
    },
    {
      name: 'Natural Gas Heating',
      dataSourceId: 'ds_1',
      activityType: 'natural_gas',
      value: 800,
      unit: 'kWh',
      startDate: '2025-08-01',
      endDate: '2025-08-31'
    },
    {
      name: 'Company Vehicle Diesel',
      dataSourceId: 'ds_2',
      activityType: 'diesel',
      value: 200,
      unit: 'litres',
      startDate: '2025-08-01',
      endDate: '2025-08-31'
    },
    {
      name: 'Business Air Travel',
      dataSourceId: 'ds_2',
      activityType: 'air_travel_short_haul',
      value: 2500,
      unit: 'passenger_km',
      startDate: '2025-08-01',
      endDate: '2025-08-31'
    }
  ];

  const createMockData = async () => {
    setIsCreating(true);
    setResult(null);

    try {
      let created = 0;
      const errors = [];

      for (const activity of sampleActivities) {
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/ingestion/mock`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(activity),
          });

          if (response.ok) {
            created++;
          } else {
            const error = await response.json();
            errors.push(`${activity.name}: ${error.error}`);
          }
        } catch (err) {
          errors.push(`${activity.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        setResult(`Created ${created} activities with ${errors.length} errors: ${errors.join(', ')}`);
      } else {
        setResult(`Successfully created ${created} sample activities! Now trigger calculations to see results.`);
      }

    } catch (error) {
      setResult(`Failed to create mock data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <span class="text-2xl">🧪</span>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium text-blue-900">
            Testing Helper
          </h3>
          <p class="text-sm text-blue-700 mt-1">
            Create sample activity data to test the emissions calculation engine.
          </p>
          <div class="mt-3">
            <button
              onClick={createMockData}
              disabled={isCreating}
              class={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md transition-colors ${
                isCreating
                  ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isCreating ? (
                <>
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg class="-ml-1 mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                  </svg>
                  Create Sample Data
                </>
              )}
            </button>
          </div>
          
          {result && (
            <div class="mt-3 text-sm">
              <div class={`p-3 rounded ${
                result.includes('Successfully') 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              }`}>
                {result}
              </div>
            </div>
          )}

          <div class="mt-4 text-xs text-blue-600">
            <p class="font-medium">Sample data includes:</p>
            <ul class="mt-1 list-disc list-inside space-y-1">
              <li>1,500 kWh electricity (Scope 2)</li>
              <li>800 kWh natural gas (Scope 1)</li>
              <li>200 litres diesel fuel (Scope 1)</li>
              <li>2,500 km air travel (Scope 3)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}