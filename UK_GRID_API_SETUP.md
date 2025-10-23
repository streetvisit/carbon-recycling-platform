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

### 2. BMRS (Balancing Mechanism Reporting Service) 
- **URL:** https://bmrs.elexon.co.uk/
- **Portal:** https://www.elexonportal.co.uk/
- **Signup:** **Required** (free account)
- **Cost:** Free
- **What it provides:**
  - Real-time demand (MW)
  - Actual generation by fuel type (MW)
  - System prices
  - Balancing mechanism data
  - Settlement data

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

### Step 1: Register for BMRS API Access

1. Go to https://www.elexonportal.co.uk/
2. Click "Register" and create a free account
3. Once logged in, navigate to API Access
4. Request an API key (usually instant)
5. Copy your API key

### Step 2: Add API Key to Environment

Add to your `.env` file:

```bash
PUBLIC_BMRS_API_KEY=your_api_key_here
```

Add to Cloudflare Pages environment variables:
1. Go to Cloudflare dashboard
2. Navigate to Pages > Your Project > Settings > Environment variables
3. Add: `PUBLIC_BMRS_API_KEY` with your key

### Step 3: Install XML Parser (BMRS uses XML responses)

```bash
npm install fast-xml-parser
```

### Step 4: Complete BMRS Integration

The skeleton BMRS API client is ready at `src/lib/bmrsApi.ts`. To complete it:

1. Implement XML parsing for the responses
2. Add proper error handling
3. Integrate into `ukCarbonIntensityApi.ts`
4. Test with live API calls

## Current Behavior

**Without BMRS API key:**
- Uses Carbon Intensity API for carbon data and mix percentages ✅
- **Simulates** demand/generation using realistic time-of-day patterns
- **Estimates** prices based on carbon intensity

**With BMRS API key (once fully implemented):**
- Uses Carbon Intensity API for carbon data ✅
- Uses **real** BMRS demand data in GW
- Uses **real** BMRS generation data by fuel type in MW
- Uses **real** BMRS system prices in £/MWh

## API Rate Limits

| API | Rate Limit | Notes |
|-----|------------|-------|
| Carbon Intensity | None specified | Reasonable use expected |
| BMRS | 100 requests/minute | Per API key |
| NESO | Varies by endpoint | Check documentation |

## Updates Frequency

Your dashboard updates every **2 seconds**. The actual APIs update:
- Carbon Intensity: Every 30 minutes (half-hourly settlements)
- BMRS: Real-time (some data every 5 minutes, others every settlement period)

So even with live APIs, you won't see changes every 2 seconds - the data updates at the settlement period boundaries.

## Next Steps

1. **Register for BMRS API** (5 minutes)
2. **Add XML parser** library
3. **Complete BMRS integration** in `bmrsApi.ts`
4. **Test with live data**
5. **Optional:** Add NESO data for frequency/interconnector flows

## Need Help?

- Carbon Intensity API docs: https://carbon-intensity.github.io/api-definitions/
- BMRS API docs: https://www.elexon.co.uk/operations-settlement/bsc-and-codes/bmrs-governance/
- NESO Portal: https://www.neso.energy/data-portal

## License Requirements

✅ **Already added to dashboard footer:**
> Contains BMRS data © Elexon Limited copyright and database right 2025

Make sure this attribution remains visible whenever displaying BMRS data.
