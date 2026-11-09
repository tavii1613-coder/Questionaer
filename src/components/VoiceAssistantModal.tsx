import React, { useState, useEffect, useRef } from 'react';
import { VoiceName } from '../types';
import { VOICE_OPTIONS } from '../data/constants';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  Square,
  Sparkles,
  ChevronDown,
  Send,
  AlertTriangle,
  Play,
  ShieldCheck,
  Clock,
  Ban,
  Settings,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  playVoiceTone,
} from '../utils/speech';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVoice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  onSendTranscriptToChat: (userText: string, assistantReply: string) => void;
}

export type MicPermissionChoice = 'while_using_app' | 'only_this_time' | 'never' | 'prompt';

const QUICK_VOICE_TOPICS = [
  'Explain quantum computing in simple terms',
  'Give me 3 practical tips for deep focus',
  'Tell me an inspiring thought for today',
  'Tell me a creative science fiction story',
];

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  activeVoice,
  onVoiceChange,
  onSendTranscriptToChat,
}) => {
  const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [handsFree, setHandsFree] = useState(false);

  // Permission States
  const [permissionChoice, setPermissionChoice] = useState<MicPermissionChoice>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_mic_permission');
      if (saved === 'while_using_app' || saved === 'never') return saved;
    }
    return 'prompt';
  });

  const [sessionPermissionGranted, setSessionPermissionGranted] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // Hardware Mic diagnostic status
  const [micBlockedReason, setMicBlockedReason] = useState<
    'none' | 'permission_denied' | 'iframe_sandbox' | 'no_device' | 'speech_service_blocked'
  >('none');
  const [isInsideIframe, setIsInsideIframe] = useState(false);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);

  // Audio Level & Stream for live mic visualizer
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognizerRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsInsideIframe(window.self !== window.top);
      } catch {
        setIsInsideIframe(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
      stopListeningCleanup();
      setState('idle');
      setTranscript('');
      setShowPermissionDialog(false);
      setShowTroubleshooter(false);
    }
  }, [isOpen]);

  // Clean up mic streams and recognizer
  const stopListeningCleanup = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    setLiveVolume(0);

    if (recognizerRef.current) {
      try {
        recognizerRef.current.onresult = null;
        recognizerRef.current.onend = null;
        recognizerRef.current.onerror = null;
        recognizerRef.current.stop();
      } catch {
        // ignore
      }
      recognizerRef.current = null;
    }
  };

  /**
   * Main entry point when user clicks "Speak Now" or taps the glowing orb
   */
  const handleSpeakNowClick = () => {
    if (state === 'speaking') {
      handleInterrupt();
      return;
    }
    if (state === 'listening') {
      handleStopListeningAndSubmit();
      return;
    }

    // Check permission rules requested by user
    if (permissionChoice === 'never') {
      setShowPermissionDialog(true);
      return;
    }

    const hasPermission =
      permissionChoice === 'while_using_app' || sessionPermissionGranted;

    if (!hasPermission) {
      // Prompt user with the 3 choices: While using the app / Only this time / Never
      setShowPermissionDialog(true);
      return;
    }

    // Permission is granted, initiate listening
    executeStartListening();
  };

  /**
   * Handles user selection on the Permission Dialog
   */
  const handleSelectPermissionOption = async (option: 'while_using_app' | 'only_this_time' | 'never') => {
    setShowPermissionDialog(false);

    if (option === 'while_using_app') {
      setPermissionChoice('while_using_app');
      localStorage.setItem('questionaer_mic_permission', 'while_using_app');
      setSessionPermissionGranted(true);
      await executeStartListening();
    } else if (option === 'only_this_time') {
      setPermissionChoice('only_this_time');
      setSessionPermissionGranted(true);
      await executeStartListening();
    } else if (option === 'never') {
      setPermissionChoice('never');
      localStorage.setItem('questionaer_mic_permission', 'never');
      setSessionPermissionGranted(false);
      setMicBlockedReason('permission_denied');
    }
  };

  /**
   * Hardware Audio Stream + Speech Recognition Execution
   */
  const executeStartListening = async () => {
    stopSpeaking();
    stopListeningCleanup();
    setTranscript('');
    setMicBlockedReason('none');

    playVoiceTone('start_listen');
    setState('listening');

    let streamObtained = false;

    // 1. Request hardware MediaStream with getUserMedia
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        streamObtained = true;

        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (audioContextRef.current && analyser) {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setLiveVolume(Math.min(100, Math.round((avg / 255) * 100)));
              animationFrameRef.current = requestAnimationFrame(updateVolume);
            }
          };
          updateVolume();
        }
      }
    } catch (mediaErr: unknown) {
      console.warn('getUserMedia error:', mediaErr);
      const err = mediaErr as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicBlockedReason('permission_denied');
        setShowTroubleshooter(true);
      } else if (err.name === 'SecurityError') {
        setMicBlockedReason('iframe_sandbox');
        setShowTroubleshooter(true);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicBlockedReason('no_device');
      }
    }

    // 2. Start Speech Recognition
    const recognizer = createSpeechRecognizer();
    if (!recognizer) {
      if (!streamObtained) {
        setMicBlockedReason('speech_service_blocked');
        setShowTroubleshooter(true);
      }
      return;
    }

    recognizerRef.current = recognizer;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognizer.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);

      // Auto-submit after 2 seconds of silence
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(() => {
        if (transcriptRef.current.trim().length > 0) {
          handleStopListeningAndSubmit();
        }
      }, 2000);
    };

    recognizer.onend = () => {
      const finalQuery = transcriptRef.current.trim();
      if (finalQuery.length > 0 && state === 'listening') {
        handleSendVoiceQuery(finalQuery);
      } else if (state === 'listening') {
        stopListeningCleanup();
        setState('idle');
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognizer.onerror = (e: any) => {
      const err = e?.error || 'unknown';
      console.warn('Speech recognition event:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setMicBlockedReason('permission_denied');
        setShowTroubleshooter(true);
      }
      stopListeningCleanup();
      setState('idle');
      playVoiceTone('interrupt');
    };

    try {
      recognizer.start();
    } catch (err) {
      console.error('Recognizer start error:', err);
      if (!streamObtained) {
        setMicBlockedReason('speech_service_blocked');
        setShowTroubleshooter(true);
      }
      stopListeningCleanup();
      setState('idle');
    }
  };

  const handleStopListeningAndSubmit = () => {
    playVoiceTone('stop_listen');
    const finalQuery = transcriptRef.current.trim();
    stopListeningCleanup();

    if (finalQuery.length > 0) {
      handleSendVoiceQuery(finalQuery);
    } else {
      setState('idle');
    }
  };

  const handleSendVoiceQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setTranscript(queryText);
    setState('thinking');
    stopListeningCleanup();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: queryText }],
          voiceMode: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API error (${res.status})`);
      }

      const data = await res.json();
      const reply = data.text || "I'm here! What would you like to explore next?";
      setAssistantReply(reply);
      onSendTranscriptToChat(queryText, reply);

      // Trigger spoken response
      setState('speaking');
      await speakText(
        reply,
        activeVoice,
        () => setState('speaking'),
        () => {
          setState('idle');
          if (handsFree && isOpen) {
            setTimeout(() => {
              executeStartListening();
            }, 800);
          }
        },
        () => {
          setState('idle');
        }
      );
    } catch (err) {
      console.error('Voice assistant error:', err);
      const fallbackMsg = "I'm having a connection hiccup right now. Please try again.";
      setAssistantReply(fallbackMsg);
      setState('idle');
      speakText(fallbackMsg, activeVoice);
    }
  };

  const handleInterrupt = () => {
    playVoiceTone('interrupt');
    stopSpeaking();
    stopListeningCleanup();
    setState('idle');
  };

  const handleTestVoice = (voice: VoiceName) => {
    onVoiceChange(voice);
    const phrases: Record<VoiceName, string> = {
      Kore: "Hi, I'm Kore. A warm and articulate voice designed for natural conversation.",
      Puck: "Hey there! I'm Puck. Ready to brainstorm and tackle any challenge!",
      Charon: "Greetings. I am Charon, focused on clear and grounded technical insights.",
      Fenrir: "Hello. I'm Fenrir, direct, confident and built for fast problem solving.",
      Zephyr: "Welcome. I am Zephyr, here to assist with thoughtful and soothing guidance.",
    };
    speakText(phrases[voice], voice);
  };

  const handleManualTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = textInput.trim();
    if (!query) return;
    setTextInput('');
    handleSendVoiceQuery(query);
  };

  const openAppInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-100 min-h-[600px] max-h-[92vh] relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-modal-title"
      >
        {/* ========================================================= */}
        {/* 1. PERMISSION PROMPT MODAL (EXACT SPECIFICATION)          */}
        {/* ========================================================= */}
        {showPermissionDialog && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xs flex items-center justify-center p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-full max-w-md bg-stone-900 border border-stone-700/90 rounded-2xl p-6 shadow-2xl text-left space-y-5">
              {/* Header Icon + Title */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Mic className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-stone-100 leading-snug">
                    Questionnaire AI wants to use your microphone
                  </h4>
                  <p className="text-xs text-stone-400 mt-1">
                    To listen to your speech and let you converse naturally with AI voice models.
                  </p>
                </div>
              </div>

              {/* 3 Explicit Options as Requested */}
              <div className="space-y-2 pt-1">
                {/* Option 1: Only this time */}
                <button
                  type="button"
                  onClick={() => handleSelectPermissionOption('only_this_time')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-stone-800 text-left transition-colors"
                >
                  <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-stone-200">
                      Only this time
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Grant temporary microphone access for this session only
                    </div>
                  </div>
                </button>

                {/* Option 2: Never */}
                <button
                  type="button"
                  onClick={() => handleSelectPermissionOption('never')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-stone-700/60 bg-stone-850 hover:bg-stone-800/60 text-left transition-colors"
                >
                  <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-stone-300">
                      Never
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Block microphone (you can still type your questions)
                    </div>
                  </div>
                </button>

                {/* Option 3: While using the app */}
                <button
                  type="button"
                  onClick={() => handleSelectPermissionOption('while_using_app')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-amber-200 group-hover:text-amber-100">
                        While using the app
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Remember choice and allow microphone anytime in Voice Mode
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-stone-950 shrink-0">
                    Recommended
                  </span>
                </button>
              </div>

              {/* Close / Dismiss */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowPermissionDialog(false)}
                  className="text-xs text-stone-400 hover:text-stone-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. BROWSER PERMISSION TROUBLESHOOTER OVERLAY              */}
        {/* ========================================================= */}
        {showTroubleshooter && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl p-6 shadow-2xl text-left space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-stone-100">
                    Microphone Access Help
                  </h4>
                </div>
                <button
                  onClick={() => setShowTroubleshooter(false)}
                  className="text-stone-400 hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-stone-300">
                {isInsideIframe && (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/80 space-y-2">
                    <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Running in AI Studio Preview Frame</span>
                    </div>
                    <p className="text-[11px] text-stone-300 leading-relaxed">
                      Browsers automatically block microphone hardware inside embedded preview frames for security. Open Questionnaire in its own tab where the browser's native microphone prompt works immediately!
                    </p>
                    <button
                      type="button"
                      onClick={openAppInNewTab}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Full Tab (Enables Mic)</span>
                    </button>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-stone-800/80 border border-stone-700/80 space-y-2">
                  <div className="font-semibold text-amber-300">
                    How to Unblock in Chrome / Edge / Brave:
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-stone-400">
                    <li>Look at the address bar at the very top of your browser.</li>
                    <li>Click the <strong>Lock 🔒 or Tune ⚙️ icon</strong> on the left.</li>
                    <li>Set <strong>Microphone</strong> to <strong>Allow</strong>.</li>
                    <li>Then tap the <strong>Test Microphone Again</strong> button below.</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setShowTroubleshooter(false);
                    await executeStartListening();
                  }}
                  className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-white text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Test Microphone Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTroubleshooter(false)}
                  className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            {/* Voice Selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-xs font-semibold transition-colors border border-stone-700"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Voice: {activeVoice}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {isVoiceDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Select AI Voice Profile
                  </div>
                  {VOICE_OPTIONS.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => {
                        setIsVoiceDropdownOpen(false);
                        handleTestVoice(v.id);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                        activeVoice === v.id
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                          : 'hover:bg-stone-800 text-stone-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <span>{v.name}</span>
                          <span className="text-[10px] text-stone-400">({v.gender})</span>
                        </div>
                        <div className="text-[10px] text-stone-400">{v.tone}</div>
                      </div>
                      <button
                        type="button"
                        title="Preview Voice"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestVoice(v.id);
                        }}
                        className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Permission Status Indicator Chip (allows user to re-open or switch anytime) */}
            <button
              type="button"
              onClick={() => setShowPermissionDialog(true)}
              title="Click to manage microphone permission"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                permissionChoice === 'while_using_app'
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400 hover:bg-emerald-950/70'
                  : permissionChoice === 'only_this_time' || sessionPermissionGranted
                  ? 'bg-cyan-950/40 border-cyan-800/80 text-cyan-400 hover:bg-cyan-950/70'
                  : permissionChoice === 'never'
                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-400 hover:bg-rose-950/70'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700'
              }`}
            >
              <Mic className="w-3 h-3" />
              <span>
                {permissionChoice === 'while_using_app'
                  ? 'Mic: Allowed'
                  : permissionChoice === 'only_this_time' || sessionPermissionGranted
                  ? 'Mic: This session'
                  : permissionChoice === 'never'
                  ? 'Mic: Blocked'
                  : 'Mic Permission'}
              </span>
              <Settings className="w-2.5 h-2.5 opacity-60" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Open in full tab if inside iframe */}
            {isInsideIframe && (
              <button
                type="button"
                onClick={openAppInNewTab}
                title="Open in standalone tab to enable microphone"
                className="hidden md:flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in Full Tab</span>
              </button>
            )}

            <button
              onClick={() => {
                const next = !handsFree;
                setHandsFree(next);
                if (next && state === 'idle') {
                  handleSpeakNowClick();
                }
              }}
              title="Auto-listen after speaking"
              className={`hidden sm:inline-block px-3 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                handsFree
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-stone-800 border-stone-700 text-stone-400'
              }`}
            >
              Hands-Free: {handsFree ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-100 rounded-full hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner if Mic blocked with quick help trigger */}
        {micBlockedReason !== 'none' && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="truncate">
                {micBlockedReason === 'permission_denied'
                  ? 'Microphone blocked by browser. Unblock to speak or type below.'
                  : micBlockedReason === 'iframe_sandbox'
                  ? 'Microphone blocked inside preview frame. Open in full tab.'
                  : 'Microphone unavailable. Use quick topics or type below.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTroubleshooter(true)}
              className="px-2.5 py-1 rounded-md bg-amber-500 text-stone-950 font-bold text-[11px] hover:bg-amber-400 shrink-0"
            >
              Fix Mic
            </button>
          </div>
        )}

        {/* Center Orb Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 text-center relative overflow-hidden">
          {/* Status Label */}
          <div className="space-y-1 max-w-md">
            <div className="text-xs font-semibold uppercase tracking-widest text-stone-400 flex items-center justify-center gap-1.5">
              {state === 'listening' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-cyan-300">
                    {liveVolume > 5 ? `Listening (Voice Level: ${liveVolume}%)` : 'Listening to your voice...'}
                  </span>
                </>
              ) : state === 'thinking' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span className="text-purple-300">Questionnaire AI is thinking...</span>
                </>
              ) : state === 'speaking' ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="text-amber-300">Speaking ({activeVoice})</span>
                </>
              ) : (
                <span className="text-stone-400">Ready · Tap Speak Now or Use Quick Topics</span>
              )}
            </div>

            {/* Display user transcript or assistant speech */}
            <h3
              id="voice-modal-title"
              className="text-sm text-stone-200 font-medium px-4 min-h-[3rem] flex items-center justify-center line-clamp-3 leading-relaxed"
            >
              {state === 'listening'
                ? transcript || 'Say your question now...'
                : state === 'speaking'
                ? assistantReply
                : assistantReply
                ? assistantReply
                : 'Converse naturally with Questionnaire AI voice assistant'}
            </h3>
          </div>

          {/* Glowing Orb */}
          <div className="relative flex items-center justify-center py-2">
            {/* Ambient pulse rings */}
            {state === 'speaking' && (
              <div className="absolute w-52 h-52 rounded-full bg-amber-500/20 animate-ping opacity-60 pointer-events-none" />
            )}
            {state === 'listening' && (
              <div
                className="absolute rounded-full bg-cyan-500/25 transition-all duration-75 pointer-events-none"
                style={{
                  width: `${140 + liveVolume * 1.2}px`,
                  height: `${140 + liveVolume * 1.2}px`,
                }}
              />
            )}
            {state === 'thinking' && (
              <div className="absolute w-52 h-52 rounded-full bg-purple-500/25 animate-pulse opacity-75 pointer-events-none" />
            )}

            {/* Interactive Orb button */}
            <button
              type="button"
              onClick={handleSpeakNowClick}
              title={
                state === 'listening'
                  ? 'Click to stop listening and ask'
                  : state === 'speaking'
                  ? 'Click to interrupt'
                  : 'Click to start speaking'
              }
              className={`w-36 h-36 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl relative z-10 focus:outline-hidden ${
                state === 'listening'
                  ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 scale-105 ring-4 ring-cyan-400/50 shadow-cyan-500/30'
                  : state === 'thinking'
                  ? 'bg-gradient-to-tr from-purple-600 to-pink-500 animate-spin ring-4 ring-purple-400/40'
                  : state === 'speaking'
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-400 scale-110 ring-4 ring-amber-400/60 shadow-amber-500/30'
                  : 'bg-gradient-to-tr from-stone-800 to-stone-700 hover:scale-105 ring-2 ring-stone-600 hover:ring-amber-500/50'
              }`}
            >
              {state === 'speaking' ? (
                <Volume2 className="w-12 h-12 text-white animate-pulse" />
              ) : state === 'listening' ? (
                <Mic className="w-12 h-12 text-white animate-bounce" />
              ) : state === 'thinking' ? (
                <Sparkles className="w-12 h-12 text-white" />
              ) : (
                <Mic className="w-12 h-12 text-stone-200" />
              )}
            </button>
          </div>

          {/* Dynamic Audio Visualizer Waveform */}
          <div className="flex items-center justify-center gap-1.5 h-8">
            {[35, 65, 40, 85, 55, 95, 70, 90, 45, 60, 80, 50].map((h, i) => {
              const liveFactor = state === 'listening' ? Math.max(15, liveVolume) : 40;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    state === 'speaking'
                      ? 'bg-amber-400'
                      : state === 'listening'
                      ? 'bg-cyan-400'
                      : 'bg-stone-700'
                  }`}
                  style={{
                    height:
                      state === 'speaking' || state === 'listening'
                        ? `${Math.max(12, Math.min(100, (h * (Math.sin(Date.now() / 180 + i) + 1.2) * (liveFactor / 40)) / 2))}%`
                        : '4px',
                  }}
                />
              );
            })}
          </div>

          {/* Quick Voice Topics Pills */}
          <div className="w-full max-w-md pt-1">
            <div className="text-[11px] text-stone-400 mb-2 font-medium flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Tap a topic to hear {activeVoice} answer out loud:</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {QUICK_VOICE_TOPICS.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendVoiceQuery(suggestion)}
                  disabled={state === 'thinking' || state === 'speaking'}
                  className="px-2.5 py-1 text-xs rounded-full bg-stone-800 hover:bg-stone-700/80 border border-stone-700 text-stone-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Control & Input Bar */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950/70 flex flex-col sm:flex-row items-center gap-3 shrink-0">
          {/* Direct Text Input for 100% reliable input */}
          <form onSubmit={handleManualTextSubmit} className="flex-1 w-full flex items-center gap-2">
            <input
              type="text"
              placeholder={`Ask ${activeVoice} anything...`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs bg-stone-900 border border-stone-700 rounded-xl text-stone-100 placeholder-stone-500 focus:outline-hidden focus:border-amber-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || state === 'thinking'}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-colors disabled:opacity-40"
              title="Send to Voice Assistant"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {state === 'speaking' ? (
              <button
                type="button"
                onClick={handleInterrupt}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 rounded-full text-xs font-semibold text-rose-300 transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Voice</span>
              </button>
            ) : state === 'listening' ? (
              <button
                type="button"
                onClick={handleStopListeningAndSubmit}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-full text-xs font-semibold text-white transition-colors"
              >
                <MicOff className="w-3.5 h-3.5" />
                <span>Done Speaking</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSpeakNowClick}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-100 text-stone-950 hover:bg-white rounded-full text-xs font-semibold transition-colors shadow-xs"
              >
                <Mic className="w-3.5 h-3.5 text-stone-900" />
                <span>Speak Now</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleTestVoice(activeVoice)}
              title="Test current voice audio"
              className="p-2 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
