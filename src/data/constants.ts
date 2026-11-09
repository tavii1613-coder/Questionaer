import { CorePlan, VoiceOption, Conversation } from '../types';

export const CORE_PLANS: CorePlan[] = [
  {
    id: '1_month',
    name: 'Core Monthly',
    durationLabel: '1 Month',
    priceInr: 599,
    originalPriceInr: 799,
    savingsLabel: 'Save 25%',
    features: [
      'Unlimited high-speed Gemini 3.8 Flash queries',
      'All 5 Neural Voice Assistant personas',
      'Continuous voice conversation mode',
      'Code execution & syntax debugging',
      'Export chats to PDF and Markdown',
    ],
  },
  {
    id: '3_months',
    name: 'Core Quarterly',
    durationLabel: '3 Months',
    priceInr: 1499,
    originalPriceInr: 1797,
    savingsLabel: 'Save 16%',
    features: [
      'All 1-Month Core features included',
      'Lower effective monthly rate (₹499/mo)',
      'Priority throughput during peak traffic',
      'Voice pitch & speech velocity tuning',
      'Early access to new experimental models',
    ],
  },
  {
    id: '1_year',
    name: 'Core Annual',
    durationLabel: '1 Year',
    priceInr: 4444,
    originalPriceInr: 7188,
    savingsLabel: 'Save 38%',
    isPopular: true,
    features: [
      'Best value: only ₹370/month',
      'All Core capabilities unlocked',
      'High-fidelity speech synthesis generation',
      'Full conversation history search & tags',
      '24/7 dedicated support priority',
    ],
  },
  {
    id: 'lifetime',
    name: 'Core Lifetime',
    durationLabel: 'Lifetime Access',
    priceInr: 49999,
    originalPriceInr: 99999,
    savingsLabel: 'One-time payment',
    isLifetime: true,
    features: [
      'Forever VIP access — never pay again',
      'All present & future Ouestionaer models',
      'Unlimited voice minutes across all devices',
      'Exclusive Founder badge on your profile',
      'Direct roadmap feedback with engineering',
    ],
  },
];

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Female',
    tone: 'Warm & Articulate',
    description: 'Natural, balanced conversationalist with clear diction.',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Male',
    tone: 'Energetic & Bright',
    description: 'Youthful, dynamic speaker with engaging rhythm.',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Male',
    tone: 'Deep & Authoritative',
    description: 'Rich, calm baritone ideal for deep technical explanations.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    tone: 'Crisp & Direct',
    description: 'Sharp, executive cadence with confident precision.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'Female',
    tone: 'Soft & Empathetic',
    description: 'Gentle, soothing voice perfect for brainstorming and tutorials.',
  },
];

export const PROMPT_STARTERS = [
  {
    title: 'Explain Quantum Computing',
    subtitle: 'Simplified for a 12-year-old',
    prompt: 'Explain how quantum computers work compared to classical computers, using simple analogies suitable for a 12-year-old.',
  },
  {
    title: 'Code an Express API',
    subtitle: 'With rate limiting & JWT auth',
    prompt: 'Write a complete Node.js Express router with TypeScript, including rate limiting, input validation, and JWT authentication.',
  },
  {
    title: 'Draft a Strategic Pitch',
    subtitle: 'For a seed round SaaS investor',
    prompt: 'Draft an executive 1-page investor memo pitching an AI productivity software startup targeting mid-market engineering teams.',
  },
  {
    title: 'Debug React Performance',
    subtitle: 'Preventing redundant re-renders',
    prompt: 'What are the top 4 causes of subtle performance bottlenecks and re-render loops in modern React 19 apps, and how do you profile them?',
  },
];

export const INITIAL_CONVERSATION: Conversation = {
  id: 'conv-initial',
  title: 'Welcome to Ouestionaer',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  modelId: 'gemini-3.8-flash',
  messages: [
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: `Hello! I am **Ouestionaer**, your next-generation AI assistant.\n\nI can help you with:\n- **Deep Problem Solving & Reasoning**: Complex math, logic, and architectural analysis.\n- **Interactive Voice Assistant**: Click the Voice Mode button to converse naturally with 5 unique neural voices.\n- **Full-Stack Engineering & Code**: Debugging, writing production code, and refactoring.\n- **Writing & Brainstorming**: Essays, marketing strategy, and document summarization.\n\nHow can I help you today?`,
      timestamp: new Date().toISOString(),
    },
  ],
};
