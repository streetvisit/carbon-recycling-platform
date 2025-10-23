# UK Energy Grid Live Data Setup

Your UK Energy Dashboard currently uses the **Carbon Intensity API** which provides live data without requiring an API key. However, to get the full experience like https://grid.iamkate.com/, you'll want to integrate additional data sources.

## Current Status

✅ **Working Now (No signup required):**
- Carbon Intensity API (`https://carbonintensity.org.uk/`)
  - Live carbon intensity data
  - Generation mix percentages
  - Regional data
  - **No API key needed** - free and open

⚠️ **Using Simulated Data (Needs API keys):**
- Real-time demand in GW
- Real-time generation in GW  
- Actual system prices

## Data Sources Used by grid.iamkate.com

### 1. Carbon Intensity API (Already Integrated ✅)
- **URL:** https://carbonintensity.org.uk/
- **API:** https://api.carbonintensity.org.uk/
- **Signup:** Not required
- **Cost:** Free
- **What it provides:**
  - Current and forecast carbon intensity (gCO2/kWh)
  - Generation mix percentages
  - Regional breakdowns
  - Historical data

### 2. Elexon Insights Solution API
- **URL:** https://developer.data.elexon.co.uk/
- **API Base:** https://data.elexon.co.uk/bmrs/api/v1
- **Signup:** **NOT Required!** 🎉
- **Cost:** Free
- **What it provides:**
  - Real-time demand (MW)
  - Instantaneous generation by fuel type (MW)
  - System buy/sell prices
  - Balancing mechanism data
  - Settlement data
  - Wind and demand forecasts
  - And much more!

**⚠️ Important:** You MUST include this attribution when using BMRS data:
> Contains BMRS data © Elexon Limited copyright and database right 2025

### 3. NESO (National Energy System Operator) Data Portal
- **URL:** https://www.neso.energy/data-portal
- **API:** Various endpoints
- **Signup:** May be required for certain datasets
- **Cost:** Free
- **What it provides:**
  - Network frequency
  - Interconnector flows
  - Wind and solar forecasts
  - Long-term system data

## How to Enable Full Live Data

**Good news: No signup or API key required!** 🎉

The Elexon Insights Solution API is completely open and free. Just integrate it!

### Step 1: Update the Integration

The Elexon API client at `src/lib/bmrsApi.ts` is already updated with:
- Real-time generation data (FUELINST endpoint)
- Real-time demand data (INDO endpoint)  
- System prices (MID endpoint)
- All using JSON responses (no XML parsing needed)

### Step 2: Integrate with Dashboard

Update `ukCarbonIntensityApi.ts` to use real Elexon data:

```typescript
import { getLiveGridData } from './bmrsApi';

// In getUKGridData() function:
const elexonData = await getLiveGridData();
// Use elexonData.demand, elexonData.generation, elexonData.prices
```

### Step 3: Test

The API returns JSON and works immediately - no registration needed!

## Current Behavior

**Current (after integration is complete):**
- Uses Carbon Intensity API for carbon data and mix percentages ✅
- Uses **real** Elexon demand data in MW (converted to GW)
- Uses **real** Elexon generation data by fuel type in MW (converted to GW)
- Uses **real** Elexon system buy/sell prices in £/MWh
- **No API key required** ✅

## API Rate Limits

| API | Rate Limit | Notes |
|-----|------------|-------|
| Carbon Intensity | None specified | Reasonable use expected |
| Elexon Insights | None specified | Public API, reasonable use expected |
| NESO | Varies by endpoint | Check documentation |

## Updates Frequency

Your dashboard updates every **2 seconds**. The actual APIs update:
- Carbon Intensity: Every 30 minutes (half-hourly settlements)
- Elexon Instantaneous Generation (FUELINST): Every 5 minutes
- Elexon Demand (INDO): Every settlement period (30 minutes)
- Elexon Prices (MID): Every settlement period (30 minutes)

So even with live APIs, you won't see changes every 2 seconds - the data updates at the API's refresh intervals.

## Next Steps

1. ✅ **Elexon API is ready** - No signup needed!
2. **Integrate with dashboard** - Update `ukCarbonIntensityApi.ts` to use real Elexon data
3. **Test with live data** - Should work immediately
4. **Optional:** Add NESO data for frequency/interconnector flows

## Need Help?

- Carbon Intensity API docs: https://carbon-intensity.github.io/api-definitions/
- Elexon Insights API docs: https://developer.data.elexon.co.uk/
- NESO Portal: https://www.neso.energy/data-portal

## License Requirements

✅ **Already added to dashboard footer:**
> Contains BMRS data © Elexon Limited copyright and database right 2025

Make sure this attribution remains visible whenever displaying BMRS data.
