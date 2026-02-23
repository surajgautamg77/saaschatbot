/**
 * Session Expiry Utility
 * Manages chat history expiration based on time
 */

export interface SessionMetadata {
  sessionId: string;
  email?: string;
  lastActivity: number; // Timestamp
  createdAt: number; // Timestamp
}

const SESSION_METADATA_KEY = 'rhysley-session-metadata';

/**
 * Save session metadata with timestamps
 */
export const saveSessionMetadata = (sessionId: string, email?: string): void => {
  const metadata: SessionMetadata = {
    sessionId,
    email,
    lastActivity: Date.now(),
    createdAt: Date.now(),
  };
  
  localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(metadata));
};

/**
 * Update last activity timestamp
 */
export const updateSessionActivity = (): void => {
  const raw = localStorage.getItem(SESSION_METADATA_KEY);
  if (raw) {
    try {
      const metadata: SessionMetadata = JSON.parse(raw);
      metadata.lastActivity = Date.now();
      localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(metadata));
    } catch (e) {
      console.error('Failed to update session activity:', e);
    }
  }
};

/**
 * Check if session has expired based on inactivity
 * @param expiryHours - Number of hours before expiry
 * @returns true if session expired
 */
export const isSessionExpired = (expiryHours: number = 24): boolean => {
  const raw = localStorage.getItem(SESSION_METADATA_KEY);
  if (!raw) return false;

  try {
    const metadata: SessionMetadata = JSON.parse(raw);
    const now = Date.now();
    const hoursSinceActivity = (now - metadata.lastActivity) / (1000 * 60 * 60);
    
    return hoursSinceActivity >= expiryHours;
  } catch (e) {
    console.error('Failed to check session expiry:', e);
    return false;
  }
};

/**
 * Check if session has expired based on inactivity in seconds
 * @param inactivityTimeoutSeconds - Number of seconds before expiry
 * @returns true if session expired
 */
export const isSessionInactivelyExpired = (inactivityTimeoutSeconds: number = 300): boolean => {
  const raw = localStorage.getItem(SESSION_METADATA_KEY);
  if (!raw) return false;

  try {
    const metadata: SessionMetadata = JSON.parse(raw);
    const now = Date.now();
    const secondsSinceActivity = (now - metadata.lastActivity) / 1000;
    
    return inactivityTimeoutSeconds > 0 && secondsSinceActivity >= inactivityTimeoutSeconds;
  } catch (e) {
    console.error('Failed to check session inactivity expiry:', e);
    return false;
  }
};

/**
 * Check if session has expired based on creation time
 * @param expiryDays - Number of days before expiry
 * @returns true if session expired
 */
export const isSessionExpiredByAge = (expiryDays: number = 7): boolean => {
  const raw = localStorage.getItem(SESSION_METADATA_KEY);
  if (!raw) return false;

  try {
    const metadata: SessionMetadata = JSON.parse(raw);
    const now = Date.now();
    const daysSinceCreation = (now - metadata.createdAt) / (1000 * 60 * 60 * 24);
    
    return daysSinceCreation >= expiryDays;
  } catch (e) {
    console.error('Failed to check session age:', e);
    return false;
  }
};

/**
 * Clear expired session data
 */
export const clearExpiredSession = (): void => {
  const SESSION_KEY = 'rhysley-chat-session-id';
  const USER_INFO_KEY = 'rhysley-user-info';
  const SESSIONS_BY_EMAIL_KEY = 'rhysley-sessions-by-email';
  const rawMetadata = localStorage.getItem(SESSION_METADATA_KEY);
  let metadata: SessionMetadata | null = null;

  if (rawMetadata) {
    try {
      metadata = JSON.parse(rawMetadata) as SessionMetadata;
    } catch (e) {
      console.error('Failed to parse session metadata before clearing:', e);
    }
  }
  
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  localStorage.removeItem(SESSION_METADATA_KEY);
  
  if (metadata?.email) {
    try {
      const mapRaw = localStorage.getItem(SESSIONS_BY_EMAIL_KEY);
      const sessionsMap = mapRaw ? JSON.parse(mapRaw) : {};
      delete sessionsMap[metadata.email];
      localStorage.setItem(SESSIONS_BY_EMAIL_KEY, JSON.stringify(sessionsMap));
    } catch (e) {
      console.error('Failed to clear email mapping:', e);
    }
  }
};

/**
 * Get session metadata
 */
export const getSessionMetadata = (): SessionMetadata | null => {
  const raw = localStorage.getItem(SESSION_METADATA_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to get session metadata:', e);
    return null;
  }
};
