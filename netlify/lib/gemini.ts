import { GoogleGenAI } from '@google/genai';

export const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
