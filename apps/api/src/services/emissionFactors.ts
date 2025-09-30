/**
 * Emission Factors Service
 * 
 * Contains emission factors from UK DEFRA 2024 conversion factors
 * for greenhouse gas (GHG) reporting.
 */

export interface EmissionFactor {
  value: number; // kgCO2e per unit
  unit: string;
  region: string;
  source: string;
  scope: 'scope_1' | 'scope_2' | 'scope_3';
  category: string;
}

// UK DEFRA 2024 Emission Factors (simplified for demonstration)
// In production, this would be loaded from a database or external API
const EMISSION_FACTORS: Record<string, Record<string, Record<string, EmissionFactor>>> = {
  // Electricity (Scope 2)
  'electricity_usage': {
    'kWh': {
      'uk': {
        value: 0.21233, // kgCO2e per kWh (UK grid average 2024)
        unit: 'kWh',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_2',
        category: 'Purchased Electricity'
      }
    }
  },
  
  // Natural Gas (Scope 1)
  'natural_gas': {
    'kWh': {
      'uk': {
        value: 0.18316, // kgCO2e per kWh
        unit: 'kWh',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_1',
        category: 'Stationary Combustion'
      }
    },
    'cubic_metres': {
      'uk': {
        value: 2.03423, // kgCO2e per cubic metre
        unit: 'cubic_metres',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_1',
        category: 'Stationary Combustion'
      }
    }
  },

  // Vehicle Fuel (Scope 1)
  'petrol': {
    'litres': {
      'uk': {
        value: 2.31676, // kgCO2e per litre
        unit: 'litres',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_1',
        category: 'Mobile Combustion'
      }
    }
  },

  'diesel': {
    'litres': {
      'uk': {
        value: 2.68781, // kgCO2e per litre
        unit: 'litres',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_1',
        category: 'Mobile Combustion'
      }
    }
  },

  // Business Travel (Scope 3)
  'air_travel_domestic': {
    'passenger_km': {
      'uk': {
        value: 0.24587, // kgCO2e per passenger-km
        unit: 'passenger_km',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_3',
        category: 'Business Travel'
      }
    }
  },

  'air_travel_short_haul': {
    'passenger_km': {
      'uk': {
        value: 0.15573, // kgCO2e per passenger-km
        unit: 'passenger_km',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_3',
        category: 'Business Travel'
      }
    }
  },

  'air_travel_long_haul': {
    'passenger_km': {
      'uk': {
        value: 0.19085, // kgCO2e per passenger-km
        unit: 'passenger_km',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_3',
        category: 'Business Travel'
      }
    }
  },

  // Rail Travel (Scope 3)
  'rail_travel': {
    'passenger_km': {
      'uk': {
        value: 0.03549, // kgCO2e per passenger-km
        unit: 'passenger_km',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_3',
        category: 'Business Travel'
      }
    }
  },

  // Hotel Stays (Scope 3)
  'hotel_stay': {
    'room_nights': {
      'uk': {
        value: 10.53, // kgCO2e per room night
        unit: 'room_nights',
        region: 'uk',
        source: 'UK DEFRA 2024',
        scope: 'scope_3',
        category: 'Business Travel'
      }
    }
  }
};

/**
 * Get emission factor for a given activity type, unit, and region
 */
export function getEmissionFactor(
  activityType: string, 
  unit: string, 
  region: string = 'uk'
): EmissionFactor {
  const activityFactors = EMISSION_FACTORS[activityType];
  
  if (!activityFactors) {
    throw new Error(`No emission factors found for activity type: ${activityType}`);
  }

  const unitFactors = activityFactors[unit];
  
  if (!unitFactors) {
    throw new Error(`No emission factors found for unit: ${unit} in activity: ${activityType}`);
  }

  const regionFactor = unitFactors[region];
  
  if (!regionFactor) {
    throw new Error(`No emission factors found for region: ${region} in activity: ${activityType}, unit: ${unit}`);
  }

  return regionFactor;
}

/**
 * Get all supported activity types
 */
export function getSupportedActivityTypes(): string[] {
  return Object.keys(EMISSION_FACTORS);
}

/**
 * Get all supported units for a given activity type
 */
export function getSupportedUnits(activityType: string): string[] {
  const activityFactors = EMISSION_FACTORS[activityType];
  return activityFactors ? Object.keys(activityFactors) : [];
}

/**
 * Check if an activity type and unit combination is supported
 */
export function isActivitySupported(activityType: string, unit: string, region: string = 'uk'): boolean {
  try {
    getEmissionFactor(activityType, unit, region);
    return true;
  } catch {
    return false;
  }
}