'use client';

import { useEffect, useState } from 'preact/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';

interface FlexibilityAlert {
  active: boolean;
  message: string;
  startTime?: Date;
  endTime?: Date;
  incentive?: string;
  targetReduction?: number;
}

export function FlexibilityAlertsWidget() {
  const [alerts, setAlerts] = useState<FlexibilityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2 * 60 * 1000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  async function fetchAlerts() {
    try {
      const response = await fetch('/api/energy/flexibility-alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      
      const result = await response.json();
      if (result.success) {
        setAlerts(result.data.map((a: any) => ({
          ...a,
          startTime: a.startTime ? new Date(a.startTime) : undefined,
          endTime: a.endTime ? new Date(a.endTime) : undefined,
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
          <CardTitle>Grid Flexibility Alerts</CardTitle>
          <CardDescription>Loading alerts...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Grid Flexibility Alerts</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const activeAlerts = alerts.filter(a => a.active);
  const upcomingAlerts = alerts.filter(a => !a.active);
  const hasActiveAlerts = activeAlerts.length > 0;

  return (
    <Card className={hasActiveAlerts ? 'border-2 border-orange-500 shadow-lg' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className={`text-xl ${hasActiveAlerts ? 'text-orange-500 animate-pulse' : ''}`}>🔔</span>
            Grid Flexibility Alerts
          </CardTitle>
          {hasActiveAlerts && (
            <Badge className="bg-orange-500 text-white animate-pulse">
              {activeAlerts.length} ACTIVE
            </Badge>
          )}
        </div>
        <CardDescription>
          Help balance the grid and earn rewards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-5xl mx-auto mb-2">✅</div>
            <p className="text-sm font-medium">No flexibility events at this time</p>
            <p className="text-xs mt-1">The grid is running smoothly!</p>
          </div>
        ) : (
          <>
            {/* Active Alerts */}
            {activeAlerts.map((alert, index) => (
              <div
                key={`active-${index}`}
                className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 animate-pulse-slow"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-orange-900">
                        ⚡ ACTIVE NOW
                      </span>
                      {alert.incentive && (
                        <Badge variant="secondary" className="text-xs">
                          {alert.incentive}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-orange-800 mb-2">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-orange-700">
                      {alert.endTime && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs">⏰</span>
                          Ends: {alert.endTime.toLocaleTimeString('en-GB', {
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      )}
                      {alert.targetReduction && (
                        <span>Target: {alert.targetReduction} MW</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Upcoming Alerts */}
            {upcomingAlerts.map((alert, index) => (
              <div
                key={`upcoming-${index}`}
                className="p-4 rounded-lg bg-blue-50 border border-blue-200"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">🔔</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-blue-900">
                        Upcoming Event
                      </span>
                      {alert.incentive && (
                        <Badge variant="secondary" className="text-xs">
                          {alert.incentive}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-blue-800 mb-2">
                      {alert.message}
                    </p>
                    {(alert.startTime || alert.endTime) && (
                      <div className="flex items-center gap-4 text-xs text-blue-700">
                        {alert.startTime && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs">⏰</span>
                            {alert.startTime.toLocaleTimeString('en-GB', {
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                            {alert.endTime && ` - ${alert.endTime.toLocaleTimeString('en-GB', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Info Box */}
        <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-gray-600">
            💡 <strong>What is this?</strong> During peak demand or low renewable generation, 
            the National Grid may request households to reduce usage temporarily. 
            Participants can earn rewards!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
