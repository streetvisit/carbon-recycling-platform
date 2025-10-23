import type { APIRoute } from 'astro';
import { unifiedEnergyData } from '../../../lib/unified-energy-data';

export const GET: APIRoute = async () => {
  try {
    const recommendations = await unifiedEnergyData.getBestTimeRecommendations();
    
    return new Response(
      JSON.stringify({
        success: true,
        data: recommendations,
        count: recommendations.length,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch best time recommendations:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
