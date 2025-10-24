# BMRS API Datasets - Analysis for Carbon Recycling Platform

## Currently Implemented ✅

- **FUELINST** - Instantaneous fuel generation (real-time)
- **INDO** - Initial demand outturn
- **FUELHH** - Half-hourly fuel generation

## High Priority - Recommended for Implementation 🎯

### 1. Generation & Demand (Core Metrics)
- **B1610** - Actual or Estimated Wind and Solar Power Generation
  - Critical for renewable energy tracking
  - Settlement period data
  - `/datasets/B1610?settlementDate={settlementDate}&settlementPeriod={settlementPeriod}`

- **INDGEN** - Individual BM Unit Generation
  - Per-unit generation data
  - Better granularity than FUELINST
  - `/datasets/INDGEN`

- **INDDEM** - Indicative Demand
  - Real-time demand indicators
  - `/datasets/INDDEM`

### 2. Forecasting (Planning & Prediction)
- **WINDFOR** - Wind Generation Forecast
  - Essential for renewable capacity planning
  - `/datasets/WINDFOR`

- **FOU2T14D** - 2-14 Day Ahead Generation Forecast
  - Medium-term planning
  - `/datasets/FOU2T14D`

- **NOU2T14D** - 2-14 Day Ahead Demand Forecast
  - Demand prediction
  - `/datasets/NOU2T14D`

- **/forecast/generation/wind-and-solar/day-ahead** - Day-ahead renewable forecast
  - Combined solar + wind forecasting
  - `/forecast/generation/wind-and-solar/day-ahead?from={from}&to={to}`

- **/forecast/demand/day-ahead** - Day-ahead demand forecast
  - Short-term demand prediction
  - `/forecast/demand/day-ahead?from={from}&to={to}`

### 3. Pricing & Market (Carbon Cost Analysis)
- **MID** - Market Index Data (System Prices)
  - System buy/sell prices
  - Cost analysis for carbon intensity
  - `/datasets/MID?from={from}&to={to}`

- **/balancing/pricing/market-index** - Balancing market pricing
  - Real-time market prices
  - `/balancing/pricing/market-index?from={from}&to={to}`

### 4. System Status (Grid Health)
- **FREQ** - System Frequency
  - Grid stability indicator
  - Real-time frequency monitoring
  - `/datasets/FREQ`

- **TEMP** - Temperature Data
  - Weather correlation with demand
  - `/datasets/TEMP`

- **SYSWARN** - System Warnings
  - Grid alerts and warnings
  - `/datasets/SYSWARN`

- **/system/warnings** - System warnings endpoint
  - Real-time grid alerts

### 5. Interconnectors (International Power Flow)
- **/generation/outturn/interconnectors** - Interconnector flows
  - Cross-border electricity flow
  - Import/export tracking
  - Important for carbon intensity (imported power source)

## Medium Priority - Consider for Phase 2 📊

### Carbon Intensity Calculation
- **NONBM** - Non-BM STOR (Short Term Operating Reserve)
  - Storage and flexible generation
  - `/datasets/NONBM`

- **NETBSAD** - Net Balancing Services Adjustment
  - System balancing costs
  - `/datasets/NETBSAD?from={from}&to={to}`

### Historical Analysis
- **FUELHH** - Half-hourly fuel generation (already have, but underutilized)
  - Historical generation patterns
  - Settlement period analysis

- **INDOD** - Initial Demand Outturn Daily
  - Daily demand summaries
  - `/datasets/INDOD?publishDateTimeFrom={publishDateTimeFrom}`

### Margin & Reliability
- **LOLPDRM** - Loss of Load Probability During Maintenance
  - Grid reliability metrics
  - `/datasets/LOLPDRM?publishDateTimeFrom={publishDateTimeFrom}`

- **/forecast/margin/daily** - Daily margin forecast
  - Capacity margin predictions

- **/forecast/surplus/daily** - Daily surplus forecast
  - Excess capacity tracking

### Peak Demand
- **/demand/peak** - Peak demand data
  - Maximum demand tracking
  - Triad season data

## Low Priority - Specialized Use Cases 📋

### Balancing Mechanism (Advanced Grid Operations)
- **BOD** - Bid-Offer Data
- **BOALF** - Bid-Offer Acceptance Level Flagging
- **PN/QPN** - Physical Notifications / Quiescent Physical Notifications
- **DISBSAD** - Disaggregated Balancing Services Adjustment
- **MELS/MILS** - Maximum Export/Import Limit

### Settlement Data (Financial/Trading)
- **MZT/MNZT** - Minimum Zero Time / Maximum Non-Zero Time
- **NTB/NTO** - Notice to Deliver Bids/Offers
- **SEL/SIL** - Stable Export/Import Limit
- **RURE/RURI** - Replacement Reserve
- **RDRE/RDRI** - Run-Down Rate Export/Import

### REMIT (Market Transparency)
- **/remit** endpoints - European transparency obligations
  - Outage reporting
  - Market participant data
  - Required for regulatory compliance in EU

