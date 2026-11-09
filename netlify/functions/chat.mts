import type { Config } from '@netlify/functions';
import { ai, apiKey, json } from '../lib/gemini.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { messages, voiceMode = false } = await req.json();

    if (!apiKey) {
      return json(
        { error: 'GEMINI_API_KEY is not configured. Add it in Netlify > Site configuration > Environment variables.' },
        500,
      );
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'Messages array is required.' }, 400);
    }

    const systemInstruction = voiceMode
      ? 'You are Ouestionaer Voice, an intelligent, natural conversational AI voice assistant. Speak concisely, clearly, and warmly without excessive bullet points or code unless specifically asked, as your response will be spoken aloud.'
      : 'You are Ouestionaer, a world-class state-of-the-art AI assistant akin to ChatGPT and Gemini. You are helpful, insightful, precise, and articulate. Provide formatted Markdown, clean code snippets with language syntax, and step-by-step reasoning when solving problems.';

    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.text }],
    }));

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: unknown = null;
    let reply = '';

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: { systemInstruction },
        });
        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} transient issue, trying next candidate...`);
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!reply && lastError) throw lastError;
    return json({ text: reply || "I'm here! What would you like to explore?" });
  } catch (error) {
    console.error('Error generating chat content:', error);
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
};

export const config: Config = { path: '/api/chat' };
