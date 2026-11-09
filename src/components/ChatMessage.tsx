import React, { useState } from 'react';
import { Message, VoiceName } from '../types';
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import { speakText, stopSpeaking } from '../utils/speech';

interface ChatMessageProps {
  message: Message;
  activeVoice: VoiceName;
  onRegenerate?: () => void;
  isLastAssistantMessage?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  activeVoice,
  onRegenerate,
  isLastAssistantMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    speakText(
      message.text,
      activeVoice,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  };

  // Render markdown text and syntax-highlighted code blocks
  const renderFormattedContent = (content: string) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      // Preceding text
      if (matchIndex > lastIndex) {
        parts.push(
          <div key={`text-${lastIndex}`} className="space-y-2">
            {renderMarkdownParagraphs(content.substring(lastIndex, matchIndex))}
          </div>
        );
      }

      // Code block
      const language = match[1] || 'plaintext';
      const codeSnippet = match[2];
      parts.push(
        <CodeBlock key={`code-${matchIndex}`} language={language} code={codeSnippet} />
      );

      lastIndex = matchIndex + match[0].length;
    }

    // Trailing text
    if (lastIndex < content.length) {
      parts.push(
        <div key={`text-${lastIndex}`} className="space-y-2">
          {renderMarkdownParagraphs(content.substring(lastIndex))}
        </div>
      );
    }

    return parts;
  };

  const renderMarkdownParagraphs = (rawText: string) => {
    const lines = rawText.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={idx} className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-3 mb-1">
            {line.replace('# ', '')}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={idx} className="text-base font-semibold text-stone-900 dark:text-stone-100 mt-2 mb-1">
            {line.replace('## ', '')}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-sm font-semibold text-stone-900 dark:text-stone-100 mt-2 mb-1">
            {line.replace('### ', '')}
          </h3>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={idx} className="ml-4 list-disc text-xs text-stone-800 dark:text-stone-200 my-0.5 leading-relaxed">
            {formatInline(line.substring(2))}
          </li>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={idx} className="border-l-2 border-stone-300 dark:border-stone-700 pl-3 py-0.5 italic text-xs text-stone-600 dark:text-stone-400 my-1.5">
            {formatInline(line.replace('> ', ''))}
          </blockquote>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={idx} className="h-1.5" />);
      } else {
        elements.push(
          <p key={idx} className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed my-1">
            {formatInline(line)}
          </p>
        );
      }
    });

    return elements;
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 font-mono text-[11px] bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded border border-stone-200 dark:border-stone-700"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-stone-900 dark:text-stone-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={`group w-full py-4 px-4 sm:px-6 transition-colors ${
        isUser
          ? 'bg-transparent'
          : 'bg-stone-50/70 dark:bg-stone-900/40 border-y border-stone-100/80 dark:border-stone-800/60'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-4 items-start">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center shadow-2xs">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-xs shadow-xs">
              Q
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              {isUser ? 'You' : 'Ouestionaer'}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-stone-400">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="text-xs space-y-1">
            {renderFormattedContent(message.text)}
          </div>

          {/* Assistant Action Bar */}
          {!isUser && (
            <div className="pt-2 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleSpeak}
                title={isSpeaking ? 'Stop speech' : `Read aloud with ${activeVoice}`}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  isSpeaking
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Voice ({activeVoice})</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopy}
                title="Copy response"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {isLastAssistantMessage && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  title="Regenerate response"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-900 text-stone-100 overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-stone-950/70 border-b border-stone-800 text-[11px] font-mono text-stone-400">
        <span>{language}</span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1 text-stone-400 hover:text-stone-200 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied!' : 'Copy Code'}</span>
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};
