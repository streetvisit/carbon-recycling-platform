import { useEffect, useState } from 'preact/hooks';
import { getUKGridData, getFallbackGridData, type UKGridData } from '../lib/ukCarbonIntensityApi.ts';

// Use the API data type directly
type GridData = UKGridData;

export default function UKEnergyDashboard() {
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [previousData, setPreviousData] = useState<GridData | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Component initialization
  useEffect(() => {
    // Component initialized - ready for live updates
  }, []);

  // Fetch real UK grid data from Carbon Intensity API
  const fetchRealGridData = async (): Promise<GridData> => {
    try {
      return await getUKGridData();
    } catch (error) {
      console.warn('Failed to fetch real UK grid data, using fallback:', error);
      return getFallbackGridData();
    }
  };

  useEffect(() => {
    const updateData = async () => {
      try {
        // Don't show loading state for updates, only initial load
        if (!gridData) {
          setLoading(true);
        }
        setPreviousData(gridData);
        const newData = await fetchRealGridData();
        setGridData(newData);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error updating grid data:', error);
        // Keep previous data if update fails
      } finally {
        if (!gridData) {
          setLoading(false);
        }
      }
    };

    // Initial load
    updateData();
    
    // Update every 2 seconds for responsive live data
    const updateInterval = setInterval(() => {
      if (isLive) {
        updateData();
      }
    }, 2000); // 2 seconds - responsive live updates
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [isLive]); // Keep dependency array clean

  const getSourceColor = (source: string) => {
    const colors: { [key: string]: string } = {
      wind: 'bg-green-500',
      solar: 'bg-yellow-400',
      hydroelectric: 'bg-blue-400',
      nuclear: 'bg-purple-500',
      gas: 'bg-gray-500',
      coal: 'bg-gray-800',
      biomass: 'bg-orange-500',
      imports: 'bg-blue-600',
      other: 'bg-gray-400',
    };
    return colors[source] || 'bg-gray-400';
  };

  const getSourceIcon = (source: string) => {
    const icons: { [key: string]: string } = {
      wind: '💨',
      solar: '☀️',
      hydroelectric: '💧',
      nuclear: '⚛️',
      gas: '🔥',
      coal: '⚫',
      biomass: '🌿',
      imports: '🔌',
      other: '⚡',
    };
    return icons[source] || '⚡';
  };

  const getCarbonIntensityColor = (intensity: number) => {
    if (intensity < 100) return 'text-green-600 bg-green-100';
    if (intensity < 200) return 'text-yellow-600 bg-yellow-100';
    if (intensity < 300) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Removed animation functions to fix glitchy interface

  if (loading || !gridData) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} class="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div class="h-32 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-white rounded-lg overflow-hidden">
      {/* Compact Header */}
      <div class="bg-gradient-to-r from-blue-500 to-green-500 p-3 text-white">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <span class="text-lg font-semibold">🇬🇧 Live Grid</span>
            {isLive && (
              <div class="ml-2 w-1.5 h-1.5 bg-green-300 rounded-full"></div>
            )}
          </div>
          <div class="text-right text-sm">
            <div class="opacity-90">{formatTime(lastUpdated)}</div>
          </div>
        </div>
      </div>

      <div class="p-4">
        {/* Key Metrics */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div class="bg-blue-50 rounded-lg p-3 text-center">
            <div class="text-lg mb-1">⚡</div>
            <div class="text-lg font-bold text-gray-900">
              {gridData.demand} GW
            </div>
            <div class="text-xs text-gray-600">Demand</div>
          </div>

          <div class="bg-green-50 rounded-lg p-3 text-center">
            <div class="text-lg mb-1">🔋</div>
            <div class="text-lg font-bold text-gray-900">
              {gridData.generation} GW
            </div>
            <div class="text-xs text-gray-600">Generation</div>
          </div>

          <div class={`rounded-lg p-3 text-center ${
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-green') ? 'bg-green-50' : 
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-yellow') ? 'bg-yellow-50' : 
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-orange') ? 'bg-orange-50' : 'bg-red-50'
          }`}>
            <div class="text-lg mb-1">🌍</div>
            <div class="text-lg font-bold text-gray-900">
              {gridData.carbonIntensity}g
            </div>
            <div class="text-xs text-gray-600">CO₂/kWh</div>
          </div>

          <div class="bg-purple-50 rounded-lg p-3 text-center">
            <div class="text-lg mb-1">💰</div>
            <div class="text-lg font-bold text-gray-900">
              £{gridData.price}
            </div>
            <div class="text-xs text-gray-600">/MWh</div>
          </div>
        </div>

        {/* Energy Mix - Compact */}
        <div class="mb-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Generation Mix</h4>
          
          {/* Compact Stacked Bar */}
          <div class="w-full h-4 bg-gray-200 rounded overflow-hidden mb-3 flex">
            {Object.entries(gridData.generationMix).map(([source, value], index) => {
              const percentage = (value / gridData.generation) * 100;
              
              return percentage > 0 ? (
                <div
                  key={source}
                  class={`${getSourceColor(source)}`}
                  style={{ width: `${percentage}%` }}
                  title={`${source}: ${value} GW (${percentage.toFixed(1)}%)`}
                ></div>
              ) : null;
            })}
          </div>

          {/* Compact Legend - Show top 4 sources only */}
          <div class="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(gridData.generationMix)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 4)
              .map(([source, value]) => {
                const percentage = (value / gridData.generation) * 100;
                return value > 0 ? (
                  <div key={source} class="flex items-center space-x-1">
                    <div class={`w-2 h-2 rounded ${getSourceColor(source)}`}></div>
                    <span class="capitalize">{source}</span>
                    <span class="font-medium">{percentage.toFixed(1)}%</span>
                  </div>
                ) : null;
              })
            }
          </div>
        </div>


        {/* Grid Status Indicators - Compact */}
        <div class="bg-gray-50 rounded p-3">
          <h5 class="text-sm font-medium text-gray-900 mb-2">Grid Status</h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-gray-600">Renewables</span>
              <span class={`font-medium px-2 py-0.5 rounded ${
                gridData.percentages.renewables > 50 
                  ? 'bg-green-100 text-green-800' 
                  : gridData.percentages.renewables > 30 
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {gridData.percentages.renewables > 50 ? 'High' : gridData.percentages.renewables > 30 ? 'Medium' : 'Low'}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-gray-600">Intensity</span>
              <span class={`font-medium px-2 py-0.5 rounded ${getCarbonIntensityColor(gridData.carbonIntensity)}`}>
                {gridData.carbonIntensity < 100 ? 'Low' : gridData.carbonIntensity < 200 ? 'Medium' : gridData.carbonIntensity < 300 ? 'High' : 'Very High'}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-gray-600">Balance</span>
              <span class={`font-medium px-2 py-0.5 rounded ${
                gridData.generation > gridData.demand 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {gridData.generation > gridData.demand ? 'Surplus' : 'Balanced'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Compact Footer */}
      <div class="bg-gray-50 px-4 py-2 border-t border-gray-200">
        <div class="flex flex-col space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500">Updates every 2s</span>
            <button 
              onClick={() => setIsLive(!isLive)}
              class={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                isLive 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div class={`w-1.5 h-1.5 rounded-full ${
                isLive ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span>{isLive ? 'Live' : 'Paused'}</span>
            </button>
          </div>
          <div class="text-[10px] text-gray-400">
            Data: <a href="https://carbonintensity.org.uk/" target="_blank" rel="noopener" class="underline hover:text-gray-600">Carbon Intensity API</a> • 
            Contains BMRS data © Elexon Limited copyright and database right 2025
          </div>
        </div>
      </div>
    </div>
  );
}