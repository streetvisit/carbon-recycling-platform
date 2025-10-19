import { useState } from 'preact/hooks';
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth';

interface TriggerCalculationButtonProps {
  onSuccess?: (result: { processed: number; errors?: string[] }) => void;
  customApiUrl?: string;
}

export default function TriggerCalculationButton({ 
  onSuccess, 
  customApiUrl 
}: TriggerCalculationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    processed: number;
    errors?: string[];
    message?: string;
  } | null>(null);

  const triggerCalculation = async () => {
    const apiBaseUrl = customApiUrl || getApiBaseUrl();
    
    setIsLoading(true);
    setResult(null);

    try {
      const response = await authenticatedFetch(`${apiBaseUrl}/api/v1/calculations`, {
        method: 'POST',
      });

      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);

      if (onSuccess) {
        onSuccess(data);
      }

      // Auto-clear success message after 5 seconds
      if (!data.errors || data.errors.length === 0) {
        setTimeout(() => {
          setResult(null);
        }, 5000);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setResult({
        processed: 0,
        errors: [errorMessage],
        message: 'Calculation failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getResultIcon = () => {
    if (!result) return null;
    
    if (result.errors && result.errors.length > 0) {
      return '⚠️';
    }
    
    if (result.processed === 0) {
      return 'ℹ️';
    }
    
    return '✅';
  };

  const getResultColor = () => {
    if (!result) return '';
    
    if (result.errors && result.errors.length > 0) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
    
    if (result.processed === 0) {
      return 'bg-blue-50 border-blue-200 text-blue-800';
    }
    
    return 'bg-green-50 border-green-200 text-green-800';
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">
            Emissions Calculation
          </h3>
          <p class="text-sm text-gray-600 mt-1">
            Process activity data and calculate carbon emissions
          </p>
        </div>
        
        <button
          onClick={triggerCalculation}
          disabled={isLoading}
          class={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
          }`}
        >
          {isLoading ? (
            <>
              <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Calculating...
            </>
          ) : (
            <>
              <svg class="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Calculate Emissions
            </>
          )}
        </button>
      </div>

      {result && (
        <div class={`rounded-md border p-4 ${getResultColor()}`}>
          <div class="flex">
            <div class="flex-shrink-0">
              <span class="text-lg">{getResultIcon()}</span>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium">
                {result.message || 'Calculation Complete'}
              </h3>
              <div class="mt-2 text-sm">
                <p>
                  {result.processed > 0 
                    ? `Successfully processed ${result.processed} activity record${result.processed !== 1 ? 's' : ''}.`
                    : 'No unprocessed activity data found.'
                  }
                </p>
                
                {result.errors && result.errors.length > 0 && (
                  <div class="mt-2">
                    <p class="font-medium">Errors encountered:</p>
                    <ul class="mt-1 list-disc list-inside space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index} class="text-xs">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {result.processed === 0 && !result.errors && (
                  <p class="text-xs mt-1">
                    Add some activity data first, then trigger calculations.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}