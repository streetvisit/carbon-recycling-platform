import { useEffect, useState } from 'preact/hooks';
import { useAnalyticsStore } from '../stores/analyticsStore';

export default function RealTimeMonitoring() {
  const {
    realTimeData,
    realTimeLoading,
    realTimeError,
    realTimeAutoRefresh,
    alertsData,
    startRealTimeUpdates,
    stopRealTimeUpdates,
    fetchAlerts
  } = useAnalyticsStore();

  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Start real-time updates when component mounts
    startRealTimeUpdates();
    fetchAlerts();

    return () => {
      // Stop real-time updates when component unmounts
      stopRealTimeUpdates();
    };
  }, [startRealTimeUpdates, stopRealTimeUpdates, fetchAlerts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return '✅';
      case 'normal': return '🔵';
      case 'warning': return '⚠️';
      case 'critical': return '🚨';
      default: return '⚪';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '📈';
    if (trend < 0) return '📉';
    return '➡️';
  };

  const formatLastUpdated = (timestamp: string) => {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now.getTime() - updated.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ago`;
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'border-l-blue-500 bg-blue-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'high': return 'border-l-red-500 bg-red-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  if (!isVisible) {
    return (
      <div class="fixed bottom-4 right-4">
        <button
          onClick={() => setIsVisible(true)}
          class="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
        >
          📊 Show Monitoring
        </button>
      </div>
    );
  }

  return (
    <div class="fixed bottom-4 right-4 w-96 max-h-96 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
        <div class="flex items-center space-x-2">
          <div class={`w-2 h-2 rounded-full ${realTimeAutoRefresh ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <h3 class="text-sm font-semibold text-gray-900">Real-time Monitoring</h3>
        </div>
        
        <div class="flex items-center space-x-2">
          <button
            onClick={() => {
              if (realTimeAutoRefresh) {
                stopRealTimeUpdates();
              } else {
                startRealTimeUpdates();
              }
            }}
            class={`text-xs px-2 py-1 rounded ${
              realTimeAutoRefresh 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {realTimeAutoRefresh ? 'Live' : 'Paused'}
          </button>
          
          <button
            onClick={() => setIsVisible(false)}
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="overflow-y-auto max-h-80">
        {/* Real-time Metrics */}
        {realTimeData && (
          <div class="p-4 border-b border-gray-200">
            <div class="grid grid-cols-1 gap-3">
              {realTimeData.metrics.emissions && (
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">💨</span>
                    <div>
                      <div class="text-sm font-medium text-gray-900">Emissions</div>
                      <div class="text-xs text-gray-500">
                        Updated {formatLastUpdated(realTimeData.metrics.emissions.lastUpdated)}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center space-x-1">
                      <span class="text-sm font-bold text-gray-900">
                        {realTimeData.metrics.emissions.current} {realTimeData.metrics.emissions.unit}
                      </span>
                      <span class={`px-2 py-1 rounded-full text-xs ${getStatusColor(realTimeData.metrics.emissions.status)}`}>
                        {getStatusIcon(realTimeData.metrics.emissions.status)}
                      </span>
                    </div>
                    <div class="flex items-center space-x-1 text-xs">
                      <span>{getTrendIcon(realTimeData.metrics.emissions.trend)}</span>
                      <span class={realTimeData.metrics.emissions.trend > 0 ? 'text-red-600' : 'text-green-600'}>
                        {realTimeData.metrics.emissions.trend > 0 ? '+' : ''}{realTimeData.metrics.emissions.trend}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {realTimeData.metrics.energy && (
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">⚡</span>
                    <div>
                      <div class="text-sm font-medium text-gray-900">Energy Usage</div>
                      <div class="text-xs text-gray-500">
                        Updated {formatLastUpdated(realTimeData.metrics.energy.lastUpdated)}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center space-x-1">
                      <span class="text-sm font-bold text-gray-900">
                        {realTimeData.metrics.energy.current} {realTimeData.metrics.energy.unit}
                      </span>
                      <span class={`px-2 py-1 rounded-full text-xs ${getStatusColor(realTimeData.metrics.energy.status)}`}>
                        {getStatusIcon(realTimeData.metrics.energy.status)}
                      </span>
                    </div>
                    <div class="flex items-center space-x-1 text-xs">
                      <span>{getTrendIcon(realTimeData.metrics.energy.trend)}</span>
                      <span class={realTimeData.metrics.energy.trend > 0 ? 'text-red-600' : 'text-green-600'}>
                        {realTimeData.metrics.energy.trend > 0 ? '+' : ''}{realTimeData.metrics.energy.trend}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {realTimeData.metrics.intensity && (
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">📊</span>
                    <div>
                      <div class="text-sm font-medium text-gray-900">Carbon Intensity</div>
                      <div class="text-xs text-gray-500">
                        Updated {formatLastUpdated(realTimeData.metrics.intensity.lastUpdated)}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center space-x-1">
                      <span class="text-sm font-bold text-gray-900">
                        {realTimeData.metrics.intensity.current} {realTimeData.metrics.intensity.unit}
                      </span>
                      <span class={`px-2 py-1 rounded-full text-xs ${getStatusColor(realTimeData.metrics.intensity.status)}`}>
                        {getStatusIcon(realTimeData.metrics.intensity.status)}
                      </span>
                    </div>
                    <div class="flex items-center space-x-1 text-xs">
                      <span>{getTrendIcon(realTimeData.metrics.intensity.trend)}</span>
                      <span class={realTimeData.metrics.intensity.trend > 0 ? 'text-red-600' : 'text-green-600'}>
                        {realTimeData.metrics.intensity.trend > 0 ? '+' : ''}{realTimeData.metrics.intensity.trend}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {alertsData && alertsData.length > 0 && (
          <div class="p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-medium text-gray-900">Active Alerts</h4>
              <span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                {alertsData.length}
              </span>
            </div>
            
            <div class="space-y-2 max-h-40 overflow-y-auto">
              {alertsData.slice(0, 3).map((alert) => (
                <div key={alert.id} class={`p-3 border-l-4 rounded ${getAlertSeverityColor(alert.severity)}`}>
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="text-xs font-medium text-gray-900 mb-1">
                        {alert.title}
                      </div>
                      <div class="text-xs text-gray-600 mb-2">
                        {alert.message}
                      </div>
                      <div class="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatLastUpdated(alert.timestamp)}</span>
                        <span class="capitalize">{alert.severity}</span>
                      </div>
                    </div>
                    <button class="text-gray-400 hover:text-gray-600 ml-2">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              
              {alertsData.length > 3 && (
                <div class="text-center py-2">
                  <button class="text-xs text-blue-600 hover:text-blue-700">
                    View {alertsData.length - 3} more alerts
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {realTimeLoading && (
          <div class="p-4 text-center">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <div class="text-xs text-gray-500 mt-2">Loading real-time data...</div>
          </div>
        )}

        {/* Error State */}
        {realTimeError && (
          <div class="p-4 bg-red-50 border-t border-red-200">
            <div class="flex items-center space-x-2">
              <span class="text-red-500">⚠️</span>
              <div class="text-xs text-red-600">{realTimeError}</div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!realTimeData && !realTimeLoading && !realTimeError && (
          <div class="p-4 text-center text-gray-500">
            <div class="text-xs">No real-time data available</div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div class="p-3 bg-gray-50 border-t border-gray-200">
        <div class="flex justify-between items-center">
          <button
            onClick={() => window.location.href = '/dashboard/analytics'}
            class="text-xs text-blue-600 hover:text-blue-700"
          >
            View Full Dashboard →
          </button>
          
          <div class="flex items-center space-x-2">
            <button
              onClick={() => {
                startRealTimeUpdates();
                fetchAlerts();
              }}
              class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}