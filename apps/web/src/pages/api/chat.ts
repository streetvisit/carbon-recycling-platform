import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CHAT_SYSTEM_PROMPT } from '../../data/platform-knowledge';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('[CHAT API] Request received');
    
    // Get API key from environment
    const apiKey = import.meta.env.GEMINI_API_KEY;
    console.log('[CHAT API] API key present:', !!apiKey, 'length:', apiKey?.length || 0);
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    console.log('[CHAT API] Parsing request body');
    const { message, conversationHistory = [] } = await request.json();
    console.log('[CHAT API] Message:', message?.substring(0, 50), 'History length:', conversationHistory.length);

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Gemini AI
    console.log('[CHAT API] Initializing Gemini AI');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use Flash model (cheapest, fastest)
    console.log('[CHAT API] Getting model');
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
    console.log('[CHAT API] Sending message to Gemini...');
    const result = await chat.sendMessage(`${CHAT_SYSTEM_PROMPT}\n\nUser Question: ${message}`);
    console.log('[CHAT API] Received response from Gemini');
    const response = result.response;
    
    // Check if response is valid
    if (!response) {
      throw new Error('No response from Gemini API');
    }
    
    const text = response.text();
    
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

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
    
    // Provide more detailed error information
    const errorDetails = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Error';
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat message',
        details: errorDetails,
        type: errorName,
        hint: 'Check that GEMINI_API_KEY is set in Cloudflare Pages environment variables'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