## Recommended Implementation Roadmap 🗓️

### Phase 1 (Immediate - High Value, Low Complexity)
1. ✅ **FUELINST** (Already implemented)
2. ✅ **INDO** (Already implemented)  
3. **FREQ** - System frequency monitoring
4. **TEMP** - Temperature data
5. **MID** - Market prices
6. **WINDFOR** - Wind forecasting

### Phase 2 (Short-term - Enhanced Features)
1. **B1610** - Detailed wind/solar generation
2. **INDGEN** - Individual unit generation
3. **/forecast/generation/wind-and-solar/day-ahead** - Renewable forecasts
4. **/forecast/demand/day-ahead** - Demand forecasts
5. **/generation/outturn/interconnectors** - Interconnector flows
6. **SYSWARN** - System warnings

### Phase 3 (Medium-term - Advanced Analytics)
1. **FOU2T14D/NOU2T14D** - Medium-term forecasting
2. **LOLPDRM** - Reliability metrics
3. **/forecast/margin/daily** - Capacity margins
4. **NONBM** - Storage and flexible generation
5. **/demand/peak** - Peak demand tracking

### Phase 4 (Long-term - Specialized Features)
1. **REMIT** - Regulatory transparency
2. Balancing mechanism data (BOD, BOALF, etc.)
3. Settlement data for financial modeling

## Data Freshness & Update Frequencies

Based on the metadata endpoint, here are typical update frequencies:

- **Real-time** (every 5-30 seconds):
  - FREQ (system frequency)
  - FUELINST (instantaneous generation)

- **5-minute intervals**:
  - INDDEM (indicative demand)
  - INDGEN (individual generation)

- **Half-hourly** (settlement periods):
  - FUELHH (fuel generation)
  - B1610 (wind/solar generation)
  - Most balancing mechanism data

- **Hourly**:
  - Temperature data
  - Some forecast updates

- **Daily**:
  - INDO (demand outturn)
  - Day-ahead forecasts
  - Settlement summaries

## Integration Value Matrix

| Dataset | Carbon Insight Value | User Value | Complexity | Priority |
|---------|---------------------|------------|------------|----------|
| WINDFOR | High | High | Low | ⭐⭐⭐⭐⭐ |
| B1610 | High | High | Low | ⭐⭐⭐⭐⭐ |
| FREQ | Medium | High | Very Low | ⭐⭐⭐⭐⭐ |
| MID | High | Medium | Low | ⭐⭐⭐⭐ |
| TEMP | Medium | Medium | Very Low | ⭐⭐⭐⭐ |
| INDGEN | High | Medium | Medium | ⭐⭐⭐⭐ |
| Forecasts | High | High | Medium | ⭐⭐⭐⭐ |
| Interconnectors | High | Low | Low | ⭐⭐⭐ |
| NONBM | Medium | Low | Medium | ⭐⭐⭐ |
| Balancing | Low | Low | High | ⭐⭐ |
| REMIT | Low | Low | High | ⭐ |

## Carbon Recycling Platform - Specific Use Cases

### 1. Real-time Carbon Intensity Dashboard
**Datasets needed:**
- FUELINST (current generation mix)
- FREQ (grid stability)
- MID (current pricing)
- Temperature (weather impact)

### 2. Renewable Energy Forecasting
**Datasets needed:**
- WINDFOR (wind forecast)
- B1610 (actual wind/solar)
- /forecast/generation/wind-and-solar/day-ahead
- /forecast/demand/day-ahead

### 3. Grid Carbon Intensity Prediction
**Datasets needed:**
- FOU2T14D (generation forecast)
- NOU2T14D (demand forecast)
- Temperature (weather patterns)
- Historical FUELHH data

### 4. Peak Demand Analysis
**Datasets needed:**
- /demand/peak (peak tracking)
- /demand/outturn (actual demand)
- INDOD (daily summaries)

### 5. International Power Flow Analysis
**Datasets needed:**
- /generation/outturn/interconnectors
- Country-specific carbon intensity APIs
- Calculate imported power carbon footprint

## Next Steps

1. **Implement Phase 1 datasets** (FREQ, TEMP, MID, WINDFOR)
2. **Create unified dashboard** showing real-time + forecast data
3. **Add historical tracking** using FUELHH settlement data
4. **Integrate pricing** to show carbon cost correlation
5. **Build ML models** using forecast data for carbon intensity prediction

## API Implementation Notes

- All datasets support `/stream` endpoints for real-time updates
- Date parameters typically use ISO 8601 format
- Settlement periods are 1-50 (half-hourly, 00:00-23:30)
- Most endpoints support pagination
- No API key required (free and open!)
- Rate limits unknown - implement exponential backoff
- Cache responses appropriately based on update frequency

## References

- Developer Portal: https://developer.data.elexon.co.uk/
- BSC Documentation: https://bscdocs.elexon.co.uk/data-integration-platform
- API Base URL: https://data.elexon.co.uk/bmrs/api/v1
