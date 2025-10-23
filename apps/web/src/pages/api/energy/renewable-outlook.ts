import type { APIRoute } from 'astro';
import { unifiedEnergyData } from '../../../lib/unified-energy-data';

export const GET: APIRoute = async () => {
  try {
    const outlook = await unifiedEnergyData.getRenewableOutlook();
    
    return new Response(
      JSON.stringify({
        success: true,
        data: outlook,
        days: outlook.length,
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
    console.error('Failed to fetch renewable outlook:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch outlook',
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
