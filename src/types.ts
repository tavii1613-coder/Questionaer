export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: string;
  audioBase64?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  modelId: string;
  isPinned?: boolean;
}

export type CorePlanId = '1_month' | '3_months' | '1_year' | 'lifetime';

export interface CorePlan {
  id: CorePlanId;
  name: string;
  durationLabel: string;
  priceInr: number;
  originalPriceInr?: number;
  savingsLabel?: string;
  isPopular?: boolean;
  isLifetime?: boolean;
  features: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'email' | 'guest';
  isCoreMember: boolean;
  activePlan?: CorePlanId;
  planPurchasedAt?: string;
  planExpiresAt?: string;
}

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface VoiceOption {
  id: VoiceName;
  name: string;
  gender: 'Female' | 'Male' | 'Neutral';
  tone: string;
  description: string;
}

export type PaymentMethod = 'upi' | 'paytm' | 'card';
