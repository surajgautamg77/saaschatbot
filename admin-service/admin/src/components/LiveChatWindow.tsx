
import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, Role, User, LiveUser, Note } from '../types';
import { ChatMessageComponent } from './ChatMessage';
import { SendIcon, SparklesIcon, FileIcon, MessageSquareIcon, ArrowRightIcon } from './Icons';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-toastify';

interface LiveChatWindowProps {
  messages: ChatMessage[];
  sessionId: string | null;
  sessionStatus: 'bot' | 'admin';
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onAssignToSelf: () => void;
  onTransfer: (targetAgentId: string) => Promise<void>;
  onReturnToBot: () => Promise<void>;
  currentUser: User | null;
  assignedAgent: { id: string; email: string; } | null;
  allTeamMembers: User[];
  activeLiveUser: LiveUser | null;
  privateNotes: Note[];
  isSessionActionable: boolean;
}

export const LiveChatWindow: React.FC<LiveChatWindowProps> = ({
  messages, sessionId, sessionStatus, isLoading,
  onSendMessage, onAssignToSelf, onTransfer, onReturnToBot,
  currentUser, assignedAgent, allTeamMembers,
  privateNotes,
  activeLiveUser,
  isSessionActionable
}) => {
  console.log("[LiveChatWindow] sessionId prop:", sessionId);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);
  const notesScrollContainerRef = useRef<HTMLDivElement>(null);
  const mainContentScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [noteInput, setNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'notes') {
      notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, privateNotes, activeTab]);

  useEffect(() => {
    console.log("[LiveChatWindow] useEffect triggered by sessionId change:", sessionId);
    setInput('');
    setNoteInput('');
    setActiveTab('chat');
  }, [sessionId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && sessionId && isSessionActionable) {
      onSendMessage(input.trim());
      setInput('');
      chatInputRef.current?.focus();
    }
  };

  const handleAssist = async () => {
    if (!sessionId || isThinking || !isSessionActionable) return; // Use isSessionActionable
    setIsThinking(true);
    try {
      const response = await apiClient.post<{ suggestion: string }>('/live-chat/admin-assist', { sessionId });
      setInput(response.suggestion);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get suggestion.";
      alert(`Error: ${message}`);
    } finally { setIsThinking(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim() || !sessionId || !isSessionActionable) return; // Use isSessionActionable
    setIsSubmittingNote(true);
    try {
      await apiClient.post('/live-chat/notes', { sessionId, text: noteInput.trim() });
      setNoteInput('');
      // The note will be added via WebSocket, no need for optimistic update here.
    } catch (error) {
      alert(`Failed to add note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const formatNoteTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short'
    });
  };

  const isAssignedToCurrentUser = !!(assignedAgent && currentUser && assignedAgent.id === currentUser.id);
  const isUnassigned = !assignedAgent;
  const canSendMessage = isAssignedToCurrentUser && isSessionActionable;

  
  const placeholderText = () => {
    if (!isSessionActionable) return 'Session is no longer active or accessible.';
    if (isUnassigned) return 'Assign this chat to yourself to reply.';
    if (!isAssignedToCurrentUser) return `Chat is currently handled by ${assignedAgent?.email || 'another agent'}.`;
    return 'Type a message or use the AI assistant...';
  };
  
  const otherAgents = allTeamMembers.filter(member => member.id !== currentUser?.id);

  if (!sessionId) {
    return (<div className="flex-1 flex items-center justify-center bg-dark-card rounded-xl shadow-lg"><p className="text-gray-400 text-lg">Select a user to begin chat.</p></div>);
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-card rounded-xl shadow-lg min-h-0">
        {/* --- HEADER SECTION --- */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
            <div>
                <h3 className="text-lg font-bold text-white">Chat with User #{activeLiveUser?.sessionNumber || sessionId?.substring(0, 8)}</h3>
                {activeLiveUser?.bot?.name && (
                    <span className="text-sm text-gray-400 mt-1">Brand: {activeLiveUser.bot.name}</span>
                )}
                <span className={`ml-2 px-3 py-1 text-xs font-semibold rounded-full mt-1 inline-block ${ assignedAgent ? 'bg-green-500 text-white' : 'bg-blue-500 text-white' }`}>
                    {assignedAgent ? `Handled by: ${assignedAgent.email.split('@')[0]}` : 'Handled by Bot'}
                </span>
            </div>

            {/* ✅ THIS IS THE FINALIZED LOGIC FOR THE ACTION BUTTONS */}
            <div className="flex items-center gap-2">
                {/* Condition 1: Show "Assign to Me" if the chat is unassigned */}
                {isUnassigned && isSessionActionable && (
                    <button onClick={() => {onAssignToSelf(); toast.dismiss();}} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                        Assign to Me
                    </button>
                )}
                
                {/* Condition 2: Show "Return/Transfer" if the chat is assigned to the current user */}
                {isAssignedToCurrentUser && isSessionActionable && (
                    <>
                        <button onClick={onReturnToBot} className="px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700">
                            Return to Bot
                        </button>
                        <select
                            onChange={(e) => { if (e.target.value) onTransfer(e.target.value); e.target.value = ""; }}
                            defaultValue=""
                            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 appearance-none text-center cursor-pointer"
                            disabled={otherAgents.length === 0}
                        >
                            <option value="" disabled>{otherAgents.length > 0 ? 'Transfer...' : 'No Agents Online'}</option>
                            {otherAgents.map(agent => ( <option key={agent.id} value={agent.id}>{agent.email}</option> ))}
                        </select>
                    </>
                )}
                {/* Note: If the chat is assigned to SOMEONE ELSE, no buttons are shown, which is correct. */}
            </div>
        </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="flex border-b border-gray-700">
        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>
          <MessageSquareIcon className="w-4 h-4" /> Chat
        </button>
        <button onClick={() => setActiveTab('notes')} className={`flex-1 py-2 text-sm font-semibold flex items-center justify-center gap-2 ${activeTab === 'notes' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400'}`}>
          <FileIcon className="w-4 h-4" /> Whisper Notes ({privateNotes.length})
        </button>
      </div>

      {/* --- MAIN CONTENT AREA (conditionally renders Chat or Notes) --- */}
      <div ref={mainContentScrollRef} className="flex-1 overflow-y-auto">
            {activeTab === 'chat' ? (
                <div className="p-6">
                    {isLoading ? <p>Loading...</p> : messages.map((msg) => <ChatMessageComponent key={msg.id} message={msg} />)}
                    <div ref={messagesEndRef} />
                </div>
            ) : (
                // [+++ THIS IS THE NEW NOTES DISPLAY LOGIC +++]
                <div className="p-6 bg-yellow-900/10 h-full">
                    <h3 className="font-bold text-yellow-300 mb-4">Internal Notes (Visible to team only)</h3>
                    <div className="space-y-4">
                        {privateNotes.length === 0 ? (
                            <p className="text-sm text-yellow-400/70 italic text-center py-4">No notes for this session yet.</p>
                        ) : (
                            privateNotes.map((note, index) => (
                                <div key={index} className="bg-gray-800/50 p-3 rounded-lg">
                                    <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                                        <span className="font-bold">{note.agentEmail}</span>
                                        <span>{formatNoteTimestamp(note.timestamp)}</span>
                                    </div>
                                    <p className="text-gray-200 text-sm whitespace-pre-wrap">{note.text}</p>
                                </div>
                            ))
                        )}
                        <div ref={notesEndRef} />
                    </div>
                </div>
            )}
        </div>

      {/* --- INPUT AREA (conditionally renders Chat or Note input) --- */}
      <div className="p-4 border-t border-gray-700">
        {activeTab === 'chat' ? (
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <input ref={chatInputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholderText()} disabled={!canSendMessage || isThinking} className="flex-1 p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary placeholder-gray-400 disabled:opacity-50" />
            <button type="button" onClick={handleAssist} disabled={!canSendMessage || isThinking} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50" title="AI Assistant">
              <SparklesIcon className="w-6 h-6" />
            </button>
            <button type="submit" disabled={!canSendMessage || !input.trim() || isThinking} className="p-3 bg-brand-primary text-black rounded-lg hover:bg-yellow-300 disabled:opacity-50">
              <SendIcon className="w-6 h-6" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleAddNote} className="flex items-center gap-3">
            <input type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add a private note..." disabled={isSubmittingNote || !isSessionActionable} className="flex-1 p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 placeholder-gray-400 disabled:opacity-50" />
            <button type="submit" disabled={!noteInput.trim() || isSubmittingNote || !isSessionActionable} className="p-3 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 disabled:opacity-50">
              <ArrowRightIcon className="w-6 h-6" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};