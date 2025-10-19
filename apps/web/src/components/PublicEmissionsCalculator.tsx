import { useState, useEffect } from 'preact/hooks';

interface EmissionFactor {
  factor: number;
  unit: string;
  category: string;
  source: string;
}

interface ActivityData {
  id: string;
  value: number;
  unit: string;
  category: 'electricity' | 'gas' | 'fuel' | 'flights' | 'waste' | 'water' | 'commuting';
  emissions: number;
}

interface CalculationResult {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  breakdown: ActivityData[];
}

// UK DEFRA 2025 emission factors
const EMISSION_FACTORS: Record<string, EmissionFactor> = {
  electricity: { factor: 0.193, unit: 'kgCO2e/kWh', category: 'Scope 2', source: 'UK Grid Average 2025' },
  gas: { factor: 0.184, unit: 'kgCO2e/kWh', category: 'Scope 1', source: 'Natural Gas' },
  diesel: { factor: 2.687, unit: 'kgCO2e/litre', category: 'Scope 1', source: 'Diesel Fuel' },
  petrol: { factor: 2.392, unit: 'kgCO2e/litre', category: 'Scope 1', source: 'Petrol Fuel' },
  domesticFlight: { factor: 0.246, unit: 'kgCO2e/km', category: 'Scope 3', source: 'Domestic Flights' },
  internationalFlight: { factor: 0.309, unit: 'kgCO2e/km', category: 'Scope 3', source: 'International Flights' },
  generalWaste: { factor: 0.594, unit: 'kgCO2e/tonne', category: 'Scope 3', source: 'General Waste' },
  water: { factor: 0.344, unit: 'kgCO2e/m3', category: 'Scope 3', source: 'Water Supply & Treatment' },
  carCommuting: { factor: 0.171, unit: 'kgCO2e/km', category: 'Scope 3', source: 'Average Car' },
};

interface PublicEmissionsCalculatorProps {
  showAdvanced?: boolean;
}

