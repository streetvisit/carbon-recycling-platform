import { useEffect, useRef } from 'preact/hooks';
import { useAnalyticsStore } from '../stores/analyticsStore';

export default function EmissionHeatmap() {
  const chartRef = useRef<HTMLDivElement>(null);
  const echartInstance = useRef<any>(null);
  const { breakdownData, breakdownLoading, breakdownError } = useAnalyticsStore();

  useEffect(() => {
    if (!chartRef.current) return;

    // Import ECharts dynamically to avoid SSR issues
    import('echarts').then((echarts) => {
      // Initialize chart
      if (!echartInstance.current) {
        echartInstance.current = echarts.init(chartRef.current);
      }

      // If no data, show empty state
      if (breakdownData.length === 0 && !breakdownLoading) {
        echartInstance.current.setOption({
          title: {
            text: 'No Data Available',
            left: 'center',
            top: 'center',
            textStyle: {
              color: '#9CA3AF',
              fontSize: 18
            }
          },
          backgroundColor: '#F9FAFB'
        });
        return;
      }

      // Prepare data for treemap
      const treemapData = breakdownData.map((item, index) => {
        // Calculate intensity color based on percentage
        const intensity = Math.min(item.percentage / 50, 1); // Normalize to 0-1 scale, cap at 50%
        
        // Get scope-based colors
        let baseColor;
        switch (item.scope) {
          case 'scope_1':
            baseColor = [239, 68, 68]; // Red
            break;
          case 'scope_2':
            baseColor = [249, 115, 22]; // Orange
            break;
          case 'scope_3':
            baseColor = [139, 92, 246]; // Purple
            break;
          default:
            baseColor = [107, 114, 128]; // Gray
        }

        // Calculate alpha based on intensity
        const alpha = 0.3 + (intensity * 0.7); // Range from 0.3 to 1.0

        return {
          name: item.category,
          value: item.totalCo2e,
          scope: item.scope,
          percentage: item.percentage,
          itemStyle: {
            color: `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`
          }
        };
      });

      const option = {
        backgroundColor: '#ffffff',
        title: {
          text: 'Emissions Heatmap',
          left: 'center',
          top: 20,
          textStyle: {
            color: '#1F2937',
            fontSize: 16,
            fontWeight: 600
          }
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          textStyle: {
            color: '#ffffff'
          },
          formatter: function (params: any) {
            const data = params.data;
            const scopeIcons = {
              'scope_1': '🔥',
              'scope_2': '⚡',
              'scope_3': '🚛'
            };
            
            return `
              <div style="padding: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">
                  ${scopeIcons[data.scope as keyof typeof scopeIcons] || '📊'} ${data.name}
                </div>
                <div style="font-size: 12px; color: #E5E7EB; margin-bottom: 2px;">
                  ${data.scope.replace('_', ' ').toUpperCase()}
                </div>
                <div style="font-size: 14px; font-weight: bold;">
                  ${data.value.toFixed(2)} tCO₂e
                </div>
                <div style="font-size: 12px; color: #E5E7EB;">
                  ${data.percentage.toFixed(1)}% of total
                </div>
              </div>
            `;
          }
        },
        series: [{
          name: 'Emissions',
          type: 'treemap',
          top: 60,
          bottom: 20,
          left: 20,
          right: 20,
          visibleMin: 10,
          label: {
            show: true,
            formatter: function (params: any) {
              const data = params.data;
              if (data.value < 0.1) return ''; // Hide labels for very small values
              
              return `{title|${data.name}}\n{value|${data.value.toFixed(2)} tCO₂e}\n{percent|${data.percentage.toFixed(1)}%}`;
            },
            rich: {
              title: {
                fontSize: 12,
                fontWeight: 'bold',
                color: '#1F2937',
                lineHeight: 16
              },
              value: {
                fontSize: 11,
                color: '#374151',
                lineHeight: 14
              },
              percent: {
                fontSize: 10,
                color: '#6B7280',
                lineHeight: 12
              }
            }
          },
          upperLabel: {
            show: false
          },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
            gapWidth: 2
          },
          emphasis: {
            label: {
              show: true
            },
            itemStyle: {
              borderColor: '#22C55E',
              borderWidth: 3,
              shadowBlur: 10,
              shadowColor: 'rgba(34, 197, 94, 0.3)'
            }
          },
          breadcrumb: {
            show: false
          },
          roam: false,
          data: treemapData
        }]
      };

      echartInstance.current.setOption(option, true);

      // Handle window resize
      const handleResize = () => {
        if (echartInstance.current) {
          echartInstance.current.resize();
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    });

    // Cleanup function
    return () => {
      if (echartInstance.current) {
        echartInstance.current.dispose();
        echartInstance.current = null;
      }
    };
  }, [breakdownData, breakdownLoading]);

  const getLegendData = () => {
    const scopes = ['scope_1', 'scope_2', 'scope_3'];
    return scopes.map(scope => {
      const scopeData = breakdownData.filter(item => item.scope === scope);
      const total = scopeData.reduce((sum, item) => sum + item.totalCo2e, 0);
      
      const icons = {
        'scope_1': '🔥',
        'scope_2': '⚡', 
        'scope_3': '🚛'
      };

      const colors = {
        'scope_1': 'bg-red-100 text-red-800',
        'scope_2': 'bg-orange-100 text-orange-800',
        'scope_3': 'bg-purple-100 text-purple-800'
      };

      return {
        scope,
        icon: icons[scope as keyof typeof icons],
        color: colors[scope as keyof typeof colors],
        total,
        count: scopeData.length,
        label: scope.replace('_', ' ').toUpperCase()
      };
    }).filter(item => item.count > 0);
  };

  const legendData = getLegendData();

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Emissions Heatmap</h3>
          <p class="text-sm text-gray-600 mt-1">
            Visual representation of emission hotspots by category size and intensity
          </p>
        </div>
      </div>

      <div class="relative" style={{ height: '400px' }}>
        {breakdownLoading ? (
          <div class="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <div class="text-sm text-gray-600">Loading heatmap...</div>
            </div>
          </div>
        ) : breakdownError ? (
          <div class="absolute inset-0 flex items-center justify-center bg-red-50 rounded">
            <div class="text-center text-red-600">
              <div class="text-2xl mb-2">⚠️</div>
              <div class="text-sm font-medium">Error loading heatmap</div>
              <div class="text-xs mt-1">{breakdownError}</div>
            </div>
          </div>
        ) : breakdownData.length === 0 ? (
          <div class="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">🔥</div>
              <div class="text-sm font-medium">No heatmap data available</div>
              <div class="text-xs mt-1">Calculate emissions to see hotspots</div>
            </div>
          </div>
        ) : (
          <div ref={chartRef} style={{ width: '100%', height: '100%' }}></div>
        )}
      </div>

      {/* Legend */}
      {legendData.length > 0 && (
        <div class="mt-6 pt-4 border-t border-gray-200">
          <div class="flex flex-wrap items-center justify-center gap-4">
            <div class="text-xs font-medium text-gray-500 mb-2 w-full text-center">
              Scope Legend
            </div>
            {legendData.map(item => (
              <div key={item.scope} class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${item.color}`}>
                <span class="mr-1">{item.icon}</span>
                <span>{item.label}</span>
                <span class="ml-1 text-xs opacity-75">
                  ({item.total.toFixed(1)} tCO₂e)
                </span>
              </div>
            ))}
          </div>
          <div class="text-center text-xs text-gray-500 mt-2">
            Rectangle size represents emission amount • Color intensity represents percentage of total
          </div>
        </div>
      )}
    </div>
  );
}