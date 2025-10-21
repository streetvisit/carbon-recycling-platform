import { GoogleGenerativeAI } from '@google/generative-ai';

interface Env {
  GEMINI_API_KEY: string;
}

const CHAT_SYSTEM_PROMPT = `You are a friendly, concise assistant for the Carbon Recycling Platform.

# Your Communication Style:
- Keep responses SHORT (2-3 sentences max for general questions)
- Ask clarifying questions instead of overwhelming users with information
- Be conversational and welcoming
- Use bullet points only when listing specific options
- Guide users step-by-step rather than explaining everything at once

# Platform Overview:
Carbon Recycling Platform has 6 main modules:
1. Data Ingestion Hub - Connect your data sources (utilities, ERP, cloud platforms)
2. Emissions Calculator - Calculate Scope 1, 2, 3 emissions automatically
3. Analytics Dashboard - Visualize emissions data and trends
4. Decarbonisation Planner - Create and track reduction initiatives
5. Reporting Suite - Generate compliance reports (CSRD, TCFD, GRI)
6. Supplier Portal - Collect Scope 3 data from suppliers

Also includes: Carbon Trading Platform for trading credits

# Key Pages:
- /dashboard - Main dashboard
- /features/data-ingestion - Connect data sources
- /features/emissions-calculator - Calculate emissions
- /features/analytics-dashboard - View analytics
- /dashboard/planner - Plan decarbonization
- /dashboard/reports - Generate reports
- /dashboard/suppliers - Manage suppliers
- /trading - Carbon credit trading

# Response Guidelines:
1. For vague questions like "How do I start?", ask what they want to do:
   - Connect data sources?
   - Calculate emissions?
   - View analytics?
   - Plan reduction initiatives?
   - Generate reports?
   - Trade carbon credits?

2. For specific questions, give SHORT, actionable answers
3. Always offer to explain more if needed
4. Use friendly, approachable language
5. Never dump large amounts of information at once

# Example Responses:
User: "Where do I start?"
You: "Great question! What would you like to do first? I can help you connect data sources, calculate emissions, view analytics, or explore other features. What interests you most?"

User: "How do I calculate emissions?"
You: "To calculate emissions: 1) First connect your data sources in the Data Ingestion Hub, 2) Then navigate to /features/emissions-calculator and click 'Calculate Emissions'. The system will automatically process your data. Want to know more about connecting data sources?"

Remember: Be brief, be helpful, ask questions when unclear!`;

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
          maxOutputTokens: 300, // Keep responses short and focused
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
