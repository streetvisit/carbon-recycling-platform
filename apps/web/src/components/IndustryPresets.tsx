import { useState } from 'preact/hooks';

interface PresetData {
  electricity: number;
  gas: number;
  fuel: number;
  flights: number;
  waste?: number;
  water?: number;
  commuting?: number;
}

interface IndustryPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  employees: string;
  data: PresetData;
  insights: string[];
}

const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: 'tech-startup',
    name: 'Tech Startup',
    icon: '💻',
    description: '50-employee software development company with remote-first policy',
    employees: '~50 employees',
    data: {
      electricity: 85000, // Lower due to remote work
      gas: 15000, // Small office
      fuel: 800, // Minimal company vehicles
      flights: 25000, // Some client meetings
      waste: 8,
      water: 400,
      commuting: 85000 // Reduced due to remote work
    },
    insights: [
      'Remote work significantly reduces office energy consumption',
      'Employee commuting is major contributor even with hybrid model',
      'Cloud infrastructure emissions tracked separately',
      'Business travel for key client meetings and conferences'
    ]
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing SME',
    icon: '🏭',
    description: '150-employee manufacturing company with production facility',
    employees: '~150 employees',
    data: {
      electricity: 450000, // High energy for production
      gas: 180000, // Heating and processes
      fuel: 4500, // Delivery vehicles and equipment
      flights: 15000, // Limited travel
      waste: 120, // Significant waste generation
      water: 2800, // Process water
      commuting: 320000 // Most employees on-site
    },
    insights: [
      'Electricity and gas are major contributors due to production processes',
      'Waste management from manufacturing creates significant emissions',
      'High water usage for cooling and cleaning processes',
      'Fleet vehicles for logistics and deliveries'
    ]
  },
  {
    id: 'professional-services',
    name: 'Professional Services',
    icon: '🏢',
    description: '80-employee consultancy with city centre office',
    employees: '~80 employees',
    data: {
      electricity: 120000, // Office lighting and equipment
      gas: 35000, // Office heating
      fuel: 1200, // Limited company cars
      flights: 85000, // Extensive client travel
      waste: 15,
      water: 650,
      commuting: 280000 // Daily commuting to office
    },
    insights: [
      'Business travel is the largest emission source',
      'Employee commuting significant for office-based work',
      'Modern office equipment relatively energy efficient',
      'Client meetings require frequent air travel'
    ]
  },
  {
    id: 'retail',
    name: 'Retail Chain',
    icon: '🛍️',
    description: '200-employee retail company with multiple store locations',
    employees: '~200 employees',
    data: {
      electricity: 280000, // Store lighting and refrigeration
      gas: 85000, // Store heating
      fuel: 8500, // Delivery and logistics
      flights: 12000, // Limited management travel
      waste: 45, // Packaging waste
      water: 850,
      commuting: 380000 // Shift workers commuting
    },
    insights: [
      'Store lighting and refrigeration drive electricity use',
      'Multiple locations increase overall energy consumption',
      'Packaging waste from inventory and customer purchases',
      'Large workforce with varied shift patterns affects commuting'
    ]
  },
  {
    id: 'healthcare',
    name: 'Healthcare Practice',
    icon: '🏥',
    description: '40-employee medical practice with specialized equipment',
    employees: '~40 employees',
    data: {
      electricity: 95000, // Medical equipment and climate control
      gas: 28000, // Consistent heating for patient comfort
      fuel: 2500, // Mobile services and deliveries
      flights: 8000, // Conference and training travel
      waste: 18, // Medical waste disposal
      water: 1200, // Cleaning and sterilization
      commuting: 125000
    },
    insights: [
      'Medical equipment requires consistent power supply',
      'Strict temperature control for patient areas and medicine storage',
      'Specialized medical waste disposal has higher emission factors',
      'Water usage for sterilization and cleaning protocols'
    ]
  },
  {
    id: 'education',
    name: 'Educational Institution',
    icon: '🎓',
    description: '120-staff school with boarding facilities',
    employees: '~120 staff',
    data: {
      electricity: 180000, // Classrooms, IT, boarding facilities
      gas: 95000, // Heating large buildings
      fuel: 3200, // School buses and maintenance
      flights: 18000, // Educational trips and exchanges
      waste: 35, // Food waste and general waste
      water: 1800, // Boarding, kitchens, sports facilities
      commuting: 195000 // Mix of staff and day students
    },
    insights: [
      'Large buildings require significant heating and lighting',
      'Boarding facilities increase water and waste emissions',
      'Educational trips contribute to travel emissions',
      'Food services create organic waste streams'
    ]
  }
];

