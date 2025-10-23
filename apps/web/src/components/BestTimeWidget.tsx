import { useEffect, useState } from 'preact/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
// Note: lucide-react icons replaced with emoji/text for Astro compatibility

interface BestTimeData {
  timestamp: Date;
  score: number;
  carbonIntensity: number;
  renewablePercentage: number;
  recommendation: 'excellent' | 'good' | 'moderate' | 'poor';
  reason: string;
}

export function BestTimeWidget() {
  const [recommendations, setRecommendations] = useState<BestTimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  async function fetchRecommendations() {
    try {
      const response = await fetch('/api/energy/best-time');
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      
      const result = await response.json();
      if (result.success) {
        setRecommendations(result.data.map((r: any) => ({
          ...r,
          timestamp: new Date(r.timestamp),
        })));
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'excellent': return 'bg-green-500 text-white';
      case 'good': return 'bg-blue-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-white';
      case 'poor': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getIcon = (rec: string) => {
    switch (rec) {
      case 'excellent': return <span className="text-green-600">📉</span>;
      case 'good': return <span className="text-blue-600">⚡</span>;
      case 'moderate': return <span className="text-yellow-600">⏰</span>;
      case 'poor': return <span className="text-red-600">📈</span>;
      default: return <span className="text-gray-600">⏰</span>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Best Time to Use Energy</CardTitle>
          <CardDescription>Loading recommendations...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Best Time to Use Energy</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show next 6 hours (12 x 30-min intervals)
  const next6Hours = recommendations.slice(0, 12);
  const currentRec = next6Hours[0];

  // Find best time in next 6 hours
  const bestTime = next6Hours.reduce((best, curr) => 
    curr.score > best.score ? curr : best
  , next6Hours[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          Best Time to Use Energy
        </CardTitle>
        <CardDescription>AI-powered recommendations based on renewable availability</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Right Now</span>
            <Badge className={getRecommendationColor(currentRec?.recommendation)}>
              {currentRec?.recommendation.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">{currentRec?.reason}</p>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span>🍃 {currentRec?.renewablePercentage.toFixed(0)}% renewable</span>
            <span>☁️ {currentRec?.carbonIntensity}g CO₂/kWh</span>
          </div>
        </div>

        {/* Best Time Alert */}
        {bestTime && bestTime !== currentRec && (
          <div className="p-4 rounded-lg bg-green-50 border-2 border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">📉</span>
              <span className="text-sm font-semibold text-green-800">
                Optimal Time: {bestTime.timestamp.toLocaleTimeString('en-GB', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            <p className="text-sm text-green-700">
              {bestTime.renewablePercentage.toFixed(0)}% renewable energy - perfect for energy-intensive tasks!
            </p>
          </div>
        )}

        {/* Next 6 Hours Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Next 6 Hours</h4>
          <div className="grid grid-cols-6 gap-1">
            {next6Hours.map((rec, index) => (
              <div
                key={index}
                className="relative group"
              >
                <div
                  className={`h-16 rounded flex items-end justify-center p-1 transition-all cursor-pointer
                    ${rec.recommendation === 'excellent' ? 'bg-green-500 hover:bg-green-600' : ''}
                    ${rec.recommendation === 'good' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                    ${rec.recommendation === 'moderate' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                    ${rec.recommendation === 'poor' ? 'bg-red-500 hover:bg-red-600' : ''}
                  `}
                  style={{ height: `${(rec.score / 100) * 64 + 16}px` }}
                >
                  <span className="text-[8px] text-white font-bold">
                    {rec.timestamp.getHours()}
                  </span>
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap shadow-lg">
                    <div className="font-semibold">
                      {rec.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>{rec.renewablePercentage.toFixed(0)}% renewable</div>
                    <div>{rec.carbonIntensity}g CO₂/kWh</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Now</span>
            <span>+6h</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">Excellent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Good</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span className="text-gray-600">Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">Poor</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
