

import React, { useState, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { type ChatMessage, Role } from '../types';
import { BotIcon, UserIcon, LoadingSpinner, AdminIcon } from './IconComponents';

interface ChatMessageProps {
  message: ChatMessage;
  // Add onSendMessage to handle button clicks
  onSendMessage?: (text: string) => void;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, onSendMessage }) => {
  const [choicesUsed, setChoicesUsed] = useState(false);
  const [typingDots, setTypingDots] = useState('...');

  useEffect(() => {
    if (message.text === 'typing...') {
      const intervalId = setInterval(() => {
        setTypingDots(dots => dots.length >= 3 ? '.' : dots + '.');
      }, 400);
      return () => clearInterval(intervalId);
    }
  }, [message.text]);

  const isUser = message.role === Role.USER;
  const isBot = message.role === Role.MODEL;
  const isAdmin = message.role === Role.ADMIN;

  const renderedHtml = useMemo(() => {
    if (!message.text || message.text === 'typing...') return '';

    let cleanText = message.text;
    // Marked does not work correctally for stream style text so I added some regex to fix it.
    // You can implement regex in server side too but I prefer to do it here.
    // I have to found more robust way to fix it but for now regex is robust enough.

    // =================================================================================
    // CLIENT-SIDE FORMATTING FIXES
    // =================================================================================
    // 1. Unicode Bullet Fix
    // Detects a colon or punctuation, followed by a '•' bullet.
    // Converts "following:• Keep" -> "following:\n\n- Keep"
    // matches: (: or . or ? or ! or ) -> optional space -> • -> optional space
    cleanText = cleanText.replace(/([:;.?!)])\s*•\s*/g, '$1\n\n- ');

    // 2. Header Break Fix
    // Fixes: "...overheating. Please Do That: ..." -> "...overheating.\n\nPlease Do That: ..."
    // Explanation:
    // ([.?!)])                  -> Group 1: Punctuation ending previous sentence
    // \s*                       -> Zero or more spaces
    // ([A-Z][a-zA-Z0-9\s]{1,50}:) -> Group 2: A "Header" phrase. Starts with Capital, allows text/spaces, ends with colon.
    //                              Max 50 chars to avoid matching long sentences that happen to have a colon.
    cleanText = cleanText.replace(/([.?!)])\s*([A-Z][a-zA-Z0-9\s]{1,50}:)/g, '$1\n\n$2');

    // 3. The "Sandwich" Fix (Fallback for tight spacing)
    // Punctuation + "Word:" + List Item (e.g. "overheating.Please:1. Check")
    cleanText = cleanText.replace(/([.?!)])\s*([A-Z][a-z]+:)\s*(\d+\.|[-*])\s*/g, '$1\n\n$2\n\n$3 ');

    // 4. Standard Numeric List Fix
    // Fixes: "text.2. Next" -> "text.\n\n2. Next"
    cleanText = cleanText.replace(/([.?!)])\s*(\d+\.)\s/g, '$1\n\n$2 ');

    // 5. Aggressive Bullet List Fixing
    // Looks for period/punctuation, optional space, then a bullet.
    // "text.- Item" -> "text.\n\n- Item"
    cleanText = cleanText.replace(/([.?!)])\s*([-*])\s/g, '$1\n\n$2 ');

    // 6. Colon Lists
    // "Please:Check" -> "Please:\n\nCheck"
    cleanText = cleanText.replace(/(:)\s*(?=[A-Z0-9*-])/g, '$1\n\n');

    // =================================================================================

    try {
      const rawHtml = marked.parse(cleanText) as string;
      // Sanitize to prevent XSS (Good practice)
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      console.error("Markdown parsing error:", e);
      return message.text;
    }
  }, [message.text]);

  const handleChoiceClick = (choice: string) => {
    if (onSendMessage) {
      onSendMessage(choice);
      setChoicesUsed(true); // Disable the buttons
    }
  };

  const createMarkup = () => ({ __html: renderedHtml });

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // Checks if the date is valid
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (message.role === Role.MODEL && message.text === "") {
    return (
      <div className="flex items-start gap-4 my-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-black">
          <LoadingSpinner className="w-5 h-5" />
        </div>
        <div className="max-w-xl p-4 rounded-2xl rounded-bl-none bg-white dark:bg-dark-card animate-pulse">
          <div className="h-4 w-48 bg-gray-300 dark:bg-slate-600 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-4 my-4 w-full ${isUser ? 'justify-end' : ''}`}>
      {(isBot || isAdmin) && (
        // adding top margin to align chatbot icon
        <div style={{ marginTop: '1.12rem' }}>
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
        text-white
        ${isAdmin ? 'bg-green-600' : 'bg-brand-primary'}
      `}
          >
            {isBot && <BotIcon className="w-5 h-5" />}
            {isAdmin && <AdminIcon className="w-5 h-5" />}
          </div>
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-xl min-w-0`}>
        <div
          className={`p-4 rounded-2xl 
            ${isUser && 'bg-brand-primary text-black rounded-br-none'}
            ${isAdmin && 'bg-green-100 dark:bg-green-900/50 rounded-bl-none'}
            ${isBot && 'bg-white dark:bg-dark-card rounded-bl-none'}
          `}
        >
          {message.text === 'typing...' ? (
            <div className="chat-bubble-bot">typing{typingDots}</div>
          ) : (
            <div className="chat-bubble-bot" dangerouslySetInnerHTML={createMarkup()} />
          )}

          {message.choices && message.choices.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(choice)}
                  disabled={choicesUsed}
                  className="px-4 py-2 text-sm font-semibold border-2 border-brand-primary text-brand-primary rounded-full hover:bg-brand-primary hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-500 disabled:border-gray-500 disabled:text-white"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp Display */}
        {message.createdAt && (
          <span className={`text-[10px] text-gray-500 dark:text-gray-400 mt-1 px-1`}>
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      {isUser && (
        <div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
        </div>
      )}
    </div>
  );
};