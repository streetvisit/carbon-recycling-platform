import { useState, useEffect } from 'preact/hooks';

interface EmissionsSummaryCardProps {
  title: string;
  value: number;
  unit: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: string;
}

export default function EmissionsSummaryCard({ 
  title, 
  value, 
  unit, 
  trend, 
  icon = "🌱" 
}: EmissionsSummaryCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [animatedValue, setAnimatedValue] = useState(0);

  // Simple number animation effect
  useEffect(() => {
    setIsLoading(false);
    
    if (value === 0) {
      setAnimatedValue(0);
      return;
    }

    const duration = 1000; // 1 second
    const steps = 50;
    const stepValue = value / steps;
    const stepTime = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      setAnimatedValue(stepValue * currentStep);
      
      if (currentStep >= steps) {
        setAnimatedValue(value);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  const formatValue = (val: number): string => {
    if (val === 0) return '0.00';
    if (val < 0.01) return '<0.01';
    return val.toFixed(2);
  };

  const getValueColor = (): string => {
    if (value === 0) return 'text-gray-600';
    if (value < 1) return 'text-green-600';
    if (value < 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <div class="flex items-center mb-2">
            <span class="text-2xl mr-2">{icon}</span>
            <h3 class="text-sm font-medium text-gray-600 uppercase tracking-wide">
              {title}
            </h3>
          </div>
          
          <div class="flex items-baseline space-x-2">
            <div class={`text-3xl font-bold ${getValueColor()}`}>
              {isLoading ? (
                <div class="animate-pulse bg-gray-200 h-9 w-16 rounded"></div>
              ) : (
                formatValue(animatedValue)
              )}
            </div>
            <span class="text-sm text-gray-500 font-medium">
              {unit}
            </span>
          </div>

          {trend && (
            <div class="mt-2 flex items-center text-xs">
              <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                trend.isPositive 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                <svg 
                  class={`-ml-0.5 mr-1.5 h-2 w-2 ${
                    trend.isPositive ? 'rotate-0' : 'rotate-180'
                  }`} 
                  fill="currentColor" 
                  viewBox="0 0 8 8"
                >
                  <path d="M4 0l4 4H0z"/>
                </svg>
                {Math.abs(trend.value)}% from last period
              </span>
            </div>
          )}
        </div>
      </div>
      
      {value === 0 && (
        <div class="mt-4 text-xs text-gray-500">
          No emissions calculated yet. Add activity data and trigger calculations.
        </div>
      )}
    </div>
  );
}