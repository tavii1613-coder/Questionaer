import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Mic, Sparkles, ChevronDown } from 'lucide-react';
import { PROMPT_STARTERS } from '../data/constants';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onOpenVoiceAssistant: () => void;
  model: string;
  onModelChange: (model: string) => void;
  showStarters: boolean;
  onSelectStarter: (prompt: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onOpenVoiceAssistant,
  model,
  onModelChange,
  showStarters,
  onSelectStarter,
}) => {
  const [text, setText] = useState('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const models = [
    { id: 'gemini-3.8-flash', name: 'Ouestionaer 3.8 Flash', tag: 'Fast & Versatile' },
    { id: 'gemini-3.8-reasoning', name: 'Ouestionaer Deep Reason', tag: 'Complex Logic' },
    { id: 'gemini-3.8-code', name: 'Ouestionaer Code Studio', tag: 'Full-Stack Dev' },
  ];

  const currentModel = models.find((m) => m.id === model) || models[0];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 space-y-4">
      {/* Prompt Starters if empty chat */}
      {showStarters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2">
          {PROMPT_STARTERS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => onSelectStarter(s.prompt)}
              className="p-3 text-left rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:bg-stone-50 dark:hover:bg-stone-800/60 hover:border-stone-300 dark:hover:border-stone-700 transition-all shadow-2xs group"
            >
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-stone-700 dark:group-hover:text-stone-300">
                {s.title}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                {s.subtitle}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input Container */}
      <div className="relative rounded-2xl border border-stone-300 dark:border-stone-700/80 bg-white dark:bg-stone-900 shadow-md focus-within:ring-2 focus-within:ring-stone-400 dark:focus-within:ring-stone-600 focus-within:border-transparent transition-all overflow-hidden">
        {/* Model Selector pill on top right */}
        <div className="flex items-center justify-between px-3.5 pt-2 text-xs">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 font-medium transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{currentModel.name}</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl p-1.5 z-30 space-y-1">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onModelChange(m.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors ${
                      model === m.id
                        ? 'bg-stone-100 dark:bg-stone-700 font-semibold text-stone-900 dark:text-stone-100'
                        : 'hover:bg-stone-50 dark:hover:bg-stone-700/50 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    <div>{m.name}</div>
                    <div className="text-[10px] text-stone-400 font-normal">{m.tag}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[10px] text-stone-400">
            Powered by Gemini 3.8
          </span>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Ouestionaer anything..."
          className="w-full px-4 py-3 text-xs sm:text-sm text-stone-900 dark:text-stone-100 bg-transparent resize-none focus:outline-hidden placeholder-stone-400 dark:placeholder-stone-500 max-h-48"
        />

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          {/* Voice Assistant Launch Button */}
          <button
            type="button"
            onClick={onOpenVoiceAssistant}
            title="Launch Voice Assistant"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-all group"
          >
            <Mic className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-500 transition-colors" />
            <span>Voice Mode</span>
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!text.trim() || isLoading}
            className="w-8 h-8 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-800 dark:hover:bg-stone-200 transition-all shadow-xs"
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-2" />
            )}
          </button>
        </div>
      </div>

      <div className="text-center text-[11px] text-stone-400">
        Ouestionaer can make mistakes. Verify critical facts and code.
      </div>
    </div>
  );
};