export default function PublicEmissionsCalculator({ showAdvanced = false }: PublicEmissionsCalculatorProps) {
  const [activityData, setActivityData] = useState<ActivityData[]>([
    { id: 'electricity', value: 12500, unit: 'kWh', category: 'electricity', emissions: 0 },
    { id: 'gas', value: 8750, unit: 'kWh', category: 'gas', emissions: 0 },
    { id: 'diesel', value: 2150, unit: 'litres', category: 'fuel', emissions: 0 },
    { id: 'flights', value: 45000, unit: 'km', category: 'flights', emissions: 0 },
  ]);

  const [advancedData, setAdvancedData] = useState<ActivityData[]>([
    { id: 'waste', value: 25, unit: 'tonnes', category: 'waste', emissions: 0 },
    { id: 'water', value: 1200, unit: 'm³', category: 'water', emissions: 0 },
    { id: 'commuting', value: 180000, unit: 'km', category: 'commuting', emissions: 0 },
  ]);

  const [result, setResult] = useState<CalculationResult>({
    scope1: 0,
    scope2: 0,
    scope3: 0,
    total: 0,
    breakdown: []
  });

  const [isCalculating, setIsCalculating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateInput = (value: number, category: string): string | null => {
    if (value < 0) return 'Value cannot be negative';
    if (category === 'electricity' && value > 1000000) return 'Electricity consumption seems too high';
    if (category === 'gas' && value > 500000) return 'Gas consumption seems too high';
    if (category === 'fuel' && value > 100000) return 'Fuel consumption seems too high';
    if (category === 'flights' && value > 500000) return 'Flight distance seems too high';
    return null;
  };

  const updateActivityValue = (id: string, value: number, isAdvanced = false) => {
    const dataSet = isAdvanced ? advancedData : activityData;
    const setDataSet = isAdvanced ? setAdvancedData : setActivityData;
    
    const item = dataSet.find(item => item.id === id);
    if (!item) return;

    const error = validateInput(value, item.category);
    setErrors(prev => ({
      ...prev,
      [id]: error || ''
    }));

    const updatedData = dataSet.map(item => 
      item.id === id ? { ...item, value } : item
    );
    setDataSet(updatedData);
  };

  const calculateEmissions = () => {
    setIsCalculating(true);
    
    // Simulate calculation delay for better UX
    setTimeout(() => {
      const allData = [...activityData, ...(showAdvanced ? advancedData : [])];
      
      const calculatedData = allData.map(item => {
        let emissions = 0;
        let factorKey = '';

        switch (item.id) {
          case 'electricity':
            factorKey = 'electricity';
            break;
          case 'gas':
            factorKey = 'gas';
            break;
          case 'diesel':
            factorKey = 'diesel';
            break;
          case 'flights':
            factorKey = 'domesticFlight';
            break;
          case 'waste':
            factorKey = 'generalWaste';
            break;
          case 'water':
            factorKey = 'water';
            break;
          case 'commuting':
            factorKey = 'carCommuting';
            break;
        }

        if (EMISSION_FACTORS[factorKey]) {
          emissions = (item.value * EMISSION_FACTORS[factorKey].factor) / 1000; // Convert to tonnes
        }

        return { ...item, emissions };
      });

      // Calculate scope totals
      const scope1 = calculatedData
        .filter(item => ['gas', 'diesel'].includes(item.id))
        .reduce((sum, item) => sum + item.emissions, 0);
      
      const scope2 = calculatedData
        .filter(item => ['electricity'].includes(item.id))
        .reduce((sum, item) => sum + item.emissions, 0);
        
      const scope3 = calculatedData
        .filter(item => ['flights', 'waste', 'water', 'commuting'].includes(item.id))
        .reduce((sum, item) => sum + item.emissions, 0);

      const total = scope1 + scope2 + scope3;

      setResult({
        scope1,
        scope2,
        scope3,
        total,
        breakdown: calculatedData
      });

      setIsCalculating(false);
    }, 500);
  };

  // Auto-calculate when data changes
  useEffect(() => {
    calculateEmissions();
  }, [activityData, advancedData, showAdvanced]);

  const formatEmissions = (value: number): string => {
    if (value === 0) return '0.000';
    if (value < 0.001) return '<0.001';
    return value.toFixed(3);
  };

  const getScopeColor = (scope: number): string => {
    switch (scope) {
      case 1: return 'border-red-200 bg-red-50';
      case 2: return 'border-orange-200 bg-orange-50';
      case 3: return 'border-cyan-200 bg-cyan-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getScopeTextColor = (scope: number): string => {
    switch (scope) {
      case 1: return 'text-red-700';
      case 2: return 'text-orange-700';
      case 3: return 'text-cyan-700';
      default: return 'text-gray-700';
    }
  };

  const renderInputSection = (data: ActivityData[], isAdvancedSection = false) => (
    <div className="space-y-6">
      {data.map((item) => {
        const factorKey = {
          'electricity': 'electricity',
          'gas': 'gas',
          'diesel': 'diesel',
          'flights': 'domesticFlight',
          'waste': 'generalWaste',
          'water': 'water',
          'commuting': 'carCommuting'
        }[item.id];
        
        const factor = EMISSION_FACTORS[factorKey];
        
        return (
          <div key={item.id} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
              {item.id === 'flights' ? 'Business Travel (Air)' : 
               item.id === 'commuting' ? 'Employee Commuting' :
               item.id === 'waste' ? 'General Waste' :
               item.id === 'water' ? 'Water Consumption' :
               item.id}
            </label>
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={item.value}
                  onInput={(e) => updateActivityValue(item.id, parseFloat((e.target as HTMLInputElement).value) || 0, isAdvancedSection)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors[item.id] ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter value"
                />
                {isCalculating && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              <select 
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled
              >
                <option>{item.unit}</option>
              </select>
            </div>
            {errors[item.id] && (
              <p className="mt-1 text-xs text-red-600">{errors[item.id]}</p>
            )}
            {factor && (
              <p className="text-xs text-gray-500 mt-1">
                {factor.source}: {factor.factor} {factor.unit}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Section */}
      <div className="bg-white border rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Activity Data Input</h3>
          {isCalculating && (
            <div className="flex items-center text-sm text-gray-500">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Calculating...
            </div>
          )}
        </div>
        
        <div className="space-y-8">
          {/* Basic Inputs */}
          {renderInputSection(activityData)}
          
          {/* Advanced Inputs */}
          {showAdvanced && (
            <div className="pt-6 border-t border-gray-200">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Additional Sources</h4>
              {renderInputSection(advancedData, true)}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="bg-white border rounded-lg shadow-sm p-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Calculated Emissions</h3>
        <div className="space-y-6">
          {/* Scope Breakdowns */}
          {[
            { scope: 1, name: 'Scope 1 (Direct Emissions)', value: result.scope1, items: result.breakdown.filter(item => ['gas', 'diesel'].includes(item.id)) },
            { scope: 2, name: 'Scope 2 (Indirect Energy)', value: result.scope2, items: result.breakdown.filter(item => ['electricity'].includes(item.id)) },
            { scope: 3, name: 'Scope 3 (Indirect Other)', value: result.scope3, items: result.breakdown.filter(item => ['flights', 'waste', 'water', 'commuting'].includes(item.id)) }
          ].map(({ scope, name, value, items }) => (
            <div key={scope} className={`rounded-lg p-4 border ${getScopeColor(scope)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{name}</span>
                <span className={`font-bold ${getScopeTextColor(scope)}`}>
                  {formatEmissions(value)} tCO₂e
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="capitalize">
                      {item.id === 'flights' ? 'Business Travel' : 
                       item.id === 'commuting' ? 'Employee Commuting' :
                       item.id}:
                    </span>
                    <span>{formatEmissions(item.emissions)} tCO₂e</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="bg-gray-900 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total Carbon Footprint</span>
              <span className="text-2xl font-bold">{formatEmissions(result.total)} tCO₂e</span>
            </div>
            <p className="text-sm text-gray-300 mt-1">Annual emissions calculated</p>
          </div>

          {/* Equivalent Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Emissions Context</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Equivalent to {Math.round(result.total * 2174)} miles driven by an average car</p>
              <p>• Equal to {Math.round(result.total * 0.4)} homes' energy use for one year</p>
              <p>• Offsets {Math.round(result.total * 46)} tree seedlings grown for 10 years</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}