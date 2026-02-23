import React, { useState, useRef, useEffect } from 'react';
import { ChatMessageComponent } from './ChatMessage';
import { SendIcon, MicrophoneIcon, StopMicrophoneIcon } from './Icons';
import { type ChatMessage, Role } from '../types';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  disabled: boolean;
  chatMode: 'bot' | 'admin';
  isChatOpen: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, disabled, chatMode, isChatOpen }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseTextRef = useRef('');
  const prevIsChatOpenRef = useRef(isChatOpen);
  const speechEndTimeoutRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isLoading]);

  useEffect(() => {
    if (!prevIsChatOpenRef.current && isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300); // Small delay to ensure the element is visible and focusable
    }
    prevIsChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);
  
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }

      let final_transcript = '';
      let interim_transcript = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        } else {
          interim_transcript += event.results[i][0].transcript;
        }
      }
      const separator = baseTextRef.current ? ' ' : '';
      setInput(baseTextRef.current + separator + final_transcript + interim_transcript);

      speechEndTimeoutRef.current = window.setTimeout(() => {
        recognitionRef.current?.stop();
      }, 1000);
    };

    recognition.onend = () => {
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }
      setIsListening(false);
    };

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const prevIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      inputRef.current?.focus();
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      if (isListening) {
        recognitionRef.current?.stop();
      }
      inputRef.current?.focus();
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      console.error("Speech recognition is not available.");
      return;
    }

    if (isListening) {
      if (speechEndTimeoutRef.current) {
        clearTimeout(speechEndTimeoutRef.current);
      }
      recognitionRef.current.stop();
    } else {
      baseTextRef.current = input.trim();
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const getPlaceholderText = () => {
    if (isLoading) return "Bot is thinking...";
    if (disabled) return "Chat is currently unavailable.";
    if (chatMode === 'admin') return "Ask a question or use the mic...";
    return "Type your message or use the mic...";
  };

  return (
    <div id="rhysley-chat-pannel" className="w-full flex flex-col flex-grow bg-transparent shadow-lg min-h-0">
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
        {messages.map((msg) => (
          // [*** MODIFIED ***] Pass the onSendMessage prop
          <ChatMessageComponent key={msg.id} message={msg} onSendMessage={onSendMessage} />
        ))}
        {isLoading && (
            <ChatMessageComponent
                message={{
                    id: 'typing-indicator',
                    role: Role.MODEL,
                    text: 'typing...',
                    createdAt: new Date().toISOString(),
                }}
            />
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-gray-700/70 bg-dark-card backdrop-blur" style={{backgroundColor: 'var(--color-dark-card)'}}>
        <form onSubmit={handleSend} className="w-full">
          <div className="relative flex items-center bg-gray-700 rounded-full shadow-lg">
            <button
              type="button"
              onClick={handleMicClick}
              disabled={disabled}
              className={`absolute left-0 ml-2 p-2 sm:p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                ${isListening ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}
              `}
              aria-label={isListening ? 'Stop listening' : 'Use microphone'}
            >
              {isListening ? <StopMicrophoneIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
            </button>
            <input
              ref={inputRef}
              id="rhysley-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={getPlaceholderText()}
              disabled={disabled}
              className="w-full py-2 sm:py-3 pl-12 pr-12 bg-blue-50/10 text-blue-50 focus:outline-none disabled:opacity-50 placeholder-blue-200/80 text-sm sm:text-base rounded-full border border-blue-400/20 focus:border-blue-300/70 focus:bg-blue-50/15 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || disabled}
              className="absolute right-0 mr-2 p-2 sm:p-3 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Send message"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};