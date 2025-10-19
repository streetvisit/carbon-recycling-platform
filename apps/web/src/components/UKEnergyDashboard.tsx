import { useEffect, useState } from 'preact/hooks';

interface GridData {
  timestamp: string;
  demand: number; // GW
  generation: number; // GW
  carbonIntensity: number; // gCO2/kWh
  price: number; // £/MWh
  generationMix: {
    gas: number;
    nuclear: number;
    wind: number;
    solar: number;
    hydroelectric: number;
    biomass: number;
    coal: number;
    imports: number;
    other: number;
  };
  percentages: {
    renewables: number;
    fossil: number;
    nuclear: number;
    imports: number;
  };
}

export default function UKEnergyDashboard() {
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [previousData, setPreviousData] = useState<GridData | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Mock data that simulates real UK grid data patterns with micro-fluctuations
  const generateMockData = (isLiveUpdate = false): GridData => {
    const now = new Date();
    const hour = now.getHours();
    
    // For live updates, create smaller fluctuations from previous data
    if (isLiveUpdate && gridData) {
      const fluctuation = 0.05; // 5% maximum fluctuation for live updates
      
      const demand = Math.max(20, gridData.demand + (Math.random() - 0.5) * gridData.demand * fluctuation);
      
      // Fluctuate each generation source slightly
      const wind = Math.max(1, gridData.generationMix.wind + (Math.random() - 0.5) * 2);
      const solar = Math.max(0, gridData.generationMix.solar + (Math.random() - 0.5) * 0.5);
      const nuclear = Math.max(3, gridData.generationMix.nuclear + (Math.random() - 0.5) * 0.3);
      const hydroelectric = Math.max(0.1, gridData.generationMix.hydroelectric + (Math.random() - 0.5) * 0.1);
      const biomass = Math.max(1, gridData.generationMix.biomass + (Math.random() - 0.5) * 0.3);
      const imports = Math.max(0, gridData.generationMix.imports + (Math.random() - 0.5) * 1);
      const gas = Math.max(3, demand - wind - solar - nuclear - hydroelectric - biomass - imports - 0.5);
      const coal = 0;
      const other = 0.5;
      
      const totalGeneration = gas + nuclear + wind + solar + hydroelectric + biomass + coal + imports + other;
      
      // Calculate percentages
      const renewables = ((wind + solar + hydroelectric) / totalGeneration) * 100;
      const fossil = ((gas + coal) / totalGeneration) * 100;
      const nuclearPercent = (nuclear / totalGeneration) * 100;
      const importsPercent = (imports / totalGeneration) * 100;
      
      // Carbon intensity with slight fluctuation
      const carbonIntensity = Math.round(
        (gas * 350 + coal * 850 + biomass * 120 + imports * 200) / totalGeneration + (Math.random() - 0.5) * 10
      );
      
      // Price with market-like fluctuations
      const priceFluctuation = 1 + (Math.random() - 0.5) * 0.1;
      const price = Math.round(gridData.price * priceFluctuation);

      return {
        timestamp: now.toISOString(),
        demand: Math.round(demand * 10) / 10,
        generation: Math.round(totalGeneration * 10) / 10,
        carbonIntensity,
        price,
        generationMix: {
          gas: Math.round(gas * 10) / 10,
          nuclear: Math.round(nuclear * 10) / 10,
          wind: Math.round(wind * 10) / 10,
          solar: Math.round(solar * 10) / 10,
          hydroelectric: Math.round(hydroelectric * 10) / 10,
          biomass: Math.round(biomass * 10) / 10,
          coal,
          imports: Math.round(imports * 10) / 10,
          other: Math.round(other * 10) / 10,
        },
        percentages: {
          renewables: Math.round(renewables * 10) / 10,
          fossil: Math.round(fossil * 10) / 10,
          nuclear: Math.round(nuclearPercent * 10) / 10,
          imports: Math.round(importsPercent * 10) / 10,
        }
      };
    }
    
    // Full regeneration for initial load or major updates
    // Simulate demand patterns (higher during day, lower at night)
    const baseDemand = 25 + (Math.sin((hour - 6) * Math.PI / 12) * 8) + (Math.random() - 0.5) * 2;
    
    // Generate realistic energy mix with more variation
    const wind = Math.max(2, 15 + (Math.random() - 0.5) * 10);
    const solar = hour > 6 && hour < 18 ? Math.max(0, 3 + (Math.random() - 0.5) * 5) : Math.random() * 0.2;
    const nuclear = 4 + (Math.random() - 0.5) * 1.5;
    const gas = Math.max(5, baseDemand - wind - solar - nuclear - 3);
    const hydroelectric = 0.3 + (Math.random() - 0.5) * 0.3;
    const biomass = 2 + (Math.random() - 0.5) * 0.8;
    const coal = 0; // UK has phased out coal
    const imports = Math.max(0, 2 + (Math.random() - 0.5) * 4);
    const other = 0.5;
    
    const totalGeneration = gas + nuclear + wind + solar + hydroelectric + biomass + coal + imports + other;
    
    // Calculate percentages
    const renewables = ((wind + solar + hydroelectric) / totalGeneration) * 100;
    const fossil = ((gas + coal) / totalGeneration) * 100;
    const nuclearPercent = (nuclear / totalGeneration) * 100;
    const importsPercent = (imports / totalGeneration) * 100;
    
    // Carbon intensity calculation (simplified)
    const carbonIntensity = Math.round(
      (gas * 350 + coal * 850 + biomass * 120 + imports * 200) / totalGeneration
    );
    
    // Price simulation (higher when demand is high or renewables are low)
    const basePrice = 60;
    const demandMultiplier = baseDemand > 30 ? 1.5 : 1;
    const renewableMultiplier = renewables < 40 ? 1.3 : 0.9;
    const price = Math.round(basePrice * demandMultiplier * renewableMultiplier * (1 + (Math.random() - 0.5) * 0.2));

    return {
      timestamp: now.toISOString(),
      demand: Math.round(baseDemand * 10) / 10,
      generation: Math.round(totalGeneration * 10) / 10,
      carbonIntensity,
      price,
      generationMix: {
        gas: Math.round(gas * 10) / 10,
        nuclear: Math.round(nuclear * 10) / 10,
        wind: Math.round(wind * 10) / 10,
        solar: Math.round(solar * 10) / 10,
        hydroelectric: Math.round(hydroelectric * 10) / 10,
        biomass: Math.round(biomass * 10) / 10,
        coal,
        imports: Math.round(imports * 10) / 10,
        other: Math.round(other * 10) / 10,
      },
      percentages: {
        renewables: Math.round(renewables * 10) / 10,
        fossil: Math.round(fossil * 10) / 10,
        nuclear: Math.round(nuclearPercent * 10) / 10,
        imports: Math.round(importsPercent * 10) / 10,
      }
    };
  };

  useEffect(() => {
    const updateData = (isLive = false) => {
      setPreviousData(gridData);
      setGridData(generateMockData(isLive));
      setLastUpdated(new Date());
      setLoading(false);
    };

    updateData(); // Initial load
    
    // Major updates every 30 seconds
    const majorUpdateInterval = setInterval(() => updateData(), 30000);
    
    // Live micro-updates every 3-5 seconds for that "live" feel
    const liveUpdateInterval = setInterval(() => {
      if (gridData && isLive) {
        updateData(true);
      }
    }, 3000 + Math.random() * 2000); // Randomized 3-5 seconds
    
    return () => {
      clearInterval(majorUpdateInterval);
      clearInterval(liveUpdateInterval);
    };
  }, [gridData, isLive]);

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
      <div class={`bg-gradient-to-r from-blue-600 to-green-600 p-6 text-white relative overflow-hidden ${
        isLive ? 'animate-pulse' : ''
      }`}>
        {isLive && (
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer"></div>
        )}
        <div class="relative flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-bold mb-2 flex items-center">
              🇬🇧 UK Energy Grid 
              <span class={`ml-2 ${isLive ? 'animate-pulse' : ''}`}>Live</span>
              {isLive && (
                <div class="ml-3 flex items-center space-x-1">
                  <div class="w-1 h-1 bg-yellow-300 rounded-full animate-ping"></div>
                  <div class="w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                  <div class="w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}
            </h3>
            <p class="text-blue-100">Real-time electricity generation and carbon intensity</p>
          </div>
          <div class="text-right">
            <div class="text-sm opacity-90 flex items-center justify-end">
              <span>Last updated</span>
              {isLive && (
                <div class="ml-2 w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              )}
            </div>
            <div class="text-lg font-mono">{formatTime(lastUpdated)}</div>
          </div>
        </div>
      </div>

      <div class="p-6">
        {/* Key Metrics */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class={`bg-blue-50 rounded-lg p-4 text-center ${getLiveAnimationClass()}`}>
            <div class="text-2xl mb-2 animate-pulse">⚡</div>
            <div class="text-2xl font-bold text-gray-900 flex items-center justify-center">
              {gridData.demand} GW
              {getChangeIndicator(gridData.demand, previousData?.demand)}
            </div>
            <div class="text-sm text-gray-600">Demand</div>
          </div>

          <div class={`bg-green-50 rounded-lg p-4 text-center ${getLiveAnimationClass()}`}>
            <div class="text-2xl mb-2 animate-pulse">🔋</div>
            <div class="text-2xl font-bold text-gray-900 flex items-center justify-center">
              {gridData.generation} GW
              {getChangeIndicator(gridData.generation, previousData?.generation)}
            </div>
            <div class="text-sm text-gray-600">Generation</div>
          </div>

          <div class={`rounded-lg p-4 text-center ${getLiveAnimationClass()} ${
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-green') ? 'bg-green-50' : 
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-yellow') ? 'bg-yellow-50' : 
            getCarbonIntensityColor(gridData.carbonIntensity).includes('bg-orange') ? 'bg-orange-50' : 'bg-red-50'
          }`}>
            <div class="text-2xl mb-2 animate-pulse">🌍</div>
            <div class="text-2xl font-bold text-gray-900 flex items-center justify-center">
              {gridData.carbonIntensity}g
              {getChangeIndicator(gridData.carbonIntensity, previousData?.carbonIntensity)}
            </div>
            <div class="text-sm text-gray-600">CO₂/kWh</div>
          </div>

          <div class={`bg-purple-50 rounded-lg p-4 text-center ${getLiveAnimationClass()}`}>
            <div class="text-2xl mb-2 animate-pulse">💰</div>
            <div class="text-2xl font-bold text-gray-900 flex items-center justify-center">
              £{gridData.price}
              {getChangeIndicator(gridData.price, previousData?.price)}
            </div>
            <div class="text-sm text-gray-600">/MWh</div>
          </div>
        </div>

        {/* Energy Mix Visualization */}
        <div class="mb-8">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Energy Generation Mix</h4>
          
          {/* Stacked Bar */}
          <div class="w-full h-8 bg-gray-200 rounded-lg overflow-hidden mb-4 flex relative">
            {Object.entries(gridData.generationMix).map(([source, value], index) => {
              const percentage = (value / gridData.generation) * 100;
              const previousValue = previousData?.generationMix[source as keyof typeof previousData.generationMix] || 0;
              const previousPercentage = previousData ? (previousValue / previousData.generation) * 100 : percentage;
              const hasChanged = Math.abs(percentage - previousPercentage) > 0.5;
              
              return percentage > 0 ? (
                <div
                  key={source}
                  class={`${getSourceColor(source)} flex items-center justify-center text-white text-xs font-bold transition-all duration-1000 ease-in-out ${
                    hasChanged ? 'animate-pulse' : ''
                  }`}
                  style={{ width: `${percentage}%` }}
                  title={`${source}: ${value} GW (${percentage.toFixed(1)}%)`}
                >
                  {percentage > 8 && (
                    <span class={hasChanged ? 'animate-bounce' : ''}>
                      {getSourceIcon(source)}
                    </span>
                  )}
                  {hasChanged && (
                    <div class="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded animate-pulse opacity-75"></div>
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
          <div class={`bg-green-50 rounded-lg p-4 ${getLiveAnimationClass()}`}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-green-700 font-medium">🌱 Renewables</span>
              <span class="text-green-900 font-bold flex items-center">
                {gridData.percentages.renewables}%
                {getChangeIndicator(gridData.percentages.renewables, previousData?.percentages.renewables)}
              </span>
            </div>
            <div class="text-sm text-green-600">Wind + Solar + Hydro</div>
            <div class="w-full bg-green-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-green-600 h-1.5 rounded-full transition-all duration-1000 ease-in-out" 
                style={{ width: `${Math.min(100, gridData.percentages.renewables)}%` }}
              ></div>
            </div>
          </div>

          <div class={`bg-gray-50 rounded-lg p-4 ${getLiveAnimationClass()}`}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-700 font-medium">🔥 Fossil Fuels</span>
              <span class="text-gray-900 font-bold flex items-center">
                {gridData.percentages.fossil}%
                {getChangeIndicator(gridData.percentages.fossil, previousData?.percentages.fossil)}
              </span>
            </div>
            <div class="text-sm text-gray-600">Gas + Coal</div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-gray-600 h-1.5 rounded-full transition-all duration-1000 ease-in-out" 
                style={{ width: `${Math.min(100, gridData.percentages.fossil)}%` }}
              ></div>
            </div>
          </div>

          <div class={`bg-purple-50 rounded-lg p-4 ${getLiveAnimationClass()}`}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-purple-700 font-medium">⚙️ Nuclear</span>
              <span class="text-purple-900 font-bold flex items-center">
                {gridData.percentages.nuclear}%
                {getChangeIndicator(gridData.percentages.nuclear, previousData?.percentages.nuclear)}
              </span>
            </div>
            <div class="text-sm text-purple-600">Low Carbon</div>
            <div class="w-full bg-purple-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-purple-600 h-1.5 rounded-full transition-all duration-1000 ease-in-out" 
                style={{ width: `${Math.min(100, gridData.percentages.nuclear)}%` }}
              ></div>
            </div>
          </div>

          <div class={`bg-blue-50 rounded-lg p-4 ${getLiveAnimationClass()}`}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-blue-700 font-medium">🔌 Imports</span>
              <span class="text-blue-900 font-bold flex items-center">
                {gridData.percentages.imports}%
                {getChangeIndicator(gridData.percentages.imports, previousData?.percentages.imports)}
              </span>
            </div>
            <div class="text-sm text-blue-600">Interconnectors</div>
            <div class="w-full bg-blue-200 rounded-full h-1.5 mt-2">
              <div 
                class="bg-blue-600 h-1.5 rounded-full transition-all duration-1000 ease-in-out" 
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
            <span>Data simulates live UK grid patterns</span>
            <span class="text-gray-300">•</span>
            <span>Major updates every 30s, micro-changes every 3-5s</span>
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
                isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
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