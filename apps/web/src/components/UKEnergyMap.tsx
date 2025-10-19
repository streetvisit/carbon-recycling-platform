import { useEffect, useState } from 'preact/hooks';

interface RegionData {
  name: string;
  renewableCapacity: number; // MW
  currentGeneration: number; // MW
  carbonIntensity: number; // gCO2/kWh
  population: number;
  windFarms: number;
  solarFarms: number;
  nuclearPlants: number;
  dominantSource: 'wind' | 'nuclear' | 'gas' | 'solar' | 'hydro';
}

interface UKRegionMap {
  [key: string]: RegionData;
}

export default function UKEnergyMap() {
  const [regionData, setRegionData] = useState<UKRegionMap>({});
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate realistic regional data
  const generateRegionData = (): UKRegionMap => {
    const regions = {
      scotland: {
        name: 'Scotland',
        renewableCapacity: 14500,
        currentGeneration: 8200 + Math.random() * 2000,
        carbonIntensity: 50 + Math.random() * 30,
        population: 5500000,
        windFarms: 180,
        solarFarms: 25,
        nuclearPlants: 2,
        dominantSource: 'wind' as const,
      },
      northern_england: {
        name: 'Northern England',
        renewableCapacity: 6800,
        currentGeneration: 4200 + Math.random() * 1500,
        carbonIntensity: 120 + Math.random() * 40,
        population: 15000000,
        windFarms: 95,
        solarFarms: 180,
        nuclearPlants: 3,
        dominantSource: 'wind' as const,
      },
      midlands: {
        name: 'Midlands',
        renewableCapacity: 4200,
        currentGeneration: 2800 + Math.random() * 1000,
        carbonIntensity: 180 + Math.random() * 60,
        population: 10800000,
        windFarms: 45,
        solarFarms: 240,
        nuclearPlants: 0,
        dominantSource: 'gas' as const,
      },
      eastern_england: {
        name: 'Eastern England',
        renewableCapacity: 5600,
        currentGeneration: 3400 + Math.random() * 1200,
        carbonIntensity: 140 + Math.random() * 50,
        population: 6200000,
        windFarms: 85,
        solarFarms: 320,
        nuclearPlants: 1,
        dominantSource: 'wind' as const,
      },
      london_southeast: {
        name: 'London & Southeast',
        renewableCapacity: 3200,
        currentGeneration: 1800 + Math.random() * 800,
        carbonIntensity: 200 + Math.random() * 80,
        population: 18000000,
        windFarms: 15,
        solarFarms: 450,
        nuclearPlants: 0,
        dominantSource: 'gas' as const,
      },
      southwest: {
        name: 'Southwest England',
        renewableCapacity: 3800,
        currentGeneration: 2200 + Math.random() * 900,
        carbonIntensity: 110 + Math.random() * 45,
        population: 5700000,
        windFarms: 55,
        solarFarms: 290,
        nuclearPlants: 2,
        dominantSource: 'nuclear' as const,
      },
      wales: {
        name: 'Wales',
        renewableCapacity: 2400,
        currentGeneration: 1600 + Math.random() * 600,
        carbonIntensity: 90 + Math.random() * 35,
        population: 3100000,
        windFarms: 65,
        solarFarms: 85,
        nuclearPlants: 1,
        dominantSource: 'hydro' as const,
      },
      northern_ireland: {
        name: 'Northern Ireland',
        renewableCapacity: 1200,
        currentGeneration: 800 + Math.random() * 300,
        carbonIntensity: 160 + Math.random() * 55,
        population: 1900000,
        windFarms: 35,
        solarFarms: 15,
        nuclearPlants: 0,
        dominantSource: 'wind' as const,
      },
    };

    return regions;
  };

  useEffect(() => {
    const updateData = () => {
      setRegionData(generateRegionData());
      setLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getRegionColor = (region: RegionData) => {
    const intensity = region.carbonIntensity;
    if (intensity < 100) return '#10b981'; // Green
    if (intensity < 150) return '#f59e0b'; // Yellow
    if (intensity < 200) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const getSourceIcon = (source: string) => {
    const icons = {
      wind: '💨',
      nuclear: '⚛️',
      gas: '🔥',
      solar: '☀️',
      hydro: '💧',
    };
    return icons[source as keyof typeof icons] || '⚡';
  };

  if (loading) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <h3 class="text-2xl font-bold mb-2">🗺️ UK Regional Energy Map</h3>
        <p class="text-indigo-100">Live generation capacity and carbon intensity by region</p>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div class="lg:col-span-2">
            <div class="relative bg-gradient-to-b from-blue-50 to-green-50 rounded-lg p-4" style={{ height: '500px' }}>
              {/* UK SVG Map */}
              <svg
                viewBox="0 0 400 600"
                class="w-full h-full"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              >
                {/* Scotland */}
                <path
                  d="M180 50 L220 45 L240 60 L250 80 L245 120 L235 140 L220 150 L200 155 L180 150 L160 140 L150 120 L145 100 L150 80 L165 65 Z"
                  fill={getRegionColor(regionData.scotland)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('scotland')}
                  onMouseEnter={() => setHoveredRegion('scotland')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />
                
                {/* Northern Ireland */}
                <path
                  d="M80 180 L110 175 L120 190 L115 210 L105 220 L85 225 L70 220 L65 205 L70 190 Z"
                  fill={getRegionColor(regionData.northern_ireland)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('northern_ireland')}
                  onMouseEnter={() => setHoveredRegion('northern_ireland')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* Northern England */}
                <path
                  d="M145 160 L245 155 L250 180 L245 220 L235 240 L220 250 L200 255 L180 250 L160 240 L145 220 L140 200 L142 180 Z"
                  fill={getRegionColor(regionData.northern_england)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('northern_england')}
                  onMouseEnter={() => setHoveredRegion('northern_england')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* Wales */}
                <path
                  d="M120 240 L140 235 L145 255 L150 275 L145 295 L135 310 L125 315 L115 310 L105 295 L100 275 L105 255 L110 245 Z"
                  fill={getRegionColor(regionData.wales)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('wales')}
                  onMouseEnter={() => setHoveredRegion('wales')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* Midlands */}
                <path
                  d="M150 260 L235 255 L240 280 L235 310 L225 330 L210 340 L190 345 L170 340 L155 330 L145 310 L140 290 L145 270 Z"
                  fill={getRegionColor(regionData.midlands)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('midlands')}
                  onMouseEnter={() => setHoveredRegion('midlands')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* Eastern England */}
                <path
                  d="M240 260 L280 255 L290 275 L285 305 L275 325 L260 335 L245 340 L235 330 L230 310 L235 290 L238 275 Z"
                  fill={getRegionColor(regionData.eastern_england)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('eastern_england')}
                  onMouseEnter={() => setHoveredRegion('eastern_england')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* Southwest England */}
                <path
                  d="M120 320 L155 335 L190 350 L200 370 L195 400 L185 420 L170 430 L150 425 L130 415 L115 400 L105 380 L110 360 L112 340 Z"
                  fill={getRegionColor(regionData.southwest)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('southwest')}
                  onMouseEnter={() => setHoveredRegion('southwest')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* London & Southeast */}
                <path
                  d="M195 350 L245 345 L275 340 L290 355 L285 385 L275 405 L260 420 L240 430 L220 435 L200 430 L185 420 L175 405 L170 385 L175 365 Z"
                  fill={getRegionColor(regionData.london_southeast)}
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-300 hover:opacity-80"
                  onClick={() => setSelectedRegion('london_southeast')}
                  onMouseEnter={() => setHoveredRegion('london_southeast')}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* Generation Icons */}
                {Object.entries(regionData).map(([key, region], index) => {
                  const positions = {
                    scotland: { x: 200, y: 100 },
                    northern_ireland: { x: 90, y: 200 },
                    northern_england: { x: 195, y: 200 },
                    wales: { x: 125, y: 275 },
                    midlands: { x: 190, y: 300 },
                    eastern_england: { x: 260, y: 300 },
                    southwest: { x: 155, y: 375 },
                    london_southeast: { x: 230, y: 390 },
                  };
                  
                  const pos = positions[key as keyof typeof positions];
                  if (!pos) return null;

                  return (
                    <g key={key}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="8"
                        fill="white"
                        stroke={getRegionColor(region)}
                        stroke-width="2"
                        class="animate-pulse"
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 2}
                        text-anchor="middle"
                        class="text-xs font-bold"
                        fill={getRegionColor(region)}
                      >
                        {getSourceIcon(region.dominantSource)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Legend */}
              <div class="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4">
                <h4 class="text-sm font-semibold text-gray-900 mb-2">Carbon Intensity</h4>
                <div class="space-y-1 text-xs">
                  <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 rounded bg-green-500"></div>
                    <span>Low (&lt;100g)</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 rounded bg-yellow-500"></div>
                    <span>Medium (100-150g)</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 rounded bg-orange-500"></div>
                    <span>High (150-200g)</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 rounded bg-red-500"></div>
                    <span>Very High (&gt;200g)</span>
                  </div>
                </div>
              </div>

              {/* Hover tooltip */}
              {hoveredRegion && (
                <div class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
                  <div class="text-sm">
                    <h4 class="font-semibold text-gray-900">{regionData[hoveredRegion].name}</h4>
                    <div class="mt-2 space-y-1 text-xs text-gray-600">
                      <p>Generation: {Math.round(regionData[hoveredRegion].currentGeneration)} MW</p>
                      <p>Carbon: {Math.round(regionData[hoveredRegion].carbonIntensity)} gCO₂/kWh</p>
                      <p>Primary: {getSourceIcon(regionData[hoveredRegion].dominantSource)} {regionData[hoveredRegion].dominantSource}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Region Details */}
          <div class="lg:col-span-1">
            <div class="bg-gray-50 rounded-lg p-4">
              <h4 class="text-lg font-semibold text-gray-900 mb-4">Regional Breakdown</h4>
              
              {selectedRegion ? (
                <div class="space-y-4">
                  <div class="bg-white rounded-lg p-4">
                    <h5 class="font-medium text-gray-900 flex items-center">
                      {getSourceIcon(regionData[selectedRegion].dominantSource)} {regionData[selectedRegion].name}
                    </h5>
                    <div class="mt-3 space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-gray-600">Current Generation:</span>
                        <span class="font-medium">{Math.round(regionData[selectedRegion].currentGeneration)} MW</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Capacity:</span>
                        <span class="font-medium">{regionData[selectedRegion].renewableCapacity} MW</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Carbon Intensity:</span>
                        <span class="font-medium" style={{ color: getRegionColor(regionData[selectedRegion]) }}>
                          {Math.round(regionData[selectedRegion].carbonIntensity)} gCO₂/kWh
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Population:</span>
                        <span class="font-medium">{(regionData[selectedRegion].population / 1000000).toFixed(1)}M</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Wind Farms:</span>
                        <span class="font-medium">{regionData[selectedRegion].windFarms}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Solar Farms:</span>
                        <span class="font-medium">{regionData[selectedRegion].solarFarms}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Nuclear Plants:</span>
                        <span class="font-medium">{regionData[selectedRegion].nuclearPlants}</span>
                      </div>
                    </div>
                    
                    {/* Capacity Utilization */}
                    <div class="mt-4">
                      <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-600">Capacity Utilization</span>
                        <span class="font-medium">
                          {Math.round((regionData[selectedRegion].currentGeneration / regionData[selectedRegion].renewableCapacity) * 100)}%
                        </span>
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div
                          class="h-2 rounded-full transition-all duration-1000 ease-in-out"
                          style={{
                            width: `${Math.min(100, (regionData[selectedRegion].currentGeneration / regionData[selectedRegion].renewableCapacity) * 100)}%`,
                            backgroundColor: getRegionColor(regionData[selectedRegion])
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div class="text-center py-8">
                  <div class="text-4xl mb-4">🗺️</div>
                  <p class="text-gray-600 mb-2">Click on a region to view detailed energy data</p>
                  <p class="text-xs text-gray-500">Hover over regions to see quick stats</p>
                </div>
              )}

              {/* Top Performers */}
              <div class="mt-6">
                <h5 class="font-medium text-gray-900 mb-3">🏆 Cleanest Regions</h5>
                <div class="space-y-2">
                  {Object.entries(regionData)
                    .sort(([,a], [,b]) => a.carbonIntensity - b.carbonIntensity)
                    .slice(0, 3)
                    .map(([key, region], index) => (
                      <div
                        key={key}
                        class="flex items-center justify-between p-2 bg-white rounded cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedRegion(key)}
                      >
                        <div class="flex items-center space-x-2">
                          <span class="text-lg">{['🥇', '🥈', '🥉'][index]}</span>
                          <span class="text-sm font-medium">{region.name}</span>
                        </div>
                        <span class="text-xs font-medium" style={{ color: getRegionColor(region) }}>
                          {Math.round(region.carbonIntensity)}g
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}