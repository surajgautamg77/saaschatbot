

import React from 'react';
import { LiveUser } from '../types';
import { UserIcon, AlertTriangleIcon } from './Icons';
import { BellRing } from 'lucide-react';

interface MyChatsPanelProps {
  myChats: LiveUser[];
  activeSessionId: string | null;
  onSelectUser: (sessionId: string) => void;
  error?: string | null;
  unreadSessions: Set<string>;
  ringingSessionId: string | null;
}

export const MyChatsPanel: React.FC<MyChatsPanelProps> = ({ myChats, activeSessionId, onSelectUser, error, unreadSessions, ringingSessionId }) => {
  return (
    // ✅ This outer container is now a flex column that will NOT shrink.
    <div className="bg-dark-card rounded-xl shadow-lg flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">My Active Chats ({myChats.length})</h2>
      </div>
      {/* ✅ This inner container handles the scrolling. */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {error && <p className="p-4 text-red-400">Error: {error}</p>}
        {myChats.length === 0 && !error ? (
          <p className="p-4 text-gray-400 text-center">You have no assigned chats.</p>
        ) : (
          // The list itself is unchanged.
          <ul className="divide-y divide-gray-700">
            {myChats.map((user) => {
              const isUnread = unreadSessions.has(user.sessionId);
              return (
                <li key={user.sessionId}>
                  <div
                    onClick={() => onSelectUser(user.sessionId)}
                    className={`w-full text-left p-4 hover:bg-gray-700/50 transition-all duration-300 cursor-pointer 
                      ${activeSessionId === user.sessionId ? 'border-l-4 border-yellow-500' : ''} ${user.chatStatus === 'RED' || user.status === 'admin' ? 'bg-red-900/50' : user.chatStatus === 'YELLOW' ? 'bg-yellow-900/50' : user.chatStatus === 'GREEN' ? 'bg-green-900/50' : ''}
                      ${isUnread ? 'unread-highlight' : ''}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full shrink-0 mt-1 ${user.chatStatus === 'RED' ? 'bg-red-500' : user.chatStatus === 'YELLOW' ? 'bg-yellow-500' : user.chatStatus === 'GREEN' ? 'bg-green-500' : 'bg-gray-500'}`}>
                         <UserIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        {user.chatStatus === 'RED' && (<div className="mb-1 text-xs font-bold text-red-400 flex items-center"><AlertTriangleIcon className="w-4 h-4 mr-1"/> LIVE AGENT REQUESTED</div>)}
                        {user.chatStatus === 'YELLOW' && (<div className="mb-1 text-xs font-bold text-yellow-300 flex items-center"><UserIcon className="w-4 h-4 mr-1"/> CONTACT INFO RECEIVED</div>)}
                         <p className={`font-semibold truncate ${activeSessionId === user.sessionId ? 'text-white' : 'text-gray-200'}`}>
                          {user.sessionNumber ? `User #${user.sessionNumber}` : `User from ${user.location || 'Unknown'}`}
                          {user.sessionId === ringingSessionId && <BellRing className="w-4 h-4 ml-2 text-yellow-400 inline-block animate-pulse" />}
                        </p>
                        <p className={`text-xs font-bold truncate ${activeSessionId === user.sessionId ? 'text-purple-300' : 'text-purple-400'}`}>Brand: {user.bot.name}</p>
                        <p className={`text-sm italic truncate ${activeSessionId === user.sessionId ? 'text-gray-300' : 'text-gray-400'}`}>
                          "{user.lastMessage}"
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};