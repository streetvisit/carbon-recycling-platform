'use client';

import { useEffect, useState } from 'preact/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';

interface OutlookDay {
  date: Date;
  avgWind: number;
  avgSolar: number;
  total: number;
}

export function RenewableOutlookWidget() {
  const [outlook, setOutlook] = useState<OutlookDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOutlook();
    const interval = setInterval(fetchOutlook, 60 * 60 * 1000); // Refresh hourly
    return () => clearInterval(interval);
  }, []);

  async function fetchOutlook() {
    try {
      const response = await fetch('/api/energy/renewable-outlook');
      if (!response.ok) throw new Error('Failed to fetch outlook');
      
      const result = await response.json();
      if (result.success) {
        setOutlook(result.data.map((d: any) => ({
          ...d,
          date: new Date(d.date),
        })));
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>14-Day Renewable Outlook</CardTitle>
          <CardDescription>Loading forecast...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>14-Day Renewable Outlook</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const maxTotal = Math.max(...outlook.map(d => d.total));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">🌬️</span>
          14-Day Renewable Outlook
        </CardTitle>
        <CardDescription>Wind and solar generation forecast</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart */}
        <div className="space-y-2">
          <div className="flex gap-1">
            {outlook.slice(0, 14).map((day, index) => {
              const windHeight = (day.avgWind / maxTotal) * 120;
              const solarHeight = (day.avgSolar / maxTotal) * 120;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Bars */}
                  <div className="w-full flex flex-col items-center">
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                      style={{ height: `${windHeight}px` }}
                    />
                    <div
                      className="w-full bg-yellow-400 rounded-b transition-all hover:bg-yellow-500"
                      style={{ height: `${solarHeight}px` }}
                    />
                  </div>
                  
                  {/* Day label */}
                  <span className="text-[10px] text-gray-500 font-medium">
                    {day.date.toLocaleDateString('en-GB', { day: 'numeric' })}
                  </span>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap shadow-lg">
                      <div className="font-semibold mb-1">
                        {day.date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-1 text-blue-300">
                        <span className="text-xs">🌬️</span>
                        {day.avgWind.toFixed(0)} MW
                      </div>
                      <div className="flex items-center gap-1 text-yellow-300">
                        <span className="text-xs">☀️</span>
                        {day.avgSolar.toFixed(0)} MW
                      </div>
                      <div className="mt-1 pt-1 border-t border-gray-700 font-semibold">
                        Total: {day.total.toFixed(0)} MW
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Today</span>
            <span>+14 days</span>
          </div>
        </div>

        {/* Legend & Summary */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-sm">🌬️</span>
              </div>
              <span className="text-sm text-gray-700">Wind</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                <span className="text-sm">☀️</span>
              </div>
              <span className="text-sm text-gray-700">Solar</span>
            </div>
          </div>
          
          {outlook.length > 0 && (
            <div className="text-sm text-gray-600">
              Avg: {(outlook.reduce((sum, d) => sum + d.total, 0) / outlook.length).toFixed(0)} MW/day
            </div>
          )}
        </div>

        {/* Best Days Alert */}
        {outlook.length > 0 && (() => {
          const sortedDays = [...outlook].sort((a, b) => b.total - a.total);
          const bestDay = sortedDays[0];
          
          return (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-green-800">
                  🌟 Best Day: {bestDay.date.toLocaleDateString('en-GB', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <p className="text-xs text-green-700">
                Peak renewable generation expected: {bestDay.total.toFixed(0)} MW
              </p>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
