import type { Config } from '@netlify/functions';
import { ai, apiKey, json } from '../lib/gemini.ts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { text, voice = 'Kore' } = await req.json();

    if (!text || typeof text !== 'string') {
      return json({ error: 'Text string is required.' }, 400);
    }

    const speechText = text.slice(0, 1000);
    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const voiceName = validVoices.includes(voice) ? voice : 'Kore';

    if (apiKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [{ role: 'user', parts: [{ text: speechText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return json({ audioBase64: base64Audio, format: 'audio/wav', voice: voiceName });
        }
      } catch (e) {
        console.warn('Gemini audio generation notice (falling back to client voice synthesis):', e instanceof Error ? e.message : String(e));
      }
    }

    return json({ fallback: true, voice: voiceName, text: speechText, message: 'Using client neural speech synthesis' });
  } catch (error) {
    return json({ fallback: true, error: error instanceof Error ? error.message : 'Speech generation failed' });
  }
};

export const config: Config = { path: '/api/tts' };
