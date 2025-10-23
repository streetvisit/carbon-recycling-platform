# NESO (National Energy System Operator) Data Sources

## Available for Integration - All FREE & Open License

Base API: `https://api.neso.energy/`
Documentation: https://www.neso.energy/data-portal/neso-open-licence

---

## 🔥 PRIORITY 1 - Real-time & Live Data

### 1. **Embedded Wind and Solar Forecasts** ⭐⭐⭐
- **Dataset ID**: `embedded-wind-and-solar-forecasts`
- **Update Frequency**: Hourly
- **Forecast Range**: Within day up to 14 days ahead
- **Resolution**: 30-minute intervals
- **API URL**: `https://api.neso.energy/dataset/91c0c70e-0ef5-4116-b6fa-7ad084b5e0e8/resource/db6c038f-98af-4570-ab60-24d71ebd0ae5/download/[timestamp]_embedded_forecast.csv`
- **Use Case**: Predict renewable energy availability, help users plan usage

### 2. **Historic Generation Mix** ⭐⭐⭐
- **Dataset ID**: `historic-generation-mix`
- **Update Frequency**: 30 minutes
- **Data**: Generation by fuel type + carbon intensity
- **API URL**: Available via CKAN API
- **Use Case**: Current generation mix, trends, comparisons

### 3. **Daily Demand Update** ⭐⭐
- **Dataset ID**: `daily-demand-update`
- **Update Frequency**: Daily
- **Use Case**: Track total GB electricity demand

### 4. **Interconnector Data** ⭐⭐⭐
Individual datasets for each interconnector:
- `ifa` - GB-France (2GW)
- `ifa2` - GB-France (1GW)  
- `britned` - GB-Netherlands (1GW)
- `nemolink` - GB-Belgium (1GW)
- `eleclink` - GB-France (1GW)
- `ik-viking-link` - GB-Denmark (1.4GW)
- **Update Frequency**: Near real-time
- **Use Case**: Show live imports/exports on map

---

## 📊 PRIORITY 2 - Forecasts & Planning

### 5. **1-Day Ahead Demand Forecast** ⭐⭐
- **Dataset ID**: `1-day-ahead-demand-forecast`
- **Resolution**: 30-minute intervals
- **Use Case**: Predict peak demand times

### 6. **7-Day Ahead National Forecast** ⭐⭐
- **Dataset ID**: `7-day-ahead-national-forecast`
- **Use Case**: Week-ahead planning view

### 7. **14-Days Ahead Wind Forecasts** ⭐
- **Dataset ID**: `14-days-ahead-operational-metered-wind-forecasts`
- **Use Case**: Long-term wind generation prediction

### 8. **Country Carbon Intensity Forecast** ⭐⭐⭐
- **Dataset ID**: `country-carbon-intensity-forecast`
- **Use Case**: Show when grid will be cleanest

---

## 🗺️ PRIORITY 3 - Geographic & Infrastructure

### 9. **GIS Boundaries for GB DNO License Areas** ⭐
- **Dataset ID**: `gis-boundaries-for-gb-dno-license-areas`
- **Format**: GeoJSON
- **Use Case**: Regional boundary overlays on map

### 10. **GIS Boundaries for GB Grid Supply Points** ⭐
- **Dataset ID**: `gis-boundaries-for-gb-grid-supply-points`
- **Format**: GeoJSON
- **Use Case**: Show grid connection points

### 11. **Interconnector Register** ⭐
- **Dataset ID**: `interconnector-register`
- **Use Case**: Complete list of all interconnectors with capacities

---

## 💰 PRIORITY 4 - Market & Pricing Data

### 12. **Daily Balancing Costs** ⭐
- **Dataset ID**: `daily-balancing-costs-balancing-services-use-of-system`
- **Use Case**: Show system balancing costs

### 13. **System Prices** 
- Available through balancing mechanism data
- **Use Case**: Real electricity prices

---

## 🔋 PRIORITY 5 - Flexibility & Storage

### 14. **Demand Flexibility Service** ⭐
- **Dataset ID**: `demand-flexibility-service`
- **Use Case**: Show when demand response is active

### 15. **Demand Flexibility Service Live Events** ⭐⭐
- **Dataset ID**: `demand-flexibility-service-live-events`
- **Use Case**: Alert users to active flexibility events

### 16. **Dynamic Containment Data**
- **Dataset ID**: `dynamic-containment-data`
- **Use Case**: Battery storage & frequency response

---

## 📈 PRIORITY 6 - Historical Analysis

### 17. **Historic Demand Data**
- **Dataset ID**: `historic-demand-data`
- **Use Case**: Compare current vs historical patterns

### 18. **Embedded Register**
- **Dataset ID**: `embedded-register`
- **Use Case**: List of all embedded generation (small-scale)

---

## ⚡ IMPLEMENTATION ROADMAP

### Phase 1 - Core Real-time (Week 1)
- [ ] Embedded Wind & Solar Forecasts (14-day ahead)
- [ ] Historic Generation Mix (real-time)
- [ ] All Interconnector Feeds (live flows)
- [ ] Country Carbon Intensity Forecast

### Phase 2 - Enhanced Forecasting (Week 2)
- [ ] 1-Day & 7-Day Demand Forecasts
- [ ] Daily Demand Update
- [ ] Demand Flexibility Live Events

### Phase 3 - Geographic & Advanced (Week 3)
- [ ] GIS Boundary overlays
- [ ] Grid Supply Points
- [ ] Historical comparison views
- [ ] Market pricing integration

---

## 🔧 API ACCESS PATTERN

All NESO data is accessed via CKAN API:

```bash
# List all datasets
curl https://api.neso.energy/api/3/action/package_list

# Get dataset metadata
curl https://api.neso.energy/api/3/action/package_show?id=DATASET_ID

# Get resource data
curl https://api.neso.energy/dataset/DATASET_UUID/resource/RESOURCE_UUID/download/FILE.csv
```

**No API key required - completely open!**

---

## 💡 UNIQUE FEATURES WE CAN BUILD

1. **"Best Time to Use Energy" Predictor** - Combine carbon forecast + demand forecast
2. **14-Day Renewable Outlook** - Wind + solar forecasts chart
3. **Live Import/Export Map** - Real-time interconnector flows visualization
4. **Demand Flexibility Alerts** - Notify when DFS events active
5. **Historical Comparison** - "Same time last week" overlays
6. **Regional GIS View** - DNO area overlays with generation data

---

## 📊 DATA UPDATE FREQUENCIES

| Dataset | Update Frequency | Latency |
|---------|-----------------|---------|
| Generation Mix | 30 minutes | ~5 min |
| Wind/Solar Forecasts | Hourly | ~10 min |
| Interconnectors | Real-time | ~1 min |
| Carbon Forecast | Daily | ~12 hours |
| Demand Forecast | Daily | ~12 hours |

---

## ✅ LICENSING

All NESO data portal datasets are under **NESO Open Licence** which allows:
- ✅ Commercial use
- ✅ Modification  
- ✅ Distribution
- ✅ Private use

**Requirements**:
- Attribute NESO as source
- Include licence text/link

Licence: https://www.neso.energy/document/347976/download
