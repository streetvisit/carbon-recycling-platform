# NESO Integration - Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Dependencies Installed ✅
Already done! `papaparse` is installed.

### 2. Use the Widgets

Add to any page:

```tsx
import { BestTimeWidget } from '@/components/widgets/BestTimeWidget';
import { RenewableOutlookWidget } from '@/components/widgets/RenewableOutlookWidget';
import { FlexibilityAlertsWidget } from '@/components/widgets/FlexibilityAlertsWidget';

export default function YourPage() {
  return (
    <div className="space-y-6">
      {/* Shows best times to use energy in next 6 hours */}
      <BestTimeWidget />
      
      {/* 14-day wind & solar forecast chart */}
      <RenewableOutlookWidget />
      
      {/* Live grid flexibility alerts */}
      <FlexibilityAlertsWidget />
    </div>
  );
}
```

### 3. Use the APIs

#### Get Current Energy Snapshot
```tsx
const response = await fetch('/api/energy/snapshot');
const { data } = await response.json();

console.log(data.generation.total); // Total MW
console.log(data.renewables.percentage); // % renewable
console.log(data.carbon.intensity); // gCO2/kWh
console.log(data.interconnectors.netFlow); // Import/export
```

#### Get Best Time Recommendations
```tsx
const response = await fetch('/api/energy/best-time');
const { data } = await response.json();

// Find next excellent time
const nextBest = data.find(r => r.recommendation === 'excellent');
console.log(`Best time: ${nextBest.timestamp}`);
console.log(`Renewable: ${nextBest.renewablePercentage}%`);
```

#### Check Flexibility Alerts
```tsx
const response = await fetch('/api/energy/flexibility-alerts');
const { data, hasActiveAlerts } = await response.json();

if (hasActiveAlerts) {
  console.log('⚡ Grid needs help! Reduce usage now.');
}
```

#### Get 14-Day Renewable Outlook
```tsx
const response = await fetch('/api/energy/renewable-outlook');
const { data } = await response.json();

const tomorrow = data[1];
console.log(`Tomorrow: ${tomorrow.avgWind}MW wind, ${tomorrow.avgSolar}MW solar`);
```

---

## 🔌 Direct NESO Client Usage

For advanced use cases, use the NESO client directly:

```tsx
import { nesoClient } from '@/lib/services/neso-client';

// Get generation mix
const mix = await nesoClient.getGenerationMix();
const latest = mix[mix.length - 1];
console.log(`Current wind: ${latest.wind} MW`);

// Get interconnector flows
const flows = await nesoClient.getAllInterconnectors();
console.log(`France import: ${flows.ifa[0].flow} MW`);

// Get renewable forecasts
const forecasts = await nesoClient.getRenewableForecasts();
console.log(`Wind forecast in 1 hour: ${forecasts[2].windForecast} MW`);

// Get demand forecast
const demand = await nesoClient.getDemandForecast1Day();
console.log(`Peak demand today: ${Math.max(...demand.map(d => d.demand))} MW`);
```

---

## 📊 Example Dashboard Page

```tsx
'use client';

import { BestTimeWidget } from '@/components/widgets/BestTimeWidget';
import { RenewableOutlookWidget } from '@/components/widgets/RenewableOutlookWidget';
import { FlexibilityAlertsWidget } from '@/components/widgets/FlexibilityAlertsWidget';

export default function EnergyDashboard() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">UK Energy Dashboard</h1>
      
      {/* Top Row - Current Status & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BestTimeWidget />
        <FlexibilityAlertsWidget />
      </div>
      
      {/* Bottom Row - Long-term Outlook */}
      <div className="grid grid-cols-1 gap-6">
        <RenewableOutlookWidget />
      </div>
    </div>
  );
}
```

---

## 🧪 Test Commands

```bash
# Start development server
npm run dev

# Test snapshot API
curl http://localhost:3000/api/energy/snapshot | jq

# Test best time API
curl http://localhost:3000/api/energy/best-time | jq

# Test alerts API
curl http://localhost:3000/api/energy/flexibility-alerts | jq

# Test outlook API
curl http://localhost:3000/api/energy/renewable-outlook | jq
```

---

## 🎨 Widget Customization

All widgets accept standard React props. You can wrap them with your own styling:

```tsx
<div className="my-custom-container">
  <BestTimeWidget />
</div>
```

Or extend them:

```tsx
'use client';

import { BestTimeWidget } from '@/components/widgets/BestTimeWidget';
import { Bell } from 'lucide-react';

export function CustomBestTimeWidget() {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2">
        <Bell className="h-4 w-4 text-blue-500" />
      </div>
      <BestTimeWidget />
    </div>
  );
}
```

---

## 🔄 Auto-Refresh Timings

| Widget/API | Refresh Interval | Data Latency |
|-----------|------------------|--------------|
| Best Time | 5 minutes | ~1-2 min |
| Flexibility Alerts | 2 minutes | Real-time |
| Renewable Outlook | 1 hour | ~10 min |
| Snapshot API | On-demand | ~1-2 min |

---

## 💾 Caching Behavior

- **In-memory cache:** 5 minutes (automatic)
- **Browser cache:** Controlled by React state
- **API cache:** NextJS automatic (development: none, production: smart)

Clear cache manually:
```tsx
import { nesoClient } from '@/lib/services/neso-client';
nesoClient.clearCache();
```

---

## 📱 Mobile Responsive

All widgets are fully responsive:
- Desktop: Full layout with all features
- Tablet: Adjusted grid, maintained functionality
- Mobile: Stacked layout, touch-friendly

---

## 🎯 Common Use Cases

### 1. Show Current Grid Status
```tsx
<BestTimeWidget />
```

### 2. Alert Users to Active Events
```tsx
<FlexibilityAlertsWidget />
// Automatically pulses when events are active
```

### 3. Plan Usage for Next Week
```tsx
<RenewableOutlookWidget />
// Shows best days for renewable energy
```

### 4. Build Custom Dashboard
```tsx
import { unifiedEnergyData } from '@/lib/services/unified-energy-data';

const snapshot = await unifiedEnergyData.getCurrentSnapshot();
// Use snapshot data for custom visualizations
```

---

## 🐛 Quick Troubleshooting

### Widgets not loading?
1. Check browser console for errors
2. Verify `/api/energy/*` routes are accessible
3. Test NESO API: `curl https://api.neso.energy/api/3/action/package_list`

### Empty data?
1. NESO datasets may be temporarily unavailable
2. Check specific dataset: `curl "https://api.neso.energy/api/3/action/package_show?id=embedded-wind-and-solar-forecasts"`
3. Data updates every 30min-1hr, retry later

### Slow performance?
1. Verify caching is working (2nd load should be instant)
2. Check network tab in browser dev tools
3. Clear cache if memory is high: `nesoClient.clearCache()`

---

## 📚 More Information

- **Full Documentation:** `NESO_IMPLEMENTATION_COMPLETE.md`
- **Data Sources:** `NESO_DATA_SOURCES.md`
- **NESO Portal:** https://www.neso.energy/data-portal

---

## ✅ Checklist

- [x] Dependencies installed (`papaparse`)
- [ ] Widgets added to dashboard page
- [ ] Tested in browser
- [ ] Verified all API endpoints work
- [ ] Checked mobile responsiveness
- [ ] Ready to deploy! 🚀

---

**That's it! You're ready to go. Happy coding! ⚡🌍**
