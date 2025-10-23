import { useEffect, useRef, useState } from 'preact/hooks';
import { getUKRegionalData, type RegionData } from '../lib/ukCarbonIntensityApi';

// Leaflet will be loaded dynamically
declare const L: any;

export default function EnhancedUKRegionalMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const regionLayers = useRef<any[]>([]);
  
  const [regionData, setRegionData] = useState<Record<string, RegionData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [mapStyle, setMapStyle] = useState<'light' | 'dark'>('light');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load Leaflet and plugins
  useEffect(() => {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    cssLink.crossOrigin = '';
    document.head.appendChild(cssLink);

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

  // Fetch regional data
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getUKRegionalData();
        setRegionData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching regional data:', error);
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Update map when data changes
  useEffect(() => {
    if (Object.keys(regionData).length > 0 && mapInstance.current) {
      updateRegions();
    }
  }, [regionData, showLabels, mapStyle]);

  function initializeMap() {
    if (!mapContainer.current || mapInstance.current || typeof L === 'undefined') return;

    const map = L.map(mapContainer.current, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 10,
    }).setView([54.5, -3.5], 6);

    // Add tile layer based on style
    const tileUrl = mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    mapInstance.current = map;
    updateRegions();
  }

  function getIntensityColor(intensity: number): string {
    if (intensity < 100) return '#10b981'; // Green
    if (intensity < 150) return '#f59e0b'; // Yellow
    if (intensity < 200) return '#f97316'; // Orange
    return '#ef4444'; // Red
  }

  function getIntensityLabel(intensity: number): string {
    if (intensity < 100) return 'Very Low';
    if (intensity < 150) return 'Low';
    if (intensity < 200) return 'Moderate';
    if (intensity < 250) return 'High';
    return 'Very High';
  }

  // UK Region boundaries (simplified polygons)
  function getRegionBounds() {
    return {
      scotland: [
        [60.0, -8.0], [60.0, -1.0], [58.5, 0.0], [57.0, -1.5],
        [55.5, -2.5], [55.0, -3.0], [54.5, -4.5], [54.5, -6.0],
        [56.0, -7.5], [57.5, -7.0], [59.0, -8.0], [60.0, -8.0]
      ],
      northern_england: [
        [55.0, -3.0], [55.5, -2.5], [54.5, -0.5], [53.5, 0.0],
        [53.0, -1.0], [52.5, -2.5], [53.5, -3.5], [54.5, -3.5], [55.0, -3.0]
      ],
      midlands: [
        [53.5, -3.5], [53.0, -2.0], [52.5, -0.5], [52.0, -1.0],
        [51.5, -2.0], [52.0, -3.0], [52.5, -2.5], [53.5, -3.5]
      ],
      eastern_england: [
        [53.5, 0.0], [53.0, 1.5], [52.5, 1.5], [52.0, 1.0],
        [51.5, 0.5], [52.0, -0.5], [52.5, -0.5], [53.5, 0.0]
      ],
      london_southeast: [
        [52.0, -1.0], [51.5, 0.5], [51.0, 1.5], [50.8, 0.5],
        [50.5, -1.0], [51.0, -1.5], [51.5, -2.0], [52.0, -1.0]
      ],
      southwest: [
        [52.0, -3.0], [51.5, -2.0], [50.5, -1.0], [50.0, -3.5],
        [50.5, -5.0], [51.5, -4.5], [52.0, -3.0]
      ],
      wales: [
        [53.5, -3.5], [52.5, -2.5], [52.0, -3.0], [51.5, -4.5],
        [51.5, -5.5], [53.0, -4.5], [53.5, -3.5]
      ],
      northern_ireland: [
        [55.5, -8.0], [55.5, -5.5], [54.5, -5.5], [54.0, -6.5],
        [54.0, -8.0], [55.5, -8.0]
      ],
    };
  }

  function updateRegions() {
    if (!mapInstance.current || typeof L === 'undefined') return;

    // Clear existing layers
    regionLayers.current.forEach(layer => {
      mapInstance.current.removeLayer(layer);
    });
    regionLayers.current = [];

    const bounds = getRegionBounds();

    Object.keys(regionData).forEach(regionKey => {
      const region = regionData[regionKey];
      const regionBounds = bounds[regionKey as keyof typeof bounds];

      if (!regionBounds || !region) return;

      const intensity = region.carbonIntensity || 150;
      const color = getIntensityColor(intensity);

      // Create polygon
      const polygon = L.polygon(regionBounds, {
        color: color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2,
        opacity: 0.8,
      });

      // Popup content
      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
            ${region.name}
          </h3>
          <div style="display: grid; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280; font-size: 13px;">Carbon Intensity:</span>
              <span style="color: ${color}; font-weight: bold; font-size: 14px;">
                ${intensity} gCO₂/kWh
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280; font-size: 13px;">Status:</span>
              <span style="color: ${color}; font-weight: 600; font-size: 13px;">
                ${getIntensityLabel(intensity)}
              </span>
            </div>
            ${region.renewableCapacity ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280; font-size: 13px;">Renewable Capacity:</span>
                <span style="color: #10b981; font-weight: 600; font-size: 13px;">
                  ${Math.round(region.renewableCapacity)} MW
                </span>
              </div>
            ` : ''}
            ${region.currentGeneration ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
                <span style="color: #6b7280; font-size: 13px;">Current Generation:</span>
                <span style="color: #3b82f6; font-weight: 600; font-size: 13px;">
                  ${Math.round(region.currentGeneration)} MW
                </span>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      polygon.bindPopup(popupContent);

      // Add label if enabled
      if (showLabels) {
        // Calculate center of bounds
        const lats = regionBounds.map((coord: number[]) => coord[0]);
        const lngs = regionBounds.map((coord: number[]) => coord[1]);
        const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
        const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

        const label = L.marker([centerLat, centerLng], {
          icon: L.divIcon({
            className: 'region-label',
            html: `
              <div style="
                background: white;
                padding: 4px 8px;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                font-size: ${isMobile ? '10px' : '11px'};
                font-weight: 600;
                color: #1f2937;
                white-space: nowrap;
                border: 2px solid ${color};
              ">
                ${intensity} gCO₂/kWh
              </div>
            `,
            iconSize: [0, 0],
          }),
          interactive: false
        });

        regionLayers.current.push(label);
        label.addTo(mapInstance.current);
      }

      // Mouse events
      polygon.on({
        mouseover: () => {
          polygon.setStyle({
            fillOpacity: 0.7,
            weight: 3,
          });
        },
        mouseout: () => {
          polygon.setStyle({
            fillOpacity: 0.5,
            weight: 2,
          });
        },
        click: () => {
          setSelectedRegion(regionKey);
        }
      });

      regionLayers.current.push(polygon);
      polygon.addTo(mapInstance.current);
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <span className="text-3xl">🗺️</span>
              UK Regional Carbon Intensity
            </h3>
            <p className="text-green-100">Live carbon intensity by region</p>
          </div>
          
          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showLabels
                  ? 'bg-white text-green-600'
                  : 'bg-green-700 text-white hover:bg-green-800'
              }`}
            >
              {showLabels ? '🏷️ Labels On' : '🏷️ Labels Off'}
            </button>
            <button
              onClick={() => setMapStyle(mapStyle === 'light' ? 'dark' : 'light')}
              className="px-4 py-2 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-colors"
            >
              {mapStyle === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div
          ref={mapContainer}
          className="w-full"
          style={{ height: isMobile ? '400px' : '600px' }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
          <h4 className="text-sm font-bold text-gray-900 mb-2">Carbon Intensity</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
              <span className="text-gray-700">Very Low (&lt;100)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
              <span className="text-gray-700">Low (100-150)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
              <span className="text-gray-700">Moderate (150-200)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span className="text-gray-700">High (200+)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      {Object.keys(regionData).length > 0 && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(regionData).filter(r => r.carbonIntensity < 150).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Low Carbon Regions</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(
                  Object.values(regionData).reduce((sum, r) => sum + (r.carbonIntensity || 0), 0) /
                  Object.values(regionData).length
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">Avg gCO₂/kWh</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(
                  Object.values(regionData).reduce((sum, r) => sum + (r.renewableCapacity || 0), 0) / 1000
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">GW Renewable</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-orange-600">
                {Object.keys(regionData).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">UK Regions</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
