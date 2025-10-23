import { useEffect, useRef } from 'preact/hooks';
import { useAnalyticsStore } from '../stores/analyticsStore';

export default function EmissionsTrendChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const { timeseriesData, timeseriesLoading, timeseriesError, filters } = useAnalyticsStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Import Chart.js dynamically to avoid SSR issues
    import('chart.js/auto').then((Chart) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      // Destroy existing chart
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      // If no data, show empty state
      if (timeseriesData.length === 0 && !timeseriesLoading) {
        chartRef.current = new Chart.default(ctx, {
          type: 'line',
          data: {
            labels: ['No Data'],
            datasets: [{
              label: 'No data available',
              data: [0],
              backgroundColor: '#F3F4F6',
              borderColor: '#D1D5DB',
              borderWidth: 1,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                enabled: false,
              }
            },
            scales: {
              y: {
                display: false,
              },
              x: {
                display: false,
              }
            }
          }
        });
        return;
      }

      // Prepare data for Chart.js
      const labels = timeseriesData.map(point => {
        const date = new Date(point.date);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short',
          ...(filters.groupBy === 'quarter' ? {} : { day: 'numeric' })
        });
      });

      const dataValues = timeseriesData.map(point => point.totalCo2e);
      const maxValue = Math.max(...dataValues);

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0.02)');

      // Create the chart with actual data
      chartRef.current = new Chart.default(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Emissions (tCO₂e)',
            data: dataValues,
            backgroundColor: gradient,
            borderColor: '#22C55E',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#22C55E',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#16A34A',
            pointHoverBorderColor: '#FFFFFF',
            pointHoverBorderWidth: 3,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20,
                font: {
                  size: 12,
                  weight: 500
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#FFFFFF',
              bodyColor: '#FFFFFF',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                title: function(context: any) {
                  return context[0].label;
                },
                label: function(context: any) {
                  const value = context.parsed.y;
                  return `${value.toFixed(2)} tCO₂e`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#F3F4F6',
                drawOnChartArea: true,
              },
              border: {
                display: false,
              },
              ticks: {
                color: '#6B7280',
                font: {
                  size: 11
                },
                callback: function(value: any) {
                  return `${value} tCO₂e`;
                }
              },
              title: {
                display: true,
                text: 'Emissions (tCO₂e)',
                color: '#374151',
                font: {
                  size: 12,
                  weight: 600
                }
              }
            },
            x: {
              grid: {
                display: false,
                drawOnChartArea: false,
              },
              border: {
                display: false,
              },
              ticks: {
                color: '#6B7280',
                font: {
                  size: 11
                },
                maxRotation: 45,
                minRotation: 0
              },
              title: {
                display: true,
                text: filters.groupBy === 'quarter' ? 'Quarter' : 'Month',
                color: '#374151',
                font: {
                  size: 12,
                  weight: 600
                }
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index',
          },
          animation: {
            duration: 750,
            easing: 'easeInOutCubic'
          }
        }
      });
    });

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [timeseriesData, filters, timeseriesLoading]);

  const getSummaryStats = () => {
    if (timeseriesData.length === 0) return null;
    
    const values = timeseriesData.map(d => d.totalCo2e);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    return { total, average, max, min };
  };

  const stats = getSummaryStats();

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Emissions Trend</h3>
          <p class="text-sm text-gray-600">
            {filters.groupBy === 'quarter' ? 'Quarterly' : 'Monthly'} emissions over time
          </p>
        </div>
        
        {stats && (
          <div class="text-right">
            <div class="text-2xl font-bold text-gray-900">{stats.total.toFixed(2)}</div>
            <div class="text-xs text-gray-500">Total tCO₂e</div>
          </div>
        )}
      </div>

      <div class="relative" style={{ height: '300px' }}>
        {timeseriesLoading ? (
          <div class="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <div class="text-sm text-gray-600">Loading trend data...</div>
            </div>
          </div>
        ) : timeseriesError ? (
          <div class="absolute inset-0 flex items-center justify-center bg-red-50 rounded">
            <div class="text-center text-red-600">
              <div class="text-2xl mb-2">⚠️</div>
              <div class="text-sm">Error loading trend data</div>
              <div class="text-xs mt-1">{timeseriesError}</div>
            </div>
          </div>
        ) : timeseriesData.length === 0 ? (
          <div class="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">📈</div>
              <div class="text-sm font-medium">No trend data available</div>
              <div class="text-xs mt-1">Calculate emissions to see trends</div>
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef}></canvas>
        )}
      </div>

      {/* Statistics */}
      {stats && (
        <div class="mt-6 pt-4 border-t border-gray-200">
          <div class="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div class="text-lg font-semibold text-gray-900">{stats.average.toFixed(2)}</div>
              <div class="text-gray-500">Average</div>
            </div>
            <div>
              <div class="text-lg font-semibold text-red-600">{stats.max.toFixed(2)}</div>
              <div class="text-gray-500">Peak</div>
            </div>
            <div>
              <div class="text-lg font-semibold text-green-600">{stats.min.toFixed(2)}</div>
              <div class="text-gray-500">Lowest</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}