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
        setLoading(true);
        setPreviousData(gridData);
        const newData = await fetchRealGridData();
        setGridData(newData);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error updating grid data:', error);
        // Keep previous data if update fails
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    updateData();
    
    // Update every 30 minutes to match Carbon Intensity API update frequency
    const updateInterval = setInterval(() => {
      if (isLive) {
        updateData();
      }
    }, 30 * 60 * 1000); // 30 minutes
    
    return () => {
      clearInterval(updateInterval);
    };
  }, [isLive]); // Removed gridData dependency to prevent infinite loops

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

  // Helper to detect value changes and show visual indicators
  const getChangeIndicator = (current: number, previous: number | undefined) => {
    if (!previous || current === previous) return null;
    const change = current - previous;
    const isIncrease = change > 0;
    const absChange = Math.abs(change);
    
    // Only show significant changes (>0.1)
    if (absChange < 0.1) return null;
    
    return (
      <span class={`ml-1 text-xs font-bold animate-pulse ${
        isIncrease ? 'text-green-600' : 'text-red-600'
      }`}>
        {isIncrease ? '↗' : '↘'}
      </span>
    );
  };

  // Live pulse animation class
  const getLiveAnimationClass = () => {
    return isLive ? 'transition-all duration-1000 ease-in-out' : '';
  };

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
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-r from-blue-600 to-green-600 p-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-bold mb-2 flex items-center">
              🇬🇧 UK Energy Grid Live
              {isLive && (
                <div class="ml-3 w-2 h-2 bg-green-300 rounded-full"></div>
              )}
            </h3>
            <p class="text-blue-100">Real-time electricity generation and carbon intensity</p>
          </div>
          <div class="text-right">
            <div class="text-sm opacity-90">Last updated</div>
            <div class="text-lg font-mono">{formatTime(lastUpdated)}</div>
          </div>
        </div>
      </div>

      <div class="p-6">
        {/* Key Metrics */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-blue-50 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">⚡</div>
            <div class="text-2xl font-bold text-gray-900">
              {gridData.demand} GW
            </div>
            <div class="text-sm text-gray-600">Demand</div>
          </div>

          <div class="bg-green-50 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">🔋</div>
            <div class="text-2xl font-bold text-gray-900">
              {gridData.generation} GW
            </div>
            <div class="text-sm text-gray-600">Generation</div>
          </div>

          <div class={`rounded-lg p-4 text-center ${
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-green') ? 'bg-green-50' : 
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-yellow') ? 'bg-yellow-50' : 
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-orange') ? 'bg-orange-50' : 'bg-red-50'
          }`}>
            <div class="text-2xl mb-2">🌍</div>
            <div class="text-2xl font-bold text-gray-900">
              {gridData.carbonIntensity}g
            </div>
            <div class="text-sm text-gray-600">CO₂/kWh</div>
          </div>

          <div class="bg-purple-50 rounded-lg p-4 text-center">
            <div class="text-2xl mb-2">💰</div>
            <div class="text-2xl font-bold text-gray-900">
              £{gridData.price}
            </div>
            <div class="text-sm text-gray-600">/MWh</div>
          </div>
        </div>

        {/* Energy Mix Visualization */}
        <div class="mb-8">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Energy Generation Mix</h4>
          
          {/* Stacked Bar */}
          <div class="w-full h-8 bg-gray-200 rounded-lg overflow-hidden mb-4 flex">
            {Object.entries(gridData.generationMix).map(([source, value], index) => {
              const percentage = (value / gridData.generation) * 100;
              
              return percentage > 0 ? (
                <div
                  key={source}
                  class={`${getSourceColor(source)} flex items-center justify-center text-white text-xs font-bold`}
                  style={{ width: `${percentage}%` }}
                  title={`${source}: ${value} GW (${percentage.toFixed(1)}%)`}
                >
                  {percentage > 8 && (
                    <span>
                      {getSourceIcon(source)}
                    </span>
                  )}
                </div>
              ) : null;
            })}
          </div>

          {/* Legend */}
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
            {Object.entries(gridData.generationMix).map(([source, value]) => {
              const percentage = (value / gridData.generation) * 100;
              return value > 0 ? (
                <div key={source} class="flex items-center space-x-2">
                  <div class={`w-3 h-3 rounded ${getSourceColor(source)}`}></div>
                  <span class="capitalize">{source}</span>
                  <span class="font-medium">{percentage.toFixed(1)}%</span>
                </div>
              ) : null;
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-green-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-green-700 font-medium">🌱 Renewables</span>
              <span class="text-green-900 font-bold">
                {gridData.percentages.renewables}%
              </span>
            </div>
            <div class="text-sm text-green-600">Wind + Solar + Hydro</div>
            <div class="w-full bg-green-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-green-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, gridData.percentages.renewables)}%` }}
              ></div>
            </div>
          </div>

          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-700 font-medium">🔥 Fossil Fuels</span>
              <span class="text-gray-900 font-bold">
                {gridData.percentages.fossil}%
              </span>
            </div>
            <div class="text-sm text-gray-600">Gas + Coal</div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-gray-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, gridData.percentages.fossil)}%` }}
              ></div>
            </div>
          </div>

          <div class="bg-purple-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-purple-700 font-medium">⚙️ Nuclear</span>
              <span class="text-purple-900 font-bold">
                {gridData.percentages.nuclear}%
              </span>
            </div>
            <div class="text-sm text-purple-600">Low Carbon</div>
            <div class="w-full bg-purple-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-purple-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, gridData.percentages.nuclear)}%` }}
              ></div>
            </div>
          </div>

          <div class="bg-blue-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-blue-700 font-medium">🔌 Imports</span>
              <span class="text-blue-900 font-bold">
                {gridData.percentages.imports}%
              </span>
            </div>
            <div class="text-sm text-blue-600">Interconnectors</div>
            <div class="w-full bg-blue-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-blue-600 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, gridData.percentages.imports)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Grid Status Indicators */}
        <div class="bg-gray-50 rounded-lg p-4">
          <h5 class="font-medium text-gray-900 mb-3">Grid Status</h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-gray-600">Renewable Share:</span>
              <span class={`font-medium px-2 py-1 rounded ${
                gridData.percentages.renewables > 50 
                  ? 'bg-green-100 text-green-800' 
                  : gridData.percentages.renewables > 30 
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {gridData.percentages.renewables > 50 ? '🟢 High' : gridData.percentages.renewables > 30 ? '🟡 Medium' : '🔴 Low'}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-gray-600">Carbon Intensity:</span>
              <span class={`font-medium px-2 py-1 rounded ${getCarbonIntensityColor(gridData.carbonIntensity)}`}>
                {gridData.carbonIntensity < 100 ? '🟢 Low' : gridData.carbonIntensity < 200 ? '🟡 Medium' : gridData.carbonIntensity < 300 ? '🟠 High' : '🔴 Very High'}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-gray-600">Supply Balance:</span>
              <span class={`font-medium px-2 py-1 rounded ${
                gridData.generation > gridData.demand 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {gridData.generation > gridData.demand ? '🟢 Surplus' : '🔵 Balanced'}
              </span>
            </div>
          </div>
        </div>

        {/* Connection to Platform */}
        <div class="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <h5 class="font-medium text-gray-900 mb-2">💡 Context for Your Carbon Journey</h5>
          <div class="text-sm text-gray-700 space-y-1">
            <p>• Current grid intensity: <strong>{gridData.carbonIntensity}g CO₂/kWh</strong> - Factor this into your energy consumption planning</p>
            <p>• Renewables at <strong>{gridData.percentages.renewables}%</strong> - {gridData.percentages.renewables > 40 ? 'Great time for energy-intensive activities' : 'Consider timing energy use for cleaner periods'}</p>
            <p>• Use our <a href="/dashboard/analytics" class="text-purple-600 hover:text-purple-700 font-medium">Analytics Dashboard</a> to track how grid changes affect your carbon footprint</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div class="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div class="flex items-center justify-between text-xs text-gray-500">
          <div class="flex items-center space-x-3">
            <span>Data from National Grid ESO Carbon Intensity API</span>
            <span class="text-gray-300">•</span>
            <span>Updates every 30 minutes</span>
          </div>
          <div class="flex items-center space-x-3">
            <button 
              onClick={() => setIsLive(!isLive)}
              class={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isLive 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div class={`w-2 h-2 rounded-full ${
                isLive ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span>{isLive ? 'Live' : 'Paused'}</span>
            </button>
            <div class="text-gray-400 text-xs">
              Last: {formatTime(lastUpdated)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}