interface IndustryPresetsProps {
  onPresetSelect: (preset: IndustryPreset) => void;
  showAdvanced?: boolean;
}

export default function IndustryPresets({ onPresetSelect, showAdvanced = false }: IndustryPresetsProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const handlePresetClick = (preset: IndustryPreset) => {
    setSelectedPreset(preset.id);
    onPresetSelect(preset);
  };

  const calculatePresetTotal = (data: PresetData): number => {
    const electricity = (data.electricity * 0.193) / 1000;
    const gas = (data.gas * 0.184) / 1000;
    const fuel = (data.fuel * 2.687) / 1000;
    const flights = (data.flights * 0.246) / 1000;
    const waste = showAdvanced ? ((data.waste || 0) * 0.594) / 1000 : 0;
    const water = showAdvanced ? ((data.water || 0) * 0.344) / 1000 : 0;
    const commuting = showAdvanced ? ((data.commuting || 0) * 0.171) / 1000 : 0;
    
    return electricity + gas + fuel + flights + waste + water + commuting;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Industry Templates</h3>
        <p className="text-sm text-gray-600">
          Choose a preset based on your industry to start with typical values. You can adjust all values after selection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INDUSTRY_PRESETS.map((preset) => (
          <div key={preset.id} className="relative group">
            <div
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedPreset === preset.id
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-green-300'
              }`}
              onClick={() => handlePresetClick(preset)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{preset.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">{preset.name}</h4>
                    <p className="text-xs text-gray-500">{preset.employees}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(showDetails === preset.id ? null : preset.id);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{preset.description}</p>

              <div className="flex items-center justify-between">
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    {calculatePresetTotal(preset.data).toFixed(1)} tCO₂e
                  </div>
                  <div className="text-xs text-gray-500">Est. Annual</div>
                </div>
                
                <button
                  onClick={() => handlePresetClick(preset)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    selectedPreset === preset.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
                  }`}
                >
                  {selectedPreset === preset.id ? 'Selected' : 'Use Template'}
                </button>
              </div>
            </div>

            {/* Details Dropdown */}
            {showDetails === preset.id && (
              <div className="absolute top-full left-0 right-0 z-10 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                <div className="mb-3">
                  <h5 className="font-semibold text-gray-900 text-sm mb-2">Typical Activity Data:</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>Electricity:</span>
                      <span>{preset.data.electricity.toLocaleString()} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gas:</span>
                      <span>{preset.data.gas.toLocaleString()} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fuel:</span>
                      <span>{preset.data.fuel.toLocaleString()} litres</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Flights:</span>
                      <span>{preset.data.flights.toLocaleString()} km</span>
                    </div>
                    {showAdvanced && preset.data.waste && (
                      <div className="flex justify-between">
                        <span>Waste:</span>
                        <span>{preset.data.waste} tonnes</span>
                      </div>
                    )}
                    {showAdvanced && preset.data.water && (
                      <div className="flex justify-between">
                        <span>Water:</span>
                        <span>{preset.data.water} m³</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold text-gray-900 text-sm mb-2">Key Insights:</h5>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {preset.insights.map((insight, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-500 mr-1 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-start space-x-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-600">
            <p className="font-medium mb-1">About Industry Templates:</p>
            <ul className="space-y-1">
              <li>• Values based on typical UK organizations of similar size and sector</li>
              <li>• All values can be customized after selection to match your specific situation</li>
              <li>• Emissions calculated using UK DEFRA 2025 emission factors</li>
              <li>• Templates include Scope 1, 2, and 3 emissions where applicable</li>
            </ul>
          </div>
        </div>
      </div>

      {selectedPreset && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-800">
              {INDUSTRY_PRESETS.find(p => p.id === selectedPreset)?.name} template applied
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            You can now adjust any values in the calculator to better reflect your organization's actual activity data.
          </p>
        </div>
      )}
    </div>
  );
}