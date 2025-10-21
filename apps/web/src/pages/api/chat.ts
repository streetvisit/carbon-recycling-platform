import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CHAT_SYSTEM_PROMPT } from '../../data/platform-knowledge';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get API key from environment
    const apiKey = import.meta.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { message, conversationHistory = [] } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use Flash model (cheapest, fastest)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1024,
      }
    });

    // Build conversation history for context
    const chatHistory = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Start chat with history
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'You are a helpful assistant for the Carbon Recycling Platform. Use the following knowledge base to answer questions accurately and helpfully.' }]
        },
        {
          role: 'model',
          parts: [{ text: 'Understood! I\'m ready to help users with the Carbon Recycling Platform. I\'ll use the knowledge base to provide accurate, helpful information about features, navigation, and carbon management best practices.' }]
        },
        ...chatHistory
      ]
    });

    // Send user message with system context
    const result = await chat.sendMessage(`${CHAT_SYSTEM_PROMPT}\n\nUser Question: ${message}`);
    const response = result.response;
    const text = response.text();

    return new Response(
      JSON.stringify({ 
        message: text,
        conversationId: Date.now().toString() // Simple conversation tracking
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store' // Don't cache AI responses
        } 
      }
    );

  } catch (error) {
    console.error('Chat API error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
