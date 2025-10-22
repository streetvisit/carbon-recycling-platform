import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ message: 'Test endpoint works!' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  return new Response(JSON.stringify({ received: body, message: 'POST works!' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
