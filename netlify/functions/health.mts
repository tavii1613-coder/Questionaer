import type { Config } from '@netlify/functions';
import { apiKey, json } from '../lib/gemini.ts';

export default async () => json({ status: 'ok', app: 'Ouestionaer', hasApiKey: Boolean(apiKey) });

export const config: Config = { path: '/api/health' };
