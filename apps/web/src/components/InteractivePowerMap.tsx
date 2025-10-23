import { useEffect, useState, useRef } from 'preact/hooks';
import { getAllPowerStations, getFuelColor, getFuelIcon, type PowerStation } from '../lib/powerStationsApi';

interface MapMarker {
  station: PowerStation;
  element: HTMLDivElement;
}

export default function InteractivePowerMap() {
  const [stations, setStations] = useState<PowerStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<PowerStation | null>(null);
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const data = await getAllPowerStations();
        console.log(`Loaded ${data.length} power stations`);
        setStations(data);
      } catch (error) {
        console.error('Error loading power stations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStations();
  }, []);

  // Calculate statistics
  const totalCapacity = stations.reduce((sum, s) => sum + s.registeredCapacity, 0);
  const fuelTypes = [...new Set(stations.map(s => s.fuelType))].sort();
  
  const filteredStations = fuelFilter === 'all' 
    ? stations 
    : stations.filter(s => s.fuelType === fuelFilter);

  const capacityByFuel = fuelTypes.reduce((acc, fuel) => {
    acc[fuel] = stations
      .filter(s => s.fuelType === fuel)
      .reduce((sum, s) => sum + s.registeredCapacity, 0);
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <h3 class="text-2xl font-bold mb-2">⚡ UK Power Generation Map</h3>
        <p class="text-blue-100">{stations.length} power stations • {Math.round(totalCapacity).toLocaleString()} MW total capacity</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
        {/* Map Container */}
        <div class="lg:col-span-3">
          <div class="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg overflow-hidden" style={{ height: '600px' }}>
            {/* Simple SVG Map */}
            <svg
              viewBox="0 0 400 700"
              class="w-full h-full"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            >
              {/* UK Outline */}
              <path
                d="M200 50 Q180 55 170 70 L160 90 Q150 110 145 130 L140 160 Q135 180 135 200 L130 250 Q130 280 135 310 L145 360 Q155 400 170 440 L180 470 Q185 490 190 510 L195 540 Q200 570 210 590 L220 610 Q230 630 240 640 L260 650 Q275 655 285 650 L300 640 Q315 625 325 610 L340 580 Q350 560 355 540 L360 510 Q365 490 365 470 L370 440 Q375 420 375 400 L380 360 Q385 330 385 300 L390 250 Q390 210 385 180 L375 140 Q365 110 350 85 L330 60 Q310 50 290 48 L260 45 Q230 45 200 50 Z"
                fill="#e0f2fe"
                stroke="#3b82f6"
                stroke-width="2"
              />
              
              {/* Power Stations */}
              {filteredStations.map(station => {
                // Convert lat/lng to SVG coordinates (simplified projection)
                const x = 200 + (station.longitude * 40);
                const y = 600 - ((station.latitude - 49) * 80);
                
                const size = Math.min(12, 3 + Math.sqrt(station.registeredCapacity / 100));
                const color = getFuelColor(station.fuelType);
                
                return (
                  <g key={station.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={size}
                      fill={color}
                      stroke="white"
                      stroke-width="2"
                      class="cursor-pointer hover:opacity-80 transition-all"
                      onClick={() => setSelectedStation(station)}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                    >
                      <title>{station.name} - {station.registeredCapacity}MW</title>
                    </circle>
                    {station.registeredCapacity > 1000 && (
                      <text
                        x={x}
                        y={y + size + 12}
                        text-anchor="middle"
                        class="text-xs font-semibold pointer-events-none"
                        fill="#1f2937"
                        style={{ textShadow: '0 0 3px white' }}
                      >
                        {station.name.split(' ')[0]}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Selected Station Tooltip */}
            {selectedStation && (
              <div class="absolute top-4 right-4 bg-white rounded-lg shadow-xl p-4 max-w-xs border-2 border-indigo-500 z-10">
                <div class="flex justify-between items-start mb-2">
                  <h4 class="font-bold text-gray-900 flex items-center gap-2">
                    <span>{getFuelIcon(selectedStation.fuelType)}</span>
                    {selectedStation.name}
                  </h4>
                  <button
                    onClick={() => setSelectedStation(null)}
                    class="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Fuel Type:</span>
                    <span class="font-medium capitalize">{selectedStation.fuelType}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Capacity:</span>
                    <span class="font-medium">{selectedStation.registeredCapacity.toLocaleString()} MW</span>
                  </div>
                  {selectedStation.operator && (
                    <div class="flex justify-between">
                      <span class="text-gray-600">Operator:</span>
                      <span class="font-medium text-xs">{selectedStation.operator}</span>
                    </div>
                  )}
                  <div class="flex justify-between">
                    <span class="text-gray-600">Status:</span>
                    <span class="font-medium capitalize">{selectedStation.status}</span>
                  </div>
                  <div class="pt-2 border-t">
                    <div class="text-xs text-gray-500">
                      Location: {selectedStation.latitude.toFixed(3)}°N, {Math.abs(selectedStation.longitude).toFixed(3)}°W
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div class="lg:col-span-1 space-y-4">
          {/* Fuel Filter */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3">Filter by Fuel</h4>
            <div class="space-y-2">
              <button
                onClick={() => setFuelFilter('all')}
                class={`w-full text-left px-3 py-2 rounded transition-colors ${
                  fuelFilter === 'all' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span class="font-medium">All</span>
                <span class="float-right">{stations.length}</span>
              </button>
              {fuelTypes.map(fuel => {
                const count = stations.filter(s => s.fuelType === fuel).length;
                return (
                  <button
                    key={fuel}
                    onClick={() => setFuelFilter(fuel)}
                    class={`w-full text-left px-3 py-2 rounded transition-colors ${
                      fuelFilter === fuel 
                        ? 'text-white' 
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                    style={fuelFilter === fuel ? { backgroundColor: getFuelColor(fuel) } : {}}
                  >
                    <span class="font-medium capitalize">
                      {getFuelIcon(fuel)} {fuel}
                    </span>
                    <span class="float-right">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capacity Breakdown */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3">Capacity by Fuel</h4>
            <div class="space-y-3">
              {fuelTypes.map(fuel => {
                const capacity = capacityByFuel[fuel];
                const percentage = (capacity / totalCapacity) * 100;
                return (
                  <div key={fuel}>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="capitalize font-medium">{getFuelIcon(fuel)} {fuel}</span>
                      <span class="text-gray-600">{Math.round(capacity).toLocaleString()} MW</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: getFuelColor(fuel)
                        }}
                      ></div>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {percentage.toFixed(1)}% of total
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Stations */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-3">🏆 Largest Stations</h4>
            <div class="space-y-2">
              {stations
                .sort((a, b) => b.registeredCapacity - a.registeredCapacity)
                .slice(0, 5)
                .map((station, index) => (
                  <div
                    key={station.id}
                    class="flex items-center justify-between p-2 bg-white rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => setSelectedStation(station)}
                  >
                    <div class="flex items-center space-x-2">
                      <span class="text-lg">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index]}</span>
                      <div>
                        <div class="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: '140px' }}>
                          {station.name}
                        </div>
                        <div class="text-xs text-gray-500 capitalize">{station.fuelType}</div>
                      </div>
                    </div>
                    <div class="text-xs font-semibold" style={{ color: getFuelColor(station.fuelType) }}>
                      {station.registeredCapacity.toLocaleString()}MW
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
