import React from 'react';
import { Menu, Sun, Moon, Sparkles, Mic, Crown } from 'lucide-react';
import { VoiceName } from '../types';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenVoiceModal: () => void;
  onOpenUpgradeModal: () => void;
  activeVoice: VoiceName;
  isOwner: boolean;
  isCoreMember: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  isDark,
  onToggleTheme,
  onOpenVoiceModal,
  onOpenUpgradeModal,
  activeVoice,
  isOwner,
  isCoreMember,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark & Mobile toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 rounded-lg md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap">
            Ouestionaer
          </span>
          {isOwner && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-stone-950 rounded-full">
              <Crown className="w-3 h-3" />
              <span>Owner VIP</span>
            </span>
          )}
        </div>

        {/* Zone 2: Navigation Links (1-2 word labels, single line) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-stone-600 dark:text-stone-400">
          <button
            onClick={onOpenVoiceModal}
            className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap"
          >
            Voice Studio ({activeVoice})
          </button>
          <button
            onClick={onOpenUpgradeModal}
            className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap"
          >
            Core Plans
          </button>
          <span className="text-stone-300 dark:text-stone-700">·</span>
          <span className="text-stone-500 whitespace-nowrap">
            Gemini 3.8 Flash
          </span>
        </nav>

        {/* Zone 3: Primary Action & Theme */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenVoiceModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Mic className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Voice Assistant</span>
          </button>

          {!isOwner && !isCoreMember && (
            <button
              onClick={onOpenUpgradeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 dark:bg-stone-100 dark:text-stone-900 rounded-lg hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Get Core</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
