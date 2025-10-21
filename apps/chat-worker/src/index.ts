import { GoogleGenerativeAI } from '@google/generative-ai';

interface Env {
  GEMINI_API_KEY: string;
}

const CHAT_SYSTEM_PROMPT = `You are a helpful assistant for the Carbon Recycling Platform...`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { message, conversationHistory = [] } = await request.json();

      if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 1024,
        },
      });

      const chatHistory = conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: 'You are a helpful assistant for the Carbon Recycling Platform.' }],
          },
          {
            role: 'model',
            parts: [{ text: 'Understood! I\'m ready to help users with the Carbon Recycling Platform.' }],
          },
          ...chatHistory,
        ],
      });

      const result = await chat.sendMessage(`${CHAT_SYSTEM_PROMPT}\n\nUser Question: ${message}`);
      const text = result.response.text();

      return new Response(
        JSON.stringify({
          message: text,
          conversationId: Date.now().toString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to process chat message',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
