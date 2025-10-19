import { useEffect, useState } from 'preact/hooks';
import { useAnalyticsStore } from '../stores/analyticsStore';

interface IndustryBenchmarkingProps {
  industry?: string;
  metric?: string;
}

export default function IndustryBenchmarking({ 
  industry = 'general', 
  metric = 'carbon_intensity' 
}: IndustryBenchmarkingProps) {
  const {
    benchmarkData,
    benchmarkLoading,
    benchmarkError,
    fetchBenchmarkData
  } = useAnalyticsStore();

  const [selectedIndustry, setSelectedIndustry] = useState(industry);
  const [selectedMetric, setSelectedMetric] = useState(metric);

  useEffect(() => {
    fetchBenchmarkData(selectedIndustry, selectedMetric);
  }, [selectedIndustry, selectedMetric, fetchBenchmarkData]);

  const getPercentileColor = (percentile: number) => {
    if (percentile <= 25) return 'text-green-600 bg-green-100';
    if (percentile <= 50) return 'text-yellow-600 bg-yellow-100';
    if (percentile <= 75) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getPercentileMessage = (percentile: number) => {
    if (percentile <= 25) return 'Excellent - Top 25% performer';
    if (percentile <= 50) return 'Good - Above median performance';
    if (percentile <= 75) return 'Fair - Below median performance';
    return 'Poor - Bottom 25% performer';
  };

  if (benchmarkLoading) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="space-y-3">
            <div class="h-4 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (benchmarkError) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="text-center">
          <div class="text-red-500 mb-2">⚠️</div>
          <p class="text-red-600">{benchmarkError}</p>
          <button 
            onClick={() => fetchBenchmarkData(selectedIndustry, selectedMetric)}
            class="mt-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!benchmarkData) return null;

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Industry Benchmarking</h3>
          <p class="text-sm text-gray-600">Compare your performance against industry peers</p>
        </div>
        
        <div class="flex space-x-3">
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            class="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="general">General</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="services">Services</option>
          </select>
          
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            class="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="carbon_intensity">Carbon Intensity</option>
            <option value="total_emissions">Total Emissions</option>
          </select>
        </div>
      </div>

      {/* Performance Summary */}
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-4">
            <div class="text-2xl font-bold text-gray-900">
              {benchmarkData.userValue} {benchmarkData.benchmarks.unit}
            </div>
            <div class={`px-3 py-1 rounded-full text-sm font-medium ${getPercentileColor(benchmarkData.percentileRank)}`}>
              {benchmarkData.percentileRank}th percentile
            </div>
          </div>
        </div>
        
        <p class="text-sm text-gray-600 mb-4">
          {getPercentileMessage(benchmarkData.percentileRank)}
        </p>

        {/* Comparison Metrics */}
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-blue-50 rounded-lg p-4">
            <div class="text-sm text-blue-700 mb-1">vs Industry Median</div>
            <div class={`font-semibold ${
              benchmarkData.comparison.vsMedian < 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {benchmarkData.comparison.vsMedian > 0 ? '+' : ''}{benchmarkData.comparison.vsMedian.toFixed(2)} {benchmarkData.benchmarks.unit}
            </div>
            <div class="text-xs text-blue-600 mt-1">
              {benchmarkData.comparison.vsMedian < 0 ? 'Better' : 'Worse'} than median
            </div>
          </div>

          <div class="bg-green-50 rounded-lg p-4">
            <div class="text-sm text-green-700 mb-1">vs Top Quartile</div>
            <div class={`font-semibold ${
              benchmarkData.comparison.vsTopQuartile < 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {benchmarkData.comparison.vsTopQuartile > 0 ? '+' : ''}{benchmarkData.comparison.vsTopQuartile.toFixed(2)} {benchmarkData.benchmarks.unit}
            </div>
            <div class="text-xs text-green-600 mt-1">
              {benchmarkData.comparison.vsTopQuartile < 0 ? 'Better' : 'Gap to'} top performers
            </div>
          </div>
        </div>
      </div>

      {/* Percentile Distribution */}
      <div class="mb-6">
        <h4 class="text-sm font-medium text-gray-900 mb-3">Industry Distribution</h4>
        
        <div class="relative">
          {/* Distribution Bar */}
          <div class="flex h-8 rounded-lg overflow-hidden bg-gray-200">
            <div class="bg-green-400 flex-1"></div>
            <div class="bg-yellow-400 flex-1"></div>
            <div class="bg-orange-400 flex-1"></div>
            <div class="bg-red-400 flex-1"></div>
          </div>
          
          {/* User Position Indicator */}
          <div 
            class="absolute top-0 h-8 w-1 bg-blue-600 transform -translate-x-1/2"
            style={{ left: `${benchmarkData.percentileRank}%` }}
          >
            <div class="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div class="bg-blue-600 text-white text-xs px-2 py-1 rounded">You</div>
            </div>
          </div>
          
          {/* Percentile Labels */}
          <div class="flex justify-between text-xs text-gray-600 mt-2">
            <span>Top 25%</span>
            <span>Median</span>
            <span>75th</span>
            <span>Bottom</span>
          </div>
        </div>
      </div>

      {/* Benchmark Values Table */}
      <div class="overflow-hidden">
        <h4 class="text-sm font-medium text-gray-900 mb-3">Percentile Benchmarks</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">25th percentile (Top performers):</span>
            <span class="font-medium">{benchmarkData.benchmarks.percentile_25} {benchmarkData.benchmarks.unit}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">50th percentile (Median):</span>
            <span class="font-medium">{benchmarkData.benchmarks.percentile_50} {benchmarkData.benchmarks.unit}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">75th percentile:</span>
            <span class="font-medium">{benchmarkData.benchmarks.percentile_75} {benchmarkData.benchmarks.unit}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">90th percentile:</span>
            <span class="font-medium">{benchmarkData.benchmarks.percentile_90} {benchmarkData.benchmarks.unit}</span>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h5 class="text-sm font-medium text-gray-900 mb-2">💡 Recommendations</h5>
        <ul class="text-sm text-gray-600 space-y-1">
          {benchmarkData.percentileRank > 75 && (
            <>
              <li>• Focus on high-impact emission reduction initiatives</li>
              <li>• Benchmark against top quartile performers in your sector</li>
              <li>• Consider energy efficiency upgrades and renewable energy adoption</li>
            </>
          )}
          {benchmarkData.percentileRank <= 75 && benchmarkData.percentileRank > 50 && (
            <>
              <li>• Target specific categories with highest emissions</li>
              <li>• Implement systematic monitoring and reporting</li>
              <li>• Set science-based targets aligned with industry leaders</li>
            </>
          )}
          {benchmarkData.percentileRank <= 50 && benchmarkData.percentileRank > 25 && (
            <>
              <li>• Maintain current performance while identifying optimization opportunities</li>
              <li>• Share best practices with industry peers</li>
              <li>• Consider more ambitious reduction targets</li>
            </>
          )}
          {benchmarkData.percentileRank <= 25 && (
            <>
              <li>• Excellent performance - consider industry leadership opportunities</li>
              <li>• Share success stories and best practices</li>
              <li>• Explore emerging technologies for further improvements</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}