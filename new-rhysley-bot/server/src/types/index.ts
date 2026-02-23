export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

export interface ChatMessage {
  role: Role;
  text: string;
  id: string;
  createdAt?: string; 
  choices?: string[]; 
}

export interface BookingDetails {
  id?: string;
  date: Date;
  timeZone: string;
  name: string;
  email: string;
  phone: string;
  details: string;
}

export interface LiveUser {
  sessionId: string;
  status: 'bot' | 'admin';
  chatStatus?: 'GREEN' | 'YELLOW' | 'RED' | 'NONE';
  lastSeen: string;
  lastMessage: string;
  ip: string;
  userAgent: string | null;
  location: string | null;
  sessionNumber?: number;
  requiresAttention?: boolean;
  isToReassign?: boolean;
  isOnline: boolean; // Added isOnline property
  assignedTo?: {
    id: string;
    email: string;
  } | null;
  company: {
    id: string;
    name: string;
  };
  bot: {
    name: string;
  };
}

export interface Company {
  id: string;
  name: string;
  timeZone?: string | null;
  businessHoursStart?: number | null;
  businessHoursEnd?: number | null;
  popupDelay?: number | null;
}

export interface Bot {
  id: string;
  name: string;
  publicApiKey: string;
  botName?: string | null;
  welcomeMessage?: string | null;
  systemInstruction?: string | null;
  widgetColor?: string | null;
  botLogoUrl?: string | null;
  popupDelay?: number | null;
}

export interface User {
  id: string;
  email: string;
  companyId: string;
  role: 'OWNER' | 'AGENT' | 'SUPER_ADMIN';
}

export interface Note {
  agentId: string;
  agentEmail: string;
  text: string;
  timestamp: string;
}

export type ServerToClientSocketMessage =
    | ChatMessage 
    | { type: 'statusUpdate'; status: 'bot' | 'admin' }
    | { type: 'bot_response_start'; message: { id: string; role: Role } }
    | { type: 'bot_response_chunk'; message: { id: string; text: string } }
    | { type: 'bot_response_end'; messageId: string, action: string | null }
    | { type: 'invoke_action'; payload: { action: 'scheduler' } }
    | { type: 'choice_response'; message: { id: string; text: string; choices: string[] } }
    | { type: 'sessionAssigned'; payload: { sessionId: string; agent: { id: string; email: string } } }
    | { type: 'privateNoteAdded'; payload: { sessionId: string; note: Note } };