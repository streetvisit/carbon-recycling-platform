// components/ForecastChart.tsx - Line chart showing forecast data with baseline vs initiative impact

import { useEffect, useRef } from 'preact/hooks';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { EmissionForecast } from '../stores/plannerStore';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ForecastChartProps {
  forecasts: EmissionForecast[];
  title?: string;
}

export default function ForecastChart({ forecasts, title = 'Emissions Forecast' }: ForecastChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || forecasts.length === 0) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Separate baseline and initiative forecasts
    const baselineForecasts = forecasts
      .filter(f => f.isBaseline)
      .sort((a, b) => new Date(a.forecastDate).getTime() - new Date(b.forecastDate).getTime());
    
    const initiativeForecasts = forecasts
      .filter(f => !f.isBaseline)
      .sort((a, b) => new Date(a.forecastDate).getTime() - new Date(b.forecastDate).getTime());

    if (baselineForecasts.length === 0 && initiativeForecasts.length === 0) {
      return;
    }

    // Prepare data for Chart.js
    const labels = baselineForecasts.map(f => {
      const date = new Date(f.forecastDate);
      return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    });

    const baselineData = baselineForecasts.map(f => f.projectedCo2e);
    const initiativeData = initiativeForecasts.map(f => f.projectedCo2e);

    // Create chart
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Baseline (Business as Usual)',
            data: baselineData,
            borderColor: 'rgb(239, 68, 68)', // red-500
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointBackgroundColor: 'rgb(239, 68, 68)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          },
          {
            label: 'With Initiative',
            data: initiativeData,
            borderColor: 'rgb(34, 197, 94)', // green-500
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointBackgroundColor: 'rgb(34, 197, 94)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: false
          },
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} tCO₂e`;
              },
              afterBody: function(tooltipItems) {
                if (tooltipItems.length === 2) {
                  const baseline = tooltipItems.find(item => item.datasetIndex === 0);
                  const initiative = tooltipItems.find(item => item.datasetIndex === 1);
                  if (baseline && initiative) {
                    const reduction = baseline.parsed.y - initiative.parsed.y;
                    return reduction > 0 ? `Reduction: ${reduction.toFixed(2)} tCO₂e` : '';
                  }
                }
                return '';
              }
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'white',
            bodyColor: 'white',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Month',
              font: {
                weight: 'bold'
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              maxTicksLimit: 12,
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Projected Emissions (tCO₂e)',
              font: {
                weight: 'bold'
              }
            },
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              callback: function(value) {
                return typeof value === 'number' ? value.toFixed(1) + ' t' : value;
              }
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 6
          }
        }
      }
    });

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [forecasts]);

  // Calculate total projected reduction over the forecast period
  const calculateTotalReduction = () => {
    const baselineTotal = forecasts
      .filter(f => f.isBaseline)
      .reduce((sum, f) => sum + f.projectedCo2e, 0);
    
    const initiativeTotal = forecasts
      .filter(f => !f.isBaseline)
      .reduce((sum, f) => sum + f.projectedCo2e, 0);
    
    return baselineTotal - initiativeTotal;
  };

  const totalReduction = calculateTotalReduction();

  if (forecasts.length === 0) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div class="flex items-center justify-center h-64 bg-gray-50">
          <div class="text-center text-gray-500">
            <div class="text-4xl mb-2">📈</div>
            <div class="text-sm font-medium">No forecast data available</div>
            <div class="text-xs mt-1">Forecast will be generated when initiative is created</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
            <p class="text-sm text-gray-600 mt-1">
              Impact projection over 24 months
            </p>
          </div>
          {totalReduction > 0 && (
            <div class="text-right">
              <div class="text-2xl font-bold text-green-600">
                -{totalReduction.toFixed(1)} tCO₂e
              </div>
              <div class="text-xs text-gray-500">
                Total reduction over forecast period
              </div>
            </div>
          )}
        </div>
      </div>

      <div class="p-6">
        <div style={{ height: '400px', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center space-x-6">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span class="text-gray-600">Baseline trajectory shows emissions without intervention</span>
            </div>
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span class="text-gray-600">Initiative trajectory shows projected impact</span>
            </div>
          </div>
          <div class="text-gray-500">
            Hover over data points for details
          </div>
        </div>
      </div>
    </div>
  );
}