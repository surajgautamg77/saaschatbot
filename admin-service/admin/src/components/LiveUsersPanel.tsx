

import React from 'react';
import { LiveUser, User } from '../types';
import { UserIcon, BotIcon, AlertTriangleIcon } from './Icons'; 
import { BellRing } from 'lucide-react';

interface LiveUsersPanelProps {
  users: LiveUser[];
  activeSessionId: string | null;
  onSelectUser: (sessionId: string) => void;
  currentUser: User | null;
  onlineAgents: User[];
  onAssign: (sessionId: string, agentId: string) => void;
  error?: string | null;
  unreadSessions: Set<string>;
  ringingSessionId: string | null;
}

const getBrowserFromAgent = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edg')) return 'Edge';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    return 'Unknown';
};

export const LiveUsersPanel: React.FC<LiveUsersPanelProps> = ({ users, activeSessionId, onSelectUser, currentUser, onlineAgents, onAssign, error, unreadSessions, ringingSessionId }) => {

  const handleAssignClick = (e: React.MouseEvent | React.ChangeEvent<HTMLSelectElement>, sessionId: string, agentId: string) => {
    e.stopPropagation(); // Prevent the main div's onClick from firing
    onAssign(sessionId, agentId);
  };

  return (
    <div className="bg-dark-card rounded-xl shadow-lg flex flex-col flex-1 min-h-0">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">Live Users ({users.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {error && <p className="p-4 text-red-400">Error: {error}</p>}
        {users.length === 0 && !error ? (
          <p className="p-4 text-gray-400 text-center">No other active users.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {users.map((user) => {
              const isUnread = unreadSessions.has(user.sessionId);
              const isReassigning = user.isToReassign;
              const cardClasses = [
                'w-full text-left p-4 hover:bg-gray-700/50 transition-all duration-300 cursor-pointer',
                activeSessionId === user.sessionId ? 'border-l-4 border-yellow-500' : '',
                isUnread ? 'unread-highlight' : '',
                isReassigning ? 'animate-pulse bg-red-500' : 
                  user.chatStatus === 'RED' || user.status === 'admin' ? 'bg-red-900/50' : 
                  user.chatStatus === 'YELLOW' ? 'bg-yellow-900/50' : 
                  user.chatStatus === 'GREEN' ? 'bg-green-900/50' : ''
              ].join(' ');

              return (
                <li key={user.sessionId}>
                  <div onClick={() => onSelectUser(user.sessionId)} className={cardClasses}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full shrink-0 mt-1 ${user.chatStatus === 'RED' ? 'bg-red-500' : user.chatStatus === 'YELLOW' ? 'bg-yellow-500' : user.chatStatus === 'GREEN' ? 'bg-green-500' : 'bg-gray-500'}`}>
                        {user.chatStatus === 'RED' ? <AlertTriangleIcon className="w-5 h-5 text-white" /> : user.chatStatus === 'YELLOW' ? <UserIcon className="w-5 h-5 text-white" /> : user.status === 'admin' ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-white" />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        {user.chatStatus === 'RED' && (<div className="mb-1 text-xs font-bold text-red-400 flex items-center"><AlertTriangleIcon className="w-4 h-4 mr-1"/> LIVE AGENT REQUESTED</div>)}
                        {user.chatStatus === 'YELLOW' && (<div className="mb-1 text-xs font-bold text-yellow-300 flex items-center"><UserIcon className="w-4 h-4 mr-1"/> CONTACT INFO RECEIVED</div>)}
                        <p className={`font-semibold truncate ${isReassigning || activeSessionId === user.sessionId ? 'text-white' : 'text-gray-200'}`}>{user.visitor?.name || (user.sessionNumber ? `User #${user.sessionNumber}` : `User from ${user.location || 'Unknown'}`)}
                        {user.sessionId === ringingSessionId && <BellRing className="w-4 h-4 ml-2 text-yellow-400 inline-block animate-pulse" />}
                        </p>
                        {user.visitor?.email && <p className={`text-xs truncate ${isReassigning ? 'text-white' : (activeSessionId === user.sessionId ? 'text-blue-300' : 'text-blue-400')}`}>Email: {user.visitor.email}</p>}
                        {user.visitor?.phone && <p className={`text-xs truncate ${isReassigning ? 'text-white' : (activeSessionId === user.sessionId ? 'text-green-300' : 'text-green-400')}`}>Phone: {user.visitor.phone}</p>}
                        <p className={`text-xs font-bold truncate ${isReassigning ? 'text-white' : (activeSessionId === user.sessionId ? 'text-purple-300' : 'text-purple-400')}`}>Brand: {user.bot.name}</p>
                        <p className={`text-sm italic truncate ${isReassigning ? 'text-white' : (activeSessionId === user.sessionId ? 'text-gray-300' : 'text-gray-400')}`}>"{user.lastMessage}"</p>
                         <p className={`mt-2 text-xs truncate ${isReassigning ? 'text-white' : (activeSessionId === user.sessionId ? 'text-gray-400' : 'text-gray-500')}`}>{user.ip} &bull; {getBrowserFromAgent(user.userAgent)}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-right">
                      {user.assignedTo ? (
                        <div className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-1 rounded-full inline-block">
                          Assigned to: {user.assignedTo.email.split('@')[0]}
                        </div>
                      ) : (
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleAssignClick(e, user.sessionId, e.target.value);
                            e.target.value = "";
                          }}
                          onClick={(e) => e.stopPropagation()}
                          defaultValue=""
                          className="px-3 py-1 bg-gray-600 text-white text-xs font-semibold rounded-lg hover:bg-gray-500 appearance-none text-center cursor-pointer"
                        >
                          <option value="" disabled>Assign to...</option>
                          {onlineAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.email}
                            </option>
                          ))}
                        </select>
                      )}
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