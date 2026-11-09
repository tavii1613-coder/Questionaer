import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Enable microphone permissions across iframes and browser security policies
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=*');
  next();
});

// Shared Gemini Client with required telemetry headers
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, voiceMode = false } = req.body;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in the environment. Please add it to Settings > Secrets.',
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Format system instruction
    const systemInstruction = voiceMode
      ? 'You are Ouestionaer Voice, an intelligent, natural conversational AI voice assistant. Speak concisely, clearly, and warmly without excessive bullet points or code unless specifically asked, as your response will be spoken aloud.'
      : 'You are Ouestionaer, a world-class state-of-the-art AI assistant akin to ChatGPT and Gemini. You are helpful, insightful, precise, and articulate. Provide formatted Markdown, clean code snippets with language syntax, and step-by-step reasoning when solving problems.';

    // Format contents from chat history
    const contents = messages.map((m: { role: 'user' | 'model' | 'assistant'; text: string }) => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.text }],
    }));

    // Generate with retry and fallback across supported flash models
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: unknown = null;
    let reply = '';

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
          },
        });
        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Model ${modelName} transient issue, trying next candidate...`);
        // short wait before retry
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!reply && lastError) {
      throw lastError;
    }

    return res.json({ text: reply || "I'm here! What would you like to explore?" });
  } catch (error: unknown) {
    console.error('Error generating chat content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
});

// Text-to-Speech endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text string is required.' });
    }

    const speechText = text.slice(0, 1000);
    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const voiceName = validVoices.includes(voice) ? voice : 'Kore';

    if (apiKey) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: speechText }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({ audioBase64: base64Audio, format: 'audio/wav', voice: voiceName });
        }
      } catch (geminiError: unknown) {
        console.warn('Gemini audio generation notice (falling back to client voice synthesis):', 
          geminiError instanceof Error ? geminiError.message : String(geminiError)
        );
      }
    }

    // Gracefully inform client to use high-quality client synthesis
    return res.json({
      fallback: true,
      voice: voiceName,
      text: speechText,
      message: 'Using client neural speech synthesis',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Speech generation failed';
    return res.status(200).json({ fallback: true, error: errorMessage });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Ouestionaer',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ouestionaer server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
