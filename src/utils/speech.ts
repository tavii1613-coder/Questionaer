import { VoiceName } from '../types';

let currentAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let watchdogInterval: number | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Initialize voices cache
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

/**
 * Clean markdown and technical syntax so text flows naturally when read aloud
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // Replace markdown code blocks with spoken summary
    .replace(/```[a-zA-Z0-9_-]*\n[\s\S]*?```/g, ' [code snippet omitted] ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold and italics
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet characters
    .replace(/^[\s*+-]+\s+/gm, '')
    // Clean emojis or strange symbols if any
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500); // keep to reasonable spoken length
}

/**
 * Play gentle auditory cues using Web Audio API
 */
export function playVoiceTone(type: 'start_listen' | 'stop_listen' | 'interrupt') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'start_listen') {
      // Upward two-tone chime (Siri/Google Assistant style)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'stop_listen') {
      // Downward chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else {
      // Muted cancel pip
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch {
    // AudioContext blocked or unsupported
  }
}

/**
 * Find the most suitable browser system voice for a given neural voice persona
 */
function findBestVoiceMatch(voiceName: VoiceName): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
  const candidatePool = englishVoices.length > 0 ? englishVoices : voices;

  const isMalePreferred = voiceName === 'Puck' || voiceName === 'Charon' || voiceName === 'Fenrir';

  // 1. Look for high-quality natural/enhanced voices first
  const naturalMatch = candidatePool.find((v) => {
    const name = v.name.toLowerCase();
    const hasNaturalKeyword = name.includes('natural') || name.includes('neural') || name.includes('google') || name.includes('premium');
    if (!hasNaturalKeyword) return false;
    if (isMalePreferred) {
      return name.includes('male') || name.includes('david') || name.includes('george') || name.includes('guy') || name.includes('james');
    } else {
      return name.includes('female') || name.includes('zira') || name.includes('samantha') || name.includes('jenny') || name.includes('aria');
    }
  });
  if (naturalMatch) return naturalMatch;

  // 2. Generic gender match
  const genderMatch = candidatePool.find((v) => {
    const name = v.name.toLowerCase();
    if (isMalePreferred) {
      return name.includes('male') || name.includes('david') || name.includes('george') || name.includes('alex') || name.includes('daniel');
    } else {
      return name.includes('female') || name.includes('samantha') || name.includes('zira') || name.includes('karen') || name.includes('victoria');
    }
  });
  if (genderMatch) return genderMatch;

  // 3. Fallback to default or first English voice
  return candidatePool.find((v) => v.default) || candidatePool[0] || null;
}

/**
 * Speak text using synthesis with full Chrome/Safari fix for garbage collection and pauses
 */
export async function speakText(
  text: string,
  voice: VoiceName = 'Kore',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: unknown) => void
): Promise<void> {
  // Stop any currently playing audio or speech
  stopSpeaking();

  const cleanText = cleanTextForSpeech(text);
  if (!cleanText) {
    onEnd?.();
    return;
  }

  // 1. First, check if backend returned pre-rendered audio (if available)
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, voice }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioBase64) {
        onStart?.();
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
        currentAudio = audio;

        audio.onended = () => {
          currentAudio = null;
          onEnd?.();
        };

        audio.onerror = () => {
          fallbackSpeechSynthesis(cleanText, voice, onStart, onEnd, onError);
        };

        await audio.play();
        return;
      }
    }
  } catch {
    // Continue directly to client synthesis
  }

  // 2. Client-side Speech Synthesis (Immediate, zero latency, guaranteed)
  fallbackSpeechSynthesis(cleanText, voice, onStart, onEnd, onError);
}

function fallbackSpeechSynthesis(
  text: string,
  voiceName: VoiceName,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: unknown) => void
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('SpeechSynthesis is not supported in this environment');
    onError?.(new Error('SpeechSynthesis unavailable'));
    onEnd?.();
    return;
  }

  // Ensure speech synthesis is not suspended or paused
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  // Store utterance in module scope to prevent Chrome garbage collector bug
  activeUtterance = utterance;

  // Custom vocal acoustic profiles
  switch (voiceName) {
    case 'Charon':
      utterance.pitch = 0.72; // deep, resonant
      utterance.rate = 0.94;
      break;
    case 'Puck':
      utterance.pitch = 1.22; // energetic, bright
      utterance.rate = 1.08;
      break;
    case 'Fenrir':
      utterance.pitch = 0.88; // bold, direct
      utterance.rate = 1.02;
      break;
    case 'Zephyr':
      utterance.pitch = 1.10; // calm, soothing
      utterance.rate = 0.90;
      break;
    case 'Kore':
    default:
      utterance.pitch = 1.04; // warm, balanced
      utterance.rate = 1.00;
      break;
  }

  // Find voice
  const matchedVoice = findBestVoiceMatch(voiceName);
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  // Watchdog timer to prevent Chromium from stalling on long sentences (every 4 seconds resume)
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  watchdogInterval = window.setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      if (watchdogInterval) clearInterval(watchdogInterval);
      watchdogInterval = null;
    }
  }, 4000);

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
      watchdogInterval = null;
    }
    onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
      watchdogInterval = null;
    }
    console.warn('SpeechSynthesis error:', e);
    onError?.(e);
    onEnd?.();
  };

  try {
    window.speechSynthesis.speak(utterance);
    // Explicit resume for Safari / mobile browsers
    window.speechSynthesis.resume();
  } catch (err) {
    console.error('Failed to trigger speech synthesis:', err);
    onError?.(err);
    onEnd?.();
  }
}

export function stopSpeaking() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

/**
 * Check if speech recognition is available in the browser
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Speech Recognition Factory with improved configs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSpeechRecognizer(): any | null {
  if (typeof window === 'undefined') return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  try {
    const recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    recognizer.lang = 'en-US';
    return recognizer;
  } catch {
    return null;
  }
}
