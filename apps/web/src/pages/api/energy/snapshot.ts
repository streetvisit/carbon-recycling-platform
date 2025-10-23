import type { APIRoute } from 'astro';
import { unifiedEnergyData } from '../../../lib/unified-energy-data';

export const GET: APIRoute = async () => {
  try {
    const snapshot = await unifiedEnergyData.getCurrentSnapshot();
    
    return new Response(
      JSON.stringify({
        success: true,
        data: snapshot,
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
    console.error('Failed to fetch energy snapshot:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch energy data',
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
