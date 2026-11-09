/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, UserProfile, VoiceName, CorePlanId } from './types';
import { INITIAL_CONVERSATION } from './data/constants';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { CoreUpgradeModal } from './components/CoreUpgradeModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { playClickPip } from './utils/audio';

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('questionaer_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('questionaer_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    playClickPip();
    setIsDark((prev) => !prev);
  };

  // User Authentication State
  // Owner email is tavii.1613@gmail.com
  const OWNER_EMAIL = 'tavii.1613@gmail.com';

  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.email === 'tavii.1613@gmail.com' || parsed.email === 'tavi.1613@gmail.com')) {
            return {
              ...parsed,
              email: 'tavii.1613@gmail.com',
              name: 'Tavii (Owner)',
              isCoreMember: true,
              activePlan: 'lifetime',
            };
          }
          return parsed;
        } catch {
          // ignore
        }
      }
    }
    // Default profile - signed in as Owner for immediate full access as requested!
    return {
      id: 'owner-tavii',
      name: 'Tavii (Owner)',
      email: OWNER_EMAIL,
      avatar: 'T',
      provider: 'google',
      isCoreMember: true,
      activePlan: 'lifetime',
    };
  });

  // Check if current user is owner
  const isOwner =
    user.email.toLowerCase().includes('tavii.1613@gmail.com') ||
    user.email.toLowerCase().includes('tavi.1613@gmail.com');

  useEffect(() => {
    localStorage.setItem('questionaer_user', JSON.stringify(user));
  }, [user]);

  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_conversations');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }
    }
    return [INITIAL_CONVERSATION];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    return conversations[0]?.id || INITIAL_CONVERSATION.id;
  });

  useEffect(() => {
    localStorage.setItem('questionaer_conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Active Voice
  const [activeVoice, setActiveVoice] = useState<VoiceName>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_voice') as VoiceName;
      if (['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].includes(saved)) {
        return saved;
      }
    }
    return 'Kore';
  });

  useEffect(() => {
    localStorage.setItem('questionaer_voice', activeVoice);
  }, [activeVoice]);

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isGoogleAuthModalOpen, setIsGoogleAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Chat generation states
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('gemini-3.8-flash');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isLoading]);

  // Actions
  const handleNewChat = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelId: model,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fresh = {
          ...INITIAL_CONVERSATION,
          id: `conv-${Date.now()}`,
        };
        setActiveConversationId(fresh.id);
        return [fresh];
      }
      if (activeConversationId === id) {
        setActiveConversationId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    // Update conversation immediately
    const updatedMessages = [...(activeConversation?.messages || []), userMsg];
    let newTitle = activeConversation?.title || 'New Conversation';
    if (activeConversation?.messages.length === 0 || activeConversation?.title === 'New Conversation') {
      newTitle = text.slice(0, 36).trim();
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              title: newTitle,
              updatedAt: new Date().toISOString(),
              messages: updatedMessages,
            }
          : c
      )
    );

    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          voiceMode: false,
        }),
      });

      const data = await response.json();
      const replyText = data.text || data.error || "I'm sorry, an issue occurred while generating the response.";

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                messages: [...c.messages, assistantMsg],
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const errMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: 'Unable to reach the server. Please check your internet connection and verify that the GEMINI_API_KEY is configured in Settings > Secrets.',
        timestamp: new Date().toISOString(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages: [...c.messages, errMsg] }
            : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    const msgs = [...activeConversation.messages];
    // Remove last assistant message
    if (msgs[msgs.length - 1].role === 'assistant') {
      msgs.pop();
    }
    const lastUserMsg = msgs[msgs.length - 1];
    if (!lastUserMsg) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...c, messages: msgs } : c))
    );

    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs,
        }),
      });
      const data = await response.json();
      const replyText = data.text || 'Could not regenerate response.';
      const newAssistantMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toISOString(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages: [...c.messages, newAssistantMsg] }
            : c
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptFromVoice = (userText: string, assistantReply: string) => {
    const userMsg: Message = {
      id: `msg-voice-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: Message = {
      id: `msg-voice-${Date.now() + 1}`,
      role: 'assistant',
      text: assistantReply,
      timestamp: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              messages: [...c.messages, userMsg, assistantMsg],
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
  };

  const handlePlanActivated = (planId: CorePlanId) => {
    setUser((prev) => ({
      ...prev,
      isCoreMember: true,
      activePlan: planId,
      planPurchasedAt: new Date().toISOString(),
    }));
  };

  const handleGoogleLogin = (profile: UserProfile) => {
    // If the logged in account is owner email, give free lifetime full access
    const ownerStatus =
      profile.email.toLowerCase().includes('tavi.1613@gmail.com') ||
      profile.email.toLowerCase().includes('tavii.1613@gmail.com');

    setUser({
      ...profile,
      isCoreMember: ownerStatus || profile.isCoreMember,
      activePlan: ownerStatus ? 'lifetime' : profile.activePlan,
    });
  };

  const handleSignOut = () => {
    setUser({
      id: 'guest',
      name: 'Guest User',
      email: 'guest@ouestionaer.ai',
      avatar: 'G',
      provider: 'guest',
      isCoreMember: false,
    });
  };

  const isCoreActive = isOwner || user.isCoreMember;

  return (
    <div className="flex h-screen w-full bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        user={user}
        isOwner={isOwner}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onOpenGoogleAuth={() => setIsGoogleAuthModalOpen(true)}
        onSignOut={handleSignOut}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-white dark:bg-stone-950">
        {/* Top Header */}
        <ChatHeader
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
          activeVoice={activeVoice}
          isOwner={isOwner}
          isCoreMember={isCoreActive}
        />

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto">
          {activeConversation?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-xl shadow-md">
                Q
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  What can I help you discover today?
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Ask questions, debug architecture, or launch Voice Assistant to speak naturally.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-1">
              {activeConversation?.messages.map((msg, idx) => {
                const isLastAssistant =
                  msg.role === 'assistant' &&
                  idx === (activeConversation?.messages.length ?? 0) - 1;

                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    activeVoice={activeVoice}
                    onRegenerate={handleRegenerate}
                    isLastAssistantMessage={isLastAssistant}
                  />
                );
              })}

              {/* Streaming loading indicator */}
              {isLoading && (
                <div className="py-4 px-4 sm:px-6 bg-stone-50/70 dark:bg-stone-900/40 border-y border-stone-100/80 dark:border-stone-800/60">
                  <div className="max-w-3xl mx-auto flex gap-4 items-center">
                    <div className="w-7 h-7 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-xs">
                      Q
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-stone-400 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-stone-400 animate-pulse delay-150" />
                      <div className="w-2 h-2 rounded-full bg-stone-400 animate-pulse delay-300" />
                      <span className="text-xs text-stone-400 ml-2">Ouestionaer is thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className="shrink-0 bg-gradient-to-t from-white via-white dark:from-stone-950 dark:via-stone-950 to-transparent pt-2">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
            model={model}
            onModelChange={setModel}
            showStarters={activeConversation?.messages.length === 0}
            onSelectStarter={(prompt) => handleSendMessage(prompt)}
          />
        </div>
      </div>

      {/* Voice Assistant Overlay */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        activeVoice={activeVoice}
        onVoiceChange={setActiveVoice}
        onSendTranscriptToChat={handleTranscriptFromVoice}
      />

      {/* Core Plan Upgrade Modal */}
      <CoreUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onPlanActivated={handlePlanActivated}
        userEmail={user.email}
        isOwner={isOwner}
      />

      {/* Google Auth Modal */}
      <GoogleAuthModal
        isOpen={isGoogleAuthModalOpen}
        onClose={() => setIsGoogleAuthModalOpen(false)}
        onLoginSuccess={handleGoogleLogin}
        currentUserEmail={OWNER_EMAIL}
      />
    </div>
  );
}
