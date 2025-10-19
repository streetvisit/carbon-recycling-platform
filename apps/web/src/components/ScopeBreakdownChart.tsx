import { useEffect, useRef } from 'preact/hooks';

interface ScopeData {
  scope_1: number;
  scope_2: number;
  scope_3: number;
}

interface ScopeBreakdownChartProps {
  data: ScopeData;
  title?: string;
}

export default function ScopeBreakdownChart({ 
  data, 
  title = "Emissions by GHG Scope" 
}: ScopeBreakdownChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

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

      const totalEmissions = data.scope_1 + data.scope_2 + data.scope_3;
      
      // If no data, show empty state
      if (totalEmissions === 0) {
        chartRef.current = new Chart.default(ctx, {
          type: 'doughnut',
          data: {
            labels: ['No Data'],
            datasets: [{
              data: [1],
              backgroundColor: ['#F3F4F6'],
              borderWidth: 0,
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
            cutout: '70%',
          }
        });
        return;
      }

      // Create the chart with actual data
      chartRef.current = new Chart.default(ctx, {
        type: 'doughnut',
        data: {
          labels: [
            'Scope 1 (Direct Emissions)',
            'Scope 2 (Electricity)',
            'Scope 3 (Indirect)'
          ],
          datasets: [{
            data: [data.scope_1, data.scope_2, data.scope_3],
            backgroundColor: [
              '#EF4444', // Red for Scope 1
              '#F97316', // Orange for Scope 2
              '#8B5CF6', // Purple for Scope 3
            ],
            borderColor: [
              '#DC2626',
              '#EA580C',
              '#7C3AED',
            ],
            borderWidth: 2,
            hoverOffset: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                font: {
                  size: 12,
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: 'white',
              bodyColor: 'white',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              callbacks: {
                label: function(context: any) {
                  const value = context.parsed;
                  const percentage = ((value / totalEmissions) * 100).toFixed(1);
                  return `${context.label}: ${value.toFixed(2)} tCO₂e (${percentage}%)`;
                }
              }
            }
          },
          cutout: '60%',
          animation: {
            animateRotate: true,
            duration: 1000,
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
  }, [data]);

  const totalEmissions = data.scope_1 + data.scope_2 + data.scope_3;

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
        <div class="text-sm text-gray-500">
          Total: {totalEmissions.toFixed(2)} tCO₂e
        </div>
      </div>

      <div class="relative h-64 mb-4">
        <canvas ref={canvasRef}></canvas>
        
        {/* Center text for total emissions */}
        {totalEmissions > 0 && (
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <div class="text-2xl font-bold text-gray-900">
                {totalEmissions.toFixed(2)}
              </div>
              <div class="text-sm text-gray-500">
                tCO₂e
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalEmissions === 0 && (
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center text-gray-500">
              <div class="text-4xl mb-2">📊</div>
              <div class="text-sm">
                No emissions data
              </div>
              <div class="text-xs mt-1">
                Calculate emissions to see breakdown
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scope breakdown details */}
      {totalEmissions > 0 && (
        <div class="grid grid-cols-3 gap-4 text-center border-t pt-4">
          <div class="space-y-1">
            <div class="flex items-center justify-center">
              <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span class="text-xs font-medium text-gray-600">SCOPE 1</span>
            </div>
            <div class="text-lg font-semibold text-gray-900">
              {data.scope_1.toFixed(2)}
            </div>
            <div class="text-xs text-gray-500">
              {totalEmissions > 0 ? ((data.scope_1 / totalEmissions) * 100).toFixed(1) : '0'}%
            </div>
          </div>
          
          <div class="space-y-1">
            <div class="flex items-center justify-center">
              <div class="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
              <span class="text-xs font-medium text-gray-600">SCOPE 2</span>
            </div>
            <div class="text-lg font-semibold text-gray-900">
              {data.scope_2.toFixed(2)}
            </div>
            <div class="text-xs text-gray-500">
              {totalEmissions > 0 ? ((data.scope_2 / totalEmissions) * 100).toFixed(1) : '0'}%
            </div>
          </div>
          
          <div class="space-y-1">
            <div class="flex items-center justify-center">
              <div class="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
              <span class="text-xs font-medium text-gray-600">SCOPE 3</span>
            </div>
            <div class="text-lg font-semibold text-gray-900">
              {data.scope_3.toFixed(2)}
            </div>
            <div class="text-xs text-gray-500">
              {totalEmissions > 0 ? ((data.scope_3 / totalEmissions) * 100).toFixed(1) : '0'}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}