import React, { useState, useMemo, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { type ChatMessage, Role } from '../types';
import { BotIcon, UserIcon, LoadingSpinner, AdminIcon } from './IconComponents';
import { SendIcon } from './Icons';

interface ChatMessageProps {
  message: ChatMessage;
  onSendMessage?: (text: string) => void;
}

const LinkButton: React.FC<{ url: string }> = ({ url }) => {
  const onButtonClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const displayUrl = url.length > 30 ? url.substring(0, 27) + '...' : url;

  return (
    <div
      onClick={onButtonClick}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg my-2 shadow cursor-pointer"
    >
      <div className="flex flex-nowrap items-center justify-between p-2 pb-0">
        <p className="text-gray-700 dark:text-gray-300 truncate min-w-0 mr-2 max-w-[65%] sm:max-w-[70%]">
          {displayUrl}
        </p>

        <button
          className="flex items-center justify-center"
          title="Open Link"
        >
          <SendIcon className="w-4 h-4 text-brand-primary relative -top-[4px]" />
        </button>
      </div>
    </div>
  )

};

const formatMessageText = (text: string): string => {
  if (!text) return '';
  let cleanText = text;

  // ===== Client-side formatting fixes =====
  cleanText = cleanText.replace(/([:;.?!)])\s*•\s*/g, '$1\n\n- ');
  cleanText = cleanText.replace(
    /([.?!)])\s*([A-Z][a-zA-Z0-9\s]{1,50}:)/g,
    '$1\n\n$2'
  );
  cleanText = cleanText.replace(
    /([.?!)])\s*([A-Z][a-z]+:)\s*(\d+\.|[-*])\s*/g,
    '$1\n\n$2\n\n$3 '
  );
  cleanText = cleanText.replace(/([.?!)])\s*(\d+\.)\s/g, '$1\n\n$2 ');
  cleanText = cleanText.replace(/([.?!)])\s*([-*])\s/g, '$1\n\n$2 ');
  cleanText = cleanText.replace(/(:)\s*(?=[A-Z0-9*-])/g, '$1\n\n');

  try {
    const rawHtml = marked.parse(cleanText) as string;
    return DOMPurify.sanitize(rawHtml);
  } catch (e) {
    console.error('Markdown parsing error:', e);
    return text;
  }
};

marked.setOptions({
  gfm: true,
  breaks: true,
});

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  onSendMessage,
}) => {
  const [choicesUsed, setChoicesUsed] = useState(false);
  const [typingDots, setTypingDots] = useState('...');

  useEffect(() => {
    if (message.text === 'typing...') {
      const intervalId = setInterval(() => {
        setTypingDots((dots) => (dots.length >= 3 ? '.' : dots + '.'));
      }, 400);
      return () => clearInterval(intervalId);
    }
  }, [message.text]);

  const isUser = message.role === Role.USER;
  const isBot = message.role === Role.MODEL;
  const isAdmin = message.role === Role.ADMIN;
  const isSystem = message.role === Role.SYSTEM;

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const renderMessageWithLinks = () => {
    if (!message.text) return null;

    const parts = message.text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return <LinkButton key={index} url={part} />;
      } else {
        if (part.trim() === '') return null;
        const cleanHtml = formatMessageText(part);
        return (
          <div
            key={index}
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
        );
      }
    });
  };

  const containsLink = useMemo(() => {
    return message.text ? urlRegex.test(message.text) : false;
  }, [message.text]);

  const renderedHtml = useMemo(() => {
    if (!message.text || message.text === 'typing...') return '';
    return formatMessageText(message.text);
  }, [message.text]);

  const handleChoiceClick = (choice: string) => {
    onSendMessage?.(choice);
    setChoicesUsed(true);
  };

  const createMarkup = () => ({ __html: renderedHtml });

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (message.role === Role.MODEL && message.text === '') {
    return (
      <div className="flex items-start gap-2 my-4 w-full">
        <div className="max-w-xl w-full p-4 rounded-2xl bg-white dark:bg-dark-card animate-pulse">
          <div className="h-4 w-48 bg-gray-300 dark:bg-slate-600 rounded" />
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="text-center my-2">
        <span className="text-xs text-gray-500 italic px-2 py-1 rounded">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex my-4 w-full ${isUser ? 'justify-end' : 'justify-start'
        }`}
    >
      <div
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'
          } max-w-[85vw] sm:max-w-xl min-w-0`}
      >
        <div
          className={`relative p-3 sm:p-4 rounded-2xl shadow-lg
            ${isUser && 'bg-white text-black rounded-br-none'}
            ${isAdmin && 'bg-brand-primary text-white rounded-bl-none'}
            ${isBot && 'bg-brand-primary text-white rounded-bl-none'}
          `}
        >
          {(isBot || isAdmin) && (
            <div
              className={`absolute -top-3 -left-3 w-8 h-8 shadow-lg rounded-full flex items-center justify-center text-white
                ${isAdmin ? 'bg-green-700' : 'bg-green-700'}
              `}
            >
              {isBot && <BotIcon className="w-4 h-4" />}
              {isAdmin && <AdminIcon className="w-4 h-4" />}
            </div>
          )}

          {isUser && (
            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-gray-700 dark:text-gray-200" />
            </div>
          )}

          {message.text === 'typing...' ? (
            <div className="chat-bubble-bot">typing{typingDots}</div>
          ) : containsLink ? (
            <div className="chat-bubble-bot">{renderMessageWithLinks()}</div>
          ) : (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={createMarkup()}
            />
          )}

          {message.choices && message.choices.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(choice)}
                  disabled={choicesUsed}
                  className="px-4 py-2 text-sm font-semibold border-2 border-brand-primary text-brand-primary rounded-full hover:bg-brand-primary hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
        </div>

        {message.createdAt && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 px-1">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
};
