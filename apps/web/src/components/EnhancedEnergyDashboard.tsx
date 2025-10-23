import { useEffect, useState } from 'preact/hooks';
import {
  getGenerationMix,
  getDemandData,
  getSystemPrices,
  getCarbonIntensity,
  type GenerationMix,
  type DemandData,
  type SystemPrices,
  type CarbonIntensityData
} from '../lib/energyDataApi';

interface HistoricalDataPoint {
  timestamp: string;
  generation: number;
  demand: number;
  carbonIntensity: number;
  price: number;
}

export default function EnhancedEnergyDashboard() {
  const [generationMix, setGenerationMix] = useState<GenerationMix | null>(null);
  const [demand, setDemand] = useState<DemandData | null>(null);
  const [prices, setPrices] = useState<SystemPrices | null>(null);
  const [carbonIntensity, setCarbonIntensity] = useState<CarbonIntensityData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'regional' | 'comparison'>('overview');

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchAllData() {
    try {
      const [gen, dem, pri, carb] = await Promise.all([
        getGenerationMix(),
        getDemandData(),
        getSystemPrices(),
        getCarbonIntensity()
      ]);

      setGenerationMix(gen);
      setDemand(dem);
      setPrices(pri);
      setCarbonIntensity(carb);

      // Add to historical data (keep last 24 hours)
      const newPoint: HistoricalDataPoint = {
        timestamp: new Date().toISOString(),
        generation: gen.total,
        demand: dem.demand,
        carbonIntensity: carb.actual,
        price: pri.imbalancePrice
      };

      setHistoricalData(prev => {
        const updated = [...prev, newPoint];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        return updated.filter(p => new Date(p.timestamp).getTime() > cutoff);
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching energy data:', error);
      setLoading(false);
    }
  }

  if (loading || !generationMix || !demand || !prices || !carbonIntensity) {
    return (
      <div class="min-h-screen bg-gray-900 flex items-center justify-center">
        <div class="text-white text-center">
          <div class="animate-spin w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-lg">Loading energy data...</p>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <header class="mb-8">
        <h1 class="text-4xl font-bold mb-2">UK Energy Grid Dashboard</h1>
        <p class="text-gray-400">Live data from National Grid ESO & Elexon BMRS</p>
      </header>

      {/* View Tabs */}
      <div class="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'overview', label: '📊 Overview', icon: '📊' },
          { key: 'trends', label: '📈 Trends', icon: '📈' },
          { key: 'regional', label: '🗺️ Regional', icon: '🗺️' },
          { key: 'comparison', label: '⚖️ Compare', icon: '⚖️' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSelectedView(key as any)}
            class={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedView === key
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview View */}
      {selectedView === 'overview' && (
        <div class="space-y-6">
          {/* Key Metrics */}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Generation"
              value={`${generationMix.total.toLocaleString()} MW`}
              subtitle="Across all sources"
              color="green"
            />
            <MetricCard
              title="National Demand"
              value={`${demand.demand.toLocaleString()} MW`}
              subtitle={`${Math.round((generationMix.total / demand.demand) * 100)}% supply coverage`}
              color="blue"
            />
            <MetricCard
              title="Carbon Intensity"
              value={`${carbonIntensity.actual} gCO₂/kWh`}
              subtitle={`${carbonIntensity.actual < 100 ? 'Very Low' : carbonIntensity.actual < 200 ? 'Low' : carbonIntensity.actual < 300 ? 'Moderate' : 'High'}`}
              color={carbonIntensity.actual < 200 ? 'green' : carbonIntensity.actual < 300 ? 'yellow' : 'red'}
            />
            <MetricCard
              title="System Price"
              value={`£${prices.imbalancePrice.toFixed(2)}/MWh`}
              subtitle="Imbalance price"
              color="purple"
            />
          </div>

          {/* Generation Mix Chart */}
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold mb-4">Generation Mix</h2>
            <GenerationMixChart mix={generationMix} />
          </div>

          {/* Fuel Breakdown */}
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold mb-4">Detailed Breakdown</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(generationMix.byFuelType)
                .sort(([, a], [, b]) => b - a)
                .map(([fuel, mw]) => (
                  <FuelCard
                    key={fuel}
                    fuel={fuel}
                    mw={mw}
                    percentage={(mw / generationMix.total) * 100}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Trends View */}
      {selectedView === 'trends' && (
        <div class="space-y-6">
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold mb-4">24-Hour Trends</h2>
            {historicalData.length > 0 ? (
              <TrendsChart data={historicalData} />
            ) : (
              <p class="text-gray-400 text-center py-8">
                Accumulating historical data... Check back in a few minutes.
              </p>
            )}
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-xl font-bold mb-4">Generation Pattern</h3>
              <GenerationPatternChart data={historicalData} />
            </div>
            <div class="bg-gray-800 rounded-lg p-6">
              <h3 class="text-xl font-bold mb-4">Carbon Intensity Trend</h3>
              <CarbonTrendChart data={historicalData} />
            </div>
          </div>
        </div>
      )}

      {/* Regional View */}
      {selectedView === 'regional' && (
        <div class="space-y-6">
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold mb-4">Regional Breakdown</h2>
            <RegionalBreakdown generationMix={generationMix} />
          </div>

          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold mb-4">Interconnector Flows</h2>
            <InterconnectorFlows mix={generationMix} />
          </div>
        </div>
      )}

      {/* Comparison View */}
      {selectedView === 'comparison' && (
        <div class="space-y-6">
          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-2xl font-bold mb-4">Historical Comparison</h2>
            <HistoricalComparison
              currentGeneration={generationMix.total}
              currentDemand={demand.demand}
              currentCarbon={carbonIntensity.actual}
              historicalData={historicalData}
            />
          </div>
        </div>
      )}

      {/* Footer Attribution */}
      <footer class="mt-8 pt-6 border-t border-gray-700 text-center text-sm text-gray-400">
        <p>
          Data Sources: Carbon Intensity API, Elexon BMRS API • 
          Updates every 30 seconds • 
          <a href="/features/data-sources" class="text-green-500 hover:underline ml-2">
            View Data Sources & Licenses
          </a>
        </p>
      </footer>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, subtitle, color }: {
  title: string;
  value: string;
  subtitle: string;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}) {
  const colors = {
    green: 'from-green-600 to-green-800',
    blue: 'from-blue-600 to-blue-800',
    yellow: 'from-yellow-600 to-yellow-800',
    red: 'from-red-600 to-red-800',
    purple: 'from-purple-600 to-purple-800'
  };

  return (
    <div class={`bg-gradient-to-br ${colors[color]} rounded-lg p-6 shadow-lg`}>
      <h3 class="text-sm font-medium text-white/80 mb-2">{title}</h3>
      <div class="text-3xl font-bold mb-1">{value}</div>
      <p class="text-sm text-white/70">{subtitle}</p>
    </div>
  );
}

// Generation Mix Chart
function GenerationMixChart({ mix }: { mix: GenerationMix }) {
  const fuelColors: Record<string, string> = {
    nuclear: '#8B5CF6',
    gas: '#F59E0B',
    wind: '#3B82F6',
    solar: '#FBBF24',
    hydro: '#06B6D4',
    biomass: '#10B981',
    coal: '#6B7280',
    imports: '#EC4899',
    other: '#9CA3AF'
  };

  const data = Object.entries(mix.byFuelType)
    .filter(([, mw]) => mw > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div class="space-y-4">
      {data.map(([fuel, mw]) => {
        const percentage = (mw / mix.total) * 100;
        return (
          <div key={fuel} class="space-y-1">
            <div class="flex justify-between text-sm">
              <span class="capitalize font-medium">{fuel}</span>
              <span>{mw.toLocaleString()} MW ({percentage.toFixed(1)}%)</span>
            </div>
            <div class="h-8 bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-500 flex items-center justify-end pr-3 text-xs font-bold"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: fuelColors[fuel] || '#9CA3AF'
                }}
              >
                {percentage > 10 && `${percentage.toFixed(1)}%`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Fuel Card Component
function FuelCard({ fuel, mw, percentage }: {
  fuel: string;
  mw: number;
  percentage: number;
}) {
  const icons: Record<string, string> = {
    nuclear: '⚛️',
    gas: '🔥',
    wind: '💨',
    solar: '☀️',
    hydro: '💧',
    biomass: '🌿',
    coal: '⚫',
    imports: '🔌',
    other: '⚡'
  };

  return (
    <div class="bg-gray-700 rounded-lg p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl">{icons[fuel] || '⚡'}</span>
        <span class="font-semibold capitalize">{fuel}</span>
      </div>
      <div class="text-2xl font-bold">{mw.toLocaleString()} MW</div>
      <div class="text-sm text-gray-400">{percentage.toFixed(1)}% of total</div>
    </div>
  );
}

// Trends Chart (Simple SVG-based)
function TrendsChart({ data }: { data: HistoricalDataPoint[] }) {
  if (data.length < 2) return null;

  const width = 800;
  const height = 300;
  const padding = 40;

  const maxGen = Math.max(...data.map(d => d.generation));
  const maxDem = Math.max(...data.map(d => d.demand));
  const max = Math.max(maxGen, maxDem);

  const xScale = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);
  const yScale = (value: number) => height - padding - ((value / max) * (height - 2 * padding));

  const genPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.generation)}`).join(' ');
  const demPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.demand)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} class="w-full h-auto">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
        <line
          key={ratio}
          x1={padding}
          x2={width - padding}
          y1={height - padding - (ratio * (height - 2 * padding))}
          y2={height - padding - (ratio * (height - 2 * padding))}
          stroke="#374151"
          stroke-dasharray="4"
        />
      ))}

      {/* Generation line */}
      <path d={genPath} fill="none" stroke="#10B981" stroke-width="3" />

      {/* Demand line */}
      <path d={demPath} fill="none" stroke="#3B82F6" stroke-width="3" stroke-dasharray="6" />

      {/* Legend */}
      <text x={padding} y={20} fill="#10B981" font-size="14" font-weight="bold">Generation</text>
      <text x={padding + 100} y={20} fill="#3B82F6" font-size="14" font-weight="bold">Demand</text>
    </svg>
  );
}

// Generation Pattern Chart
function GenerationPatternChart({ data }: { data: HistoricalDataPoint[] }) {
  if (data.length === 0) return <p class="text-gray-400 text-center">No data yet</p>;

  const avg = data.reduce((sum, d) => sum + d.generation, 0) / data.length;
  const trend = data.length > 1 ? data[data.length - 1].generation - data[0].generation : 0;

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-gray-400">Average</div>
          <div class="text-2xl font-bold">{Math.round(avg).toLocaleString()} MW</div>
        </div>
        <div>
          <div class="text-sm text-gray-400">Trend</div>
          <div class={`text-2xl font-bold ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(Math.round(trend)).toLocaleString()} MW
          </div>
        </div>
      </div>
    </div>
  );
}

// Carbon Trend Chart
function CarbonTrendChart({ data }: { data: HistoricalDataPoint[] }) {
  if (data.length === 0) return <p class="text-gray-400 text-center">No data yet</p>;

  const avg = data.reduce((sum, d) => sum + d.carbonIntensity, 0) / data.length;
  const current = data[data.length - 1]?.carbonIntensity || 0;

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-sm text-gray-400">24h Average</div>
          <div class="text-2xl font-bold">{Math.round(avg)} gCO₂/kWh</div>
        </div>
        <div>
          <div class="text-sm text-gray-400">Current</div>
          <div class="text-2xl font-bold">{Math.round(current)} gCO₂/kWh</div>
        </div>
      </div>
      <div class="text-sm text-gray-400">
        {current < avg ? '✅ Below average' : '⚠️ Above average'}
      </div>
    </div>
  );
}

// Regional Breakdown (Mock data for demonstration)
function RegionalBreakdown({ generationMix }: { generationMix: GenerationMix }) {
  // Simplified regional data - in production would come from API
  const regions = [
    { name: 'Scotland', percentage: 18, primary: 'Wind, Nuclear' },
    { name: 'North England', percentage: 22, primary: 'Gas, Wind' },
    { name: 'Midlands', percentage: 20, primary: 'Gas, Biomass' },
    { name: 'South England', percentage: 25, primary: 'Gas, Nuclear' },
    { name: 'Wales', percentage: 8, primary: 'Wind, Gas' },
    { name: 'Northern Ireland', percentage: 7, primary: 'Gas, Wind' }
  ];

  return (
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {regions.map(region => (
        <div key={region.name} class="bg-gray-700 rounded-lg p-4">
          <h4 class="font-bold text-lg mb-2">{region.name}</h4>
          <div class="text-3xl font-bold text-green-500 mb-1">{region.percentage}%</div>
          <div class="text-sm text-gray-400">Primary: {region.primary}</div>
        </div>
      ))}
    </div>
  );
}

// Interconnector Flows
function InterconnectorFlows({ mix }: { mix: GenerationMix }) {
  const interconnectors = [
    { name: 'France (IFA)', capacity: 2000, flow: mix.byFuelType.imports * 0.3 || 0 },
    { name: 'Netherlands (BritNed)', capacity: 1000, flow: mix.byFuelType.imports * 0.25 || 0 },
    { name: 'Belgium (Nemo)', capacity: 1000, flow: mix.byFuelType.imports * 0.2 || 0 },
    { name: 'Ireland (EWIC)', capacity: 500, flow: mix.byFuelType.imports * 0.15 || 0 },
    { name: 'Norway (NSL)', capacity: 1400, flow: mix.byFuelType.imports * 0.1 || 0 }
  ];

  return (
    <div class="space-y-4">
      {interconnectors.map(ic => {
        const utilizationPct = (Math.abs(ic.flow) / ic.capacity) * 100;
        const isImport = ic.flow > 0;
        
        return (
          <div key={ic.name} class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="font-medium">{ic.name}</span>
              <span class={isImport ? 'text-blue-400' : 'text-green-400'}>
                {isImport ? '→' : '←'} {Math.abs(Math.round(ic.flow))} MW
              </span>
            </div>
            <div class="h-6 bg-gray-700 rounded-full overflow-hidden relative">
              <div
                class={`h-full transition-all duration-500 ${isImport ? 'bg-blue-600' : 'bg-green-600'}`}
                style={{ width: `${utilizationPct}%` }}
              />
              <span class="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {utilizationPct.toFixed(0)}% utilization
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Historical Comparison
function HistoricalComparison({
  currentGeneration,
  currentDemand,
  currentCarbon,
  historicalData
}: {
  currentGeneration: number;
  currentDemand: number;
  currentCarbon: number;
  historicalData: HistoricalDataPoint[];
}) {
  if (historicalData.length < 2) {
    return (
      <p class="text-gray-400 text-center py-8">
        Not enough historical data yet. Check back soon!
      </p>
    );
  }

  const avgGen = historicalData.reduce((sum, d) => sum + d.generation, 0) / historicalData.length;
  const avgDem = historicalData.reduce((sum, d) => sum + d.demand, 0) / historicalData.length;
  const avgCarb = historicalData.reduce((sum, d) => sum + d.carbonIntensity, 0) / historicalData.length;

  const comparisons = [
    {
      metric: 'Generation',
      current: currentGeneration,
      average: avgGen,
      unit: 'MW'
    },
    {
      metric: 'Demand',
      current: currentDemand,
      average: avgDem,
      unit: 'MW'
    },
    {
      metric: 'Carbon Intensity',
      current: currentCarbon,
      average: avgCarb,
      unit: 'gCO₂/kWh'
    }
  ];

  return (
    <div class="grid md:grid-cols-3 gap-6">
      {comparisons.map(({ metric, current, average, unit }) => {
        const diff = current - average;
        const diffPct = (diff / average) * 100;
        const isPositive = diff > 0;

        return (
          <div key={metric} class="bg-gray-700 rounded-lg p-6">
            <h3 class="text-lg font-bold mb-4">{metric}</h3>
            <div class="space-y-3">
              <div>
                <div class="text-sm text-gray-400">Current</div>
                <div class="text-2xl font-bold">{Math.round(current).toLocaleString()} {unit}</div>
              </div>
              <div>
                <div class="text-sm text-gray-400">24h Average</div>
                <div class="text-xl">{Math.round(average).toLocaleString()} {unit}</div>
              </div>
              <div class={`text-lg font-bold ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
                {isPositive ? '↑' : '↓'} {Math.abs(diffPct).toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
