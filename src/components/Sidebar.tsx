import React, { useState } from 'react';
import { Conversation, UserProfile } from '../types';
import {
  MessageSquare,
  Plus,
  Trash2,
  Sparkles,
  Search,
  LogOut,
  Crown,
  ChevronRight,
  ShieldCheck,
  Pin,
  Edit2,
  X,
  Check,
  LogIn,
  Mail,
} from 'lucide-react';
import { playClickPip } from '../utils/audio';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  user: UserProfile;
  isOwner: boolean;
  onOpenUpgradeModal: () => void;
  onOpenGoogleAuth: () => void;
  onSignOut: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  user,
  isOwner,
  onOpenUpgradeModal,
  onOpenGoogleAuth,
  onSignOut,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned = filteredConversations.filter((c) => c.isPinned);
  const unpinned = filteredConversations.filter((c) => !c.isPinned);

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-base shadow-xs">
                Q
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-stone-900 dark:text-stone-100">
                  Ouestionaer
                </span>
                <span className="ml-1 text-[10px] font-mono font-medium text-stone-400">
                  3.8 AI
                </span>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => {
              playClickPip();
              onNewChat();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold transition-colors shadow-2xs group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-stone-500 group-hover:text-stone-900 dark:group-hover:text-stone-100" />
              <span>New Conversation</span>
            </div>
            <kbd className="hidden sm:inline-block font-mono text-[10px] text-stone-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Search box */}
          {conversations.length > 3 && (
            <div className="relative px-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/80 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
              />
            </div>
          )}

          {/* Pinned Section */}
          {pinned.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                <Pin className="w-3 h-3" />
                <span>Pinned</span>
              </div>
              {pinned.map((conv) => renderConvItem(conv))}
            </div>
          )}

          {/* Recent Conversations */}
          <div className="space-y-1">
            {pinned.length > 0 && (
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Recent
              </div>
            )}
            {unpinned.length === 0 && pinned.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400">
                No conversations yet
              </div>
            ) : (
              unpinned.map((conv) => renderConvItem(conv))
            )}
          </div>
        </div>

        {/* Bottom Section: Core Upgrade + User Account */}
        <div className="p-3 border-t border-stone-100 dark:border-stone-800 shrink-0 space-y-2">
          {/* Core Plan Banner */}
          {isOwner ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Owner Access
                  </div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400">
                    Free Forever · Full Privileges
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-600 text-white">
                VIP
              </span>
            </div>
          ) : user.isCoreMember ? (
            <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Core Member
                  </div>
                  <div className="text-[10px] text-stone-500">
                    All Neural Voices & High-Speed AI
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                playClickPip();
                onOpenUpgradeModal();
              }}
              className="w-full p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300 dark:border-amber-800/80 hover:border-amber-400 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Upgrade to Core
                    </div>
                    <div className="text-[10px] text-stone-500">
                      Starting ₹599 · UPI, Paytm, Cards
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {/* User Profile / Auth State */}
          {user.provider !== 'guest' ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full ${
                    isOwner
                      ? 'bg-amber-600'
                      : user.provider === 'google'
                      ? 'bg-blue-600'
                      : 'bg-emerald-600'
                  } text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                >
                  {user.avatar || (user.name ? user.name[0].toUpperCase() : 'U')}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate flex items-center gap-1.5">
                    <span className="truncate">{user.name}</span>
                    {isOwner && (
                      <span className="text-[9px] px-1.5 py-0.2 bg-amber-500 text-stone-950 font-black rounded uppercase tracking-wider">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={onSignOut}
                title="Sign out"
                className="p-1.5 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                playClickPip();
                onOpenGoogleAuth();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700/80 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors shadow-2xs"
            >
              <LogIn className="w-4 h-4 text-stone-600 dark:text-stone-300" />
              <span>Log In / Create Account</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );

  function renderConvItem(conv: Conversation) {
    const isActive = activeConversationId === conv.id;
    const isEditing = editingId === conv.id;

    if (isEditing) {
      return (
        <div key={conv.id} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center gap-1.5">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded text-stone-900 dark:text-stone-100 focus:outline-hidden"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename(conv.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
          <button
            onClick={() => saveRename(conv.id)}
            className="p-1 text-emerald-600 hover:text-emerald-700"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditingId(null)}
            className="p-1 text-stone-400 hover:text-stone-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        onClick={() => {
          playClickPip();
          onSelectConversation(conv.id);
          onCloseMobile();
        }}
        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-colors ${
          isActive
            ? 'bg-stone-100 dark:bg-stone-800/90 text-stone-900 dark:text-stone-100 font-medium'
            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/40 hover:text-stone-900 dark:hover:text-stone-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1">
          <MessageSquare className="w-3.5 h-3.5 shrink-0 text-stone-400 group-hover:text-stone-600" />
          <span className="truncate">{conv.title}</span>
        </div>

        {/* Hover Action controls */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(conv.id);
            }}
            title={conv.isPinned ? 'Unpin chat' : 'Pin chat'}
            className="p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
          >
            <Pin className={`w-3 h-3 ${conv.isPinned ? 'fill-current text-amber-500' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startRename(conv);
            }}
            title="Rename chat"
            className="p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          {conversations.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.id);
              }}
              title="Delete chat"
              className="p-1 text-stone-400 hover:text-rose-600"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }
};
