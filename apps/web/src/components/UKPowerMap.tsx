import { useEffect, useRef, useState } from 'preact/hooks';
import type { PowerStation } from '../lib/powerStationsApi';
import { getAllPowerStations, getFuelColor, getFuelIcon } from '../lib/powerStationsApi';

// Leaflet will be loaded dynamically on client-side only
declare const L: any;

export default function UKPowerMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  
  const [stations, setStations] = useState<PowerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<Set<string>>(new Set(['all']));
  const [selectedStation, setSelectedStation] = useState<PowerStation | null>(null);

  // Load Leaflet CSS and JS
  useEffect(() => {
    // Add Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = true;
    
    script.onload = () => {
      initializeMap();
    };
    
    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, []);

  // Fetch power stations data
  useEffect(() => {
    async function fetchStations() {
      try {
        const data = await getAllPowerStations();
        // Simulate some current generation for demo
        const stationsWithGen = data.map(s => ({
          ...s,
          currentGeneration: Math.random() * s.registeredCapacity * 0.8
        }));
        setStations(stationsWithGen);
        setLoading(false);
        
        // Add markers to map
        if (mapInstance.current) {
          addMarkersToMap(stationsWithGen);
        }
      } catch (error) {
        console.error('Error fetching stations:', error);
        setLoading(false);
      }
    }

    fetchStations();
    
    // Update every 5 seconds
    const interval = setInterval(fetchStations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initialize map
  function initializeMap() {
    if (!mapContainer.current || mapInstance.current || typeof L === 'undefined') return;

    // Create map centered on UK
    const map = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([54.5, -2.5], 6);

    // Add OpenStreetMap tiles with dark theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    mapInstance.current = map;
  }

  // Add markers to map
  function addMarkersToMap(stationsList: PowerStation[]) {
    if (!mapInstance.current || typeof L === 'undefined') return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    stationsList.forEach(station => {
      // Filter based on selected fuel types
      if (!selectedFuelTypes.has('all') && !selectedFuelTypes.has(station.fuelType)) {
        return;
      }

      const color = getFuelColor(station.fuelType);
      const size = Math.max(8, Math.min(30, (station.registeredCapacity / 100)));
      const opacity = station.currentGeneration > 0 ? 0.8 : 0.3;

      // Create pulsing marker
      const markerHtml = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          opacity: ${opacity};
          box-shadow: 0 0 10px ${color};
          animation: pulse-${station.id} 2s infinite;
        "></div>
        <style>
          @keyframes pulse-${station.id} {
            0%, 100% { transform: scale(1); opacity: ${opacity}; }
            50% { transform: scale(1.2); opacity: ${opacity * 0.6}; }
          }
        </style>
      `;

      const icon = L.divIcon({
        className: 'custom-marker',
        html: markerHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([station.latitude, station.longitude], { icon })
        .addTo(mapInstance.current);

      // Add popup
      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">
            ${getFuelIcon(station.fuelType)} ${station.name}
          </h3>
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
            ${station.operator}
          </div>
          <div style="display: grid; gap: 4px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Type:</span>
              <strong style="text-transform: capitalize;">${station.fuelType}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Capacity:</span>
              <strong>${station.registeredCapacity} MW</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Generation:</span>
              <strong>${Math.round(station.currentGeneration)} MW</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Load Factor:</span>
              <strong>${Math.round((station.currentGeneration / station.registeredCapacity) * 100)}%</strong>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        setSelectedStation(station);
      });

      markers.current.set(station.id, marker);
    });
  }

  // Update markers when filter changes
  useEffect(() => {
    if (stations.length > 0) {
      addMarkersToMap(stations);
    }
  }, [selectedFuelTypes, stations]);

  const toggleFuelType = (fuelType: string) => {
    const newSelection = new Set(selectedFuelTypes);
    
    if (fuelType === 'all') {
      setSelectedFuelTypes(new Set(['all']));
    } else {
      newSelection.delete('all');
      if (newSelection.has(fuelType)) {
        newSelection.delete(fuelType);
      } else {
        newSelection.add(fuelType);
      }
      
      if (newSelection.size === 0) {
        newSelection.add('all');
      }
      
      setSelectedFuelTypes(newSelection);
    }
  };

  const fuelTypes = [
    { key: 'all', label: 'All', icon: '⚡' },
    { key: 'nuclear', label: 'Nuclear', icon: '⚛️' },
    { key: 'gas', label: 'Gas', icon: '🔥' },
    { key: 'wind', label: 'Wind', icon: '💨' },
    { key: 'solar', label: 'Solar', icon: '☀️' },
    { key: 'hydro', label: 'Hydro', icon: '💧' },
    { key: 'biomass', label: 'Biomass', icon: '🌿' },
    { key: 'interconnector', label: 'Interconnectors', icon: '🔌' },
  ];

  return (
    <div class="relative w-full h-screen bg-gray-900">
      {/* Map Container */}
      <div ref={mapContainer} class="absolute inset-0"></div>

      {/* Loading Overlay */}
      {loading && (
        <div class="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1000]">
          <div class="text-white text-center">
            <div class="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading power stations...</p>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <div class="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
        <h3 class="text-lg font-semibold mb-3">Filter by Type</h3>
        <div class="flex flex-wrap gap-2">
          {fuelTypes.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => toggleFuelType(key)}
              class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedFuelTypes.has(key)
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
        
        <div class="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
          <p class="font-semibold mb-1">Legend:</p>
          <p>• Larger circles = Higher capacity</p>
          <p>• Pulsing = Currently generating</p>
          <p>• Faded = Offline or low output</p>
        </div>
      </div>

      {/* Stats Panel */}
      <div class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-sm">
        <h3 class="text-lg font-semibold mb-3">Live Statistics</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Total Stations</div>
            <div class="text-xl font-bold text-gray-900">{stations.length}</div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Total Capacity</div>
            <div class="text-xl font-bold text-gray-900">
              {Math.round(stations.reduce((sum, s) => sum + s.registeredCapacity, 0) / 1000)} GW
            </div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Current Output</div>
            <div class="text-xl font-bold text-green-600">
              {Math.round(stations.reduce((sum, s) => sum + s.currentGeneration, 0) / 1000)} GW
            </div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Average Load</div>
            <div class="text-xl font-bold text-blue-600">
              {Math.round((stations.reduce((sum, s) => sum + s.currentGeneration, 0) / 
                          stations.reduce((sum, s) => sum + s.registeredCapacity, 0)) * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 rounded px-4 py-2 text-xs text-gray-600 z-[1000] text-center">
        Contains BMRS data © Elexon Limited copyright and database right 2025 • 
        Map data © OpenStreetMap contributors
      </div>
    </div>
  );
}
