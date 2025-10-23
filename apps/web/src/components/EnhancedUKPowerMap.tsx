import { useEffect, useRef, useState } from 'preact/hooks';
import type { PowerStation } from '../lib/powerStationsApi';
import { getAllPowerStations, getFuelColor, getFuelIcon } from '../lib/powerStationsApi';

// Leaflet and plugins will be loaded dynamically
declare const L: any;

export default function EnhancedUKPowerMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const heatmapLayer = useRef<any>(null);
  
  const [stations, setStations] = useState<PowerStation[]>([]);
  const [filteredStations, setFilteredStations] = useState<PowerStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<Set<string>>(new Set(['all']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClustering, setShowClustering] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);

  // Detect mobile and touch on mount
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      // Auto-open menu on desktop, closed on mobile
      setShowMobileMenu(!mobile);
    };
    
    const checkTouch = () => {
      const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setHasTouch(touch);
    };
    
    checkMobile();
    checkTouch();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load Leaflet and plugins
  useEffect(() => {
    // Leaflet CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

    // MarkerCluster CSS
    const clusterCss = document.createElement('link');
    clusterCss.rel = 'stylesheet';
    clusterCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    document.head.appendChild(clusterCss);

    const clusterDefaultCss = document.createElement('link');
    clusterDefaultCss.rel = 'stylesheet';
    clusterDefaultCss.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    document.head.appendChild(clusterDefaultCss);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.async = true;
    
    script.onload = () => {
      // Load MarkerCluster after Leaflet
      const clusterScript = document.createElement('script');
      clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      clusterScript.async = true;
      clusterScript.onload = () => {
        // Load Leaflet.heat for heatmap
        const heatScript = document.createElement('script');
        heatScript.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
        heatScript.async = true;
        heatScript.onload = () => {
          initializeMap();
        };
        document.head.appendChild(heatScript);
      };
      document.head.appendChild(clusterScript);
    };
    
    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, []);

  // Fetch power stations
  useEffect(() => {
    async function fetchStations() {
      try {
        const data = await getAllPowerStations();
        // Simulate generation with time-of-day variation
        const stationsWithGen = data.map(s => ({
          ...s,
          currentGeneration: simulateGeneration(s, currentHour)
        }));
        setStations(stationsWithGen);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching stations:', error);
        setLoading(false);
      }
    }

    fetchStations();
    const interval = setInterval(fetchStations, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [currentHour]);

  // Filter stations based on fuel type and search
  useEffect(() => {
    let filtered = stations;
    
    // Filter by fuel type
    if (!selectedFuelTypes.has('all')) {
      filtered = filtered.filter(s => selectedFuelTypes.has(s.fuelType));
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.operator?.toLowerCase().includes(query) ||
        s.fuelType.toLowerCase().includes(query)
      );
    }
    
    setFilteredStations(filtered);
  }, [stations, selectedFuelTypes, searchQuery]);

  // Update map when filtered stations change
  useEffect(() => {
    if (filteredStations.length > 0 && mapInstance.current) {
      updateMap();
    }
  }, [filteredStations, showClustering, showHeatmap]);

  function simulateGeneration(station: PowerStation, hour: number): number {
    const { fuelType, registeredCapacity } = station;
    
    // Different generation patterns by fuel type
    let loadFactor = 0.5; // Default 50%
    
    switch (fuelType) {
      case 'nuclear':
        loadFactor = 0.85; // Baseload - constant
        break;
      case 'wind':
        loadFactor = 0.3 + Math.random() * 0.4; // Variable 30-70%
        break;
      case 'solar':
        // Peak at midday
        loadFactor = Math.max(0, Math.sin((hour - 6) * Math.PI / 12)) * 0.8;
        break;
      case 'gas':
        // Higher during demand peaks
        const demandFactor = 0.5 + Math.sin((hour - 6) * Math.PI / 12) * 0.3;
        loadFactor = demandFactor + Math.random() * 0.2;
        break;
      case 'hydro':
        loadFactor = 0.4 + Math.random() * 0.3;
        break;
      default:
        loadFactor = 0.5 + Math.random() * 0.3;
    }
    
    return registeredCapacity * Math.max(0, Math.min(1, loadFactor));
  }

  function initializeMap() {
    if (!mapContainer.current || mapInstance.current || typeof L === 'undefined') return;

    const map = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([54.5, -2.5], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    mapInstance.current = map;
  }

  function updateMap() {
    if (!mapInstance.current || typeof L === 'undefined') return;

    // Clear existing layers
    if (markersLayer.current) {
      mapInstance.current.removeLayer(markersLayer.current);
    }
    if (heatmapLayer.current) {
      mapInstance.current.removeLayer(heatmapLayer.current);
    }

    // Add heatmap if enabled
    if (showHeatmap) {
      const heatData = filteredStations
        .filter(s => s.currentGeneration > 0)
        .map(s => [
          s.latitude,
          s.longitude,
          s.currentGeneration / 1000 // Normalize for heat intensity
        ]);
      
      heatmapLayer.current = (L as any).heatLayer(heatData, {
        radius: 25,
        blur: 35,
        maxZoom: 10,
        max: 1.0,
        gradient: {
          0.0: 'blue',
          0.3: 'cyan',
          0.5: 'lime',
          0.7: 'yellow',
          1.0: 'red'
        }
      }).addTo(mapInstance.current);
    }

    // Create markers
    const markers: any[] = [];
    
    filteredStations.forEach(station => {
      const color = getFuelColor(station.fuelType);
      const size = Math.max(8, Math.min(30, (station.registeredCapacity / 100)));
      const opacity = station.currentGeneration > 0 ? 0.8 : 0.3;

      const markerHtml = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50%;
          opacity: ${opacity};
          box-shadow: 0 0 10px ${color};
          animation: pulse-marker 2s infinite;
        "></div>
        <style>
          @keyframes pulse-marker {
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

      const marker = L.marker([station.latitude, station.longitude], { icon });

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
      markers.push(marker);
    });

    // Add markers with or without clustering
    if (showClustering && typeof (L as any).markerClusterGroup !== 'undefined') {
      markersLayer.current = (L as any).markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50,
      });
      
      markers.forEach(m => markersLayer.current.addLayer(m));
      mapInstance.current.addLayer(markersLayer.current);
    } else {
      markersLayer.current = L.layerGroup(markers);
      mapInstance.current.addLayer(markersLayer.current);
    }
  }

  // Time-series animation
  useEffect(() => {
    if (!isAnimating) return;
    
    const interval = setInterval(() => {
      setCurrentHour(prev => (prev + 1) % 24);
    }, 500); // Advance 1 hour every 0.5 seconds
    
    return () => clearInterval(interval);
  }, [isAnimating]);

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
    <div 
      class="relative w-full h-screen bg-gray-900"
      role={accessibilityMode ? "application" : undefined}
      aria-label={accessibilityMode ? "Interactive UK Power Generation Map" : undefined}
    >
      <div ref={mapContainer} class="absolute inset-0"></div>

      {loading && (
        <div class="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1000]">
          <div class="text-white text-center">
            <div class="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading power stations...</p>
          </div>
        </div>
      )}

      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        class={`lg:hidden absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-[1001] ${hasTouch ? 'touch-manipulation' : ''}`}
        aria-label="Toggle controls menu"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {showMobileMenu ? (
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Search & Filter Panel */}
      <div 
        class={`absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs space-y-4 transition-transform ${
          showMobileMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Search Box */}
        <div>
          <label for="station-search" class={accessibilityMode ? 'text-sm font-medium mb-1 block' : 'sr-only'}>
            Search Power Stations
          </label>
          <input
            id="station-search"
            type="text"
            placeholder="Search stations, operators..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            class={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${hasTouch ? 'touch-manipulation' : ''}`}
            aria-describedby={accessibilityMode ? 'search-results' : undefined}
          />
          {searchQuery && (
            <div 
              id="search-results" 
              class="mt-2 text-xs text-gray-600"
              role={accessibilityMode ? 'status' : undefined}
              aria-live={accessibilityMode ? 'polite' : undefined}
            >
              Found {filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Fuel Type Filters */}
        <div role={accessibilityMode ? 'group' : undefined} aria-label={accessibilityMode ? 'Filter by fuel type' : undefined}>
          <h3 class="text-sm font-semibold mb-2">Filter by Type</h3>
          <div class="flex flex-wrap gap-2">
            {fuelTypes.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => toggleFuelType(key)}
                class={`px-2 py-1 rounded-full text-xs font-medium transition-all ${hasTouch ? 'touch-manipulation' : ''} ${
                  selectedFuelTypes.has(key)
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-pressed={accessibilityMode ? selectedFuelTypes.has(key) : undefined}
                aria-label={accessibilityMode ? `Filter ${label} stations` : undefined}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Options */}
        <div class="pt-3 border-t border-gray-200">
          <h3 class="text-sm font-semibold mb-2">View Options</h3>
          <div class="space-y-2" role={accessibilityMode ? 'group' : undefined} aria-label={accessibilityMode ? 'Map display options' : undefined}>
            <label class="flex items-center text-sm cursor-pointer touch-manipulation">
              <input
                type="checkbox"
                checked={showClustering}
                onChange={(e) => setShowClustering((e.target as HTMLInputElement).checked)}
                class="mr-2 w-4 h-4"
                aria-label={accessibilityMode ? 'Toggle marker clustering' : undefined}
              />
              <span>Cluster markers</span>
            </label>
            <label class={`flex items-center text-sm cursor-pointer ${hasTouch ? 'touch-manipulation' : ''}`}>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap((e.target as HTMLInputElement).checked)}
                class="mr-2 w-4 h-4"
                aria-label={accessibilityMode ? 'Toggle heat map overlay' : undefined}
              />
              <span>Show heat map</span>
            </label>
            <label class={`flex items-center text-sm cursor-pointer ${hasTouch ? 'touch-manipulation' : ''}`}>
manipulation' : ''}`}>
              <input
                type="checkbox"
                checked={accessibilityMode}
                onChange={(e) => setAccessibilityMode((e.target as HTMLInputElement).checked)}
                class="mr-2 w-4 h-4"
              />
              <span>♿ Accessibility mode</span>
            </label>
          </div>
        </div>

        {/* Time Animation */}
        <div class="pt-3 border-t border-gray-200" role={accessibilityMode ? 'region' : undefined} aria-label={accessibilityMode ? 'Time animation controls' : undefined}>
          <h3 class="text-sm font-semibold mb-2">Time Animation</h3>
          <div class="flex items-center justify-between">
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${hasTouch ? 'touch-manipulation' : ''} ${
                isAnimating
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              aria-label={accessibilityMode ? (isAnimating ? 'Pause animation' : 'Play 24-hour animation') : undefined}
              aria-pressed={accessibilityMode ? isAnimating : undefined}
            >
              {isAnimating ? '⏸ Pause' : '▶️ Play 24h'}
            </button>
            <span class="text-sm font-medium">
              {String(currentHour).padStart(2, '0')}:00
            </span>
          </div>
          <label for="hour-slider" class={accessibilityMode ? 'text-xs mt-2 block' : 'sr-only'}>
            Time of day slider
          </label>
          <input
            id="hour-slider"
            type="range"
            min="0"
            max="23"
            value={currentHour}
            onChange={(e) => setCurrentHour(parseInt((e.target as HTMLInputElement).value))}
            class={`w-full mt-2 ${hasTouch ? 'touch-manipulation' : ''}`}
            aria-label={accessibilityMode ? `Hour: ${currentHour}:00` : undefined}
            aria-valuemin={accessibilityMode ? 0 : undefined}
            aria-valuemax={accessibilityMode ? 23 : undefined}
            aria-valuenow={accessibilityMode ? currentHour : undefined}
            aria-valuetext={accessibilityMode ? `${String(currentHour).padStart(2, '0')}:00` : undefined}
          />
        </div>
      </div>

      {/* Stats Panel */}
      <div 
        class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-sm hidden md:block"
        role={accessibilityMode ? 'region' : undefined}
        aria-label={accessibilityMode ? 'Live statistics' : undefined}
      >
        <h3 class="text-lg font-semibold mb-3">Live Statistics</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Showing</div>
            <div class="text-xl font-bold text-gray-900">{filteredStations.length}</div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Total Capacity</div>
            <div class="text-xl font-bold text-gray-900">
              {Math.round(filteredStations.reduce((sum, s) => sum + s.registeredCapacity, 0) / 1000)} GW
            </div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Current Output</div>
            <div class="text-xl font-bold text-green-600">
              {Math.round(filteredStations.reduce((sum, s) => sum + s.currentGeneration, 0) / 1000)} GW
            </div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="text-gray-600 text-xs">Average Load</div>
            <div class="text-xl font-bold text-blue-600">
              {Math.round((filteredStations.reduce((sum, s) => sum + s.currentGeneration, 0) / 
                          filteredStations.reduce((sum, s) => sum + s.registeredCapacity, 0)) * 100)}%
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
