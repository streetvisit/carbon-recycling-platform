import { useEffect, useState } from 'preact/hooks';
import { useAnalyticsStore } from '../stores/analyticsStore';

export default function PredictiveAnalytics() {
  const {
    predictionsData,
    predictionsLoading,
    predictionsError,
    timeseriesData,
    fetchPredictions
  } = useAnalyticsStore();

  const [selectedMonths, setSelectedMonths] = useState(6);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('linear_trend');

  useEffect(() => {
    fetchPredictions(selectedMonths, selectedAlgorithm);
  }, [selectedMonths, selectedAlgorithm, fetchPredictions]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateTotalPredictedEmissions = () => {
    return predictionsData.reduce((sum, pred) => sum + pred.predictedCo2e, 0);
  };

  const calculateAverageConfidence = () => {
    if (predictionsData.length === 0) return 0;
    const total = predictionsData.reduce((sum, pred) => sum + pred.confidence, 0);
    return total / predictionsData.length;
  };

  const getHistoricalAverage = () => {
    if (timeseriesData.length === 0) return 0;
    const total = timeseriesData.reduce((sum, point) => sum + point.totalCo2e, 0);
    return total / timeseriesData.length;
  };

  const getTrendDirection = () => {
    if (predictionsData.length < 2) return 'stable';
    const first = predictionsData[0].predictedCo2e;
    const last = predictionsData[predictionsData.length - 1].predictedCo2e;
    
    if (last > first * 1.05) return 'increasing';
    if (last < first * 0.95) return 'decreasing';
    return 'stable';
  };

  const getTrendIcon = () => {
    const direction = getTrendDirection();
    switch (direction) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = () => {
    const direction = getTrendDirection();
    switch (direction) {
      case 'increasing': return 'text-red-600';
      case 'decreasing': return 'text-green-600';
      default: return 'text-blue-600';
    }
  };

  if (predictionsLoading) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="h-32 bg-gray-200 rounded mb-4"></div>
          <div class="space-y-2">
            <div class="h-4 bg-gray-200 rounded w-full"></div>
            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (predictionsError) {
    return (
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="text-center">
          <div class="text-red-500 mb-2">⚠️</div>
          <p class="text-red-600 mb-4">{predictionsError}</p>
          <button 
            onClick={() => fetchPredictions(selectedMonths, selectedAlgorithm)}
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry Predictions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            🔮 Predictive Analytics
          </h3>
          <p class="text-sm text-gray-600">
            AI-powered emissions forecasting based on historical patterns
          </p>
        </div>
        
        <div class="flex space-x-3">
          <select
            value={selectedMonths}
            onChange={(e: Event) => setSelectedMonths(parseInt((e.target as HTMLSelectElement).value))}
            class="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
          
          <select
            value={selectedAlgorithm}
            onChange={(e: Event) => setSelectedAlgorithm((e.target as HTMLSelectElement).value)}
            class="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="linear_trend">Linear Trend</option>
            <option value="seasonal">Seasonal Pattern</option>
          </select>
        </div>
      </div>

      {predictionsData.length > 0 && (
        <>
          {/* Summary Cards */}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm text-blue-700 mb-1">Predicted Total</div>
                  <div class="text-2xl font-bold text-blue-900">
                    {Math.round(calculateTotalPredictedEmissions())} tCO2e
                  </div>
                  <div class="text-xs text-blue-600">
                    Over next {selectedMonths} months
                  </div>
                </div>
                <div class="text-2xl">{getTrendIcon()}</div>
              </div>
            </div>

            <div class="bg-green-50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm text-green-700 mb-1">Confidence Level</div>
                  <div class="text-2xl font-bold text-green-900">
                    {Math.round(calculateAverageConfidence() * 100)}%
                  </div>
                  <div class={`text-xs ${getConfidenceColor(calculateAverageConfidence())}`}>
                    {getConfidenceLabel(calculateAverageConfidence())} confidence
                  </div>
                </div>
                <div class="text-2xl">🎯</div>
              </div>
            </div>

            <div class="bg-purple-50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm text-purple-700 mb-1">Trend Direction</div>
                  <div class={`text-lg font-bold ${getTrendColor()}`}>
                    {getTrendDirection().charAt(0).toUpperCase() + getTrendDirection().slice(1)}
                  </div>
                  <div class="text-xs text-purple-600">
                    vs historical average
                  </div>
                </div>
                <div class="text-2xl">📊</div>
              </div>
            </div>
          </div>

          {/* Prediction Chart Visualization */}
          <div class="mb-6">
            <h4 class="text-sm font-medium text-gray-900 mb-3">Emissions Forecast</h4>
            
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-end space-x-2 h-48">
                {predictionsData.map((prediction, index) => (
                  <div 
                    key={index}
                    class="flex-1 flex flex-col justify-end items-center"
                  >
                    <div 
                      class="w-full bg-blue-400 rounded-t transition-all duration-300 hover:bg-blue-500 cursor-pointer relative group"
                      style={{ 
                        height: `${(prediction.predictedCo2e / Math.max(...predictionsData.map(p => p.predictedCo2e))) * 100}%`,
                        minHeight: '20px',
                        opacity: prediction.confidence
                      }}
                      title={`${prediction.predictedCo2e} tCO2e (${Math.round(prediction.confidence * 100)}% confidence)`}
                    >
                      {/* Tooltip */}
                      <div class="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {prediction.predictedCo2e} tCO2e<br/>
                        {Math.round(prediction.confidence * 100)}% confidence
                      </div>
                    </div>
                    <div class="text-xs text-gray-600 mt-2 text-center">
                      {formatDate(prediction.date)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div class="flex justify-between items-center mt-4 text-xs text-gray-600">
                <span>Algorithm: {selectedAlgorithm.replace('_', ' ')}</span>
                <span>Confidence decreases over time</span>
              </div>
            </div>
          </div>

          {/* Detailed Predictions Table */}
          <div class="mb-6">
            <h4 class="text-sm font-medium text-gray-900 mb-3">Monthly Predictions</h4>
            
            <div class="overflow-hidden border border-gray-200 rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Predicted Emissions
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      vs Historical Avg
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {predictionsData.map((prediction, index) => {
                    const historicalAvg = getHistoricalAverage();
                    const variance = ((prediction.predictedCo2e - historicalAvg) / historicalAvg) * 100;
                    
                    return (
                      <tr key={index} class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(prediction.date)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span class="font-medium">{prediction.predictedCo2e} tCO2e</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConfidenceColor(prediction.confidence)} bg-opacity-10`}>
                            {Math.round(prediction.confidence * 100)}% {getConfidenceLabel(prediction.confidence)}
                          </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                          <span class={variance > 0 ? 'text-red-600' : 'text-green-600'}>
                            {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights and Recommendations */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h5 class="text-sm font-medium text-gray-900 mb-3">🧠 AI Insights</h5>
            
            <div class="space-y-3 text-sm text-gray-700">
              {getTrendDirection() === 'increasing' && (
                <div class="flex items-start space-x-2">
                  <span class="text-red-500">⚠️</span>
                  <div>
                    <strong>Upward Trend Detected:</strong> Emissions are projected to increase over the forecast period. 
                    Consider implementing additional reduction measures to reverse this trend.
                  </div>
                </div>
              )}
              
              {getTrendDirection() === 'decreasing' && (
                <div class="flex items-start space-x-2">
                  <span class="text-green-500">✅</span>
                  <div>
                    <strong>Positive Trend:</strong> Emissions are projected to decrease. 
                    Your current initiatives appear to be effective - maintain momentum.
                  </div>
                </div>
              )}
              
              {calculateAverageConfidence() < 0.6 && (
                <div class="flex items-start space-x-2">
                  <span class="text-yellow-500">📊</span>
                  <div>
                    <strong>Low Confidence Alert:</strong> Predictions have lower confidence due to insufficient historical data. 
                    More consistent data collection will improve forecast accuracy.
                  </div>
                </div>
              )}
              
              <div class="flex items-start space-x-2">
                <span class="text-blue-500">💡</span>
                <div>
                  <strong>Recommendation:</strong> Set monthly targets based on these predictions and monitor actual performance. 
                  Update forecasts monthly as new data becomes available.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {predictionsData.length === 0 && !predictionsLoading && (
        <div class="text-center py-8 text-gray-500">
          <div class="text-4xl mb-4">📈</div>
          <p class="text-lg mb-2">No Predictions Available</p>
          <p class="text-sm">Need more historical data to generate reliable forecasts</p>
        </div>
      )}
    </div>
  );
}