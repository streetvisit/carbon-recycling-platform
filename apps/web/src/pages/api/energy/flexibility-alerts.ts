import type { APIRoute } from 'astro';
import { unifiedEnergyData } from '../../../lib/unified-energy-data';

export const GET: APIRoute = async () => {
  try {
    const alerts = await unifiedEnergyData.getFlexibilityAlerts();
    
    return new Response(
      JSON.stringify({
        success: true,
        data: alerts,
        hasActiveAlerts: alerts.some(a => a.active),
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
    console.error('Failed to fetch flexibility alerts:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch alerts',
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
