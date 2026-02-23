/**
 * Client-side Session Management Strategies
 * Multiple techniques for managing chat history visibility
 */

import { 
    isSessionExpired, 
    isSessionExpiredByAge, 
    clearExpiredSession, 
    getSessionMetadata 
} from './sessionExpiry';

/**
 * TECHNIQUE 1: Time-Based Expiration
 * Clear history after specific time period
 */
export const checkTimeBasedExpiry = (expiryHours: number = 24): boolean => {
    // Check if session expired by inactivity
    if (isSessionExpired(expiryHours)) {
        console.log('[Session] Expired due to inactivity');
        return true;
    }
    
    // Check if session expired by age (e.g., 7 days old)
    if (isSessionExpiredByAge(7)) {
        console.log('[Session] Expired due to age');
        return true;
    }
    
    return false;
};

/**
 * TECHNIQUE 2: Visit Count Based
 * Clear after N visits/sessions
 */
interface VisitTracker {
  visitCount: number;
  lastVisit: number;
  sessionId: string;
}

const VISIT_TRACKER_KEY = 'rhysley-visit-tracker';
const MAX_VISITS_WITH_HISTORY = 5; // Clear after 5 visits

export const trackVisit = (sessionId: string): boolean => {
  const raw = localStorage.getItem(VISIT_TRACKER_KEY);
  let tracker: VisitTracker;
  
  if (raw) {
    tracker = JSON.parse(raw);
    tracker.visitCount++;
    tracker.lastVisit = Date.now();
  } else {
    tracker = {
      visitCount: 1,
      lastVisit: Date.now(),
      sessionId
    };
  }
  
  localStorage.setItem(VISIT_TRACKER_KEY, JSON.stringify(tracker));
  
  // Return true if should clear history
  return tracker.visitCount > MAX_VISITS_WITH_HISTORY;
};

/**
 * TECHNIQUE 3: Inactivity Timeout
 * Clear if user was inactive for too long
 */
const INACTIVITY_THRESHOLD = 30 * 60 * 1000; // 30 minutes

export const checkInactivity = (): boolean => {
  const metadata = getSessionMetadata();
  if (!metadata) return false;
  
  const inactiveDuration = Date.now() - metadata.lastActivity;
  return inactiveDuration > INACTIVITY_THRESHOLD;
};

/**
 * TECHNIQUE 4: Message Count Based
 * Clear after conversation reaches certain length
 */
const MAX_MESSAGE_COUNT = 100;

export const shouldClearByMessageCount = (messageCount: number): boolean => {
  return messageCount >= MAX_MESSAGE_COUNT;
};

/**
 * TECHNIQUE 5: Privacy Mode - Clear on Browser Close
 * Use sessionStorage instead of localStorage
 */
export const enablePrivacyMode = () => {
  // Move all session data to sessionStorage
  const SESSION_KEY = 'rhysley-chat-session-id';
  const USER_INFO_KEY = 'rhysley-user-info';
  
  const sessionId = localStorage.getItem(SESSION_KEY);
  const userInfo = localStorage.getItem(USER_INFO_KEY);
  
  if (sessionId) sessionStorage.setItem(SESSION_KEY, sessionId);
  if (userInfo) sessionStorage.setItem(USER_INFO_KEY, userInfo);
  
  // Clear from localStorage
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_INFO_KEY);
};

/**
 * TECHNIQUE 6: Conditional History Based on Chat Status
 * Clear history if chat was escalated to admin
 */
export const shouldClearAfterAdminChat = (chatMode: 'bot' | 'admin'): boolean => {
  // If user talked to admin, might want fresh bot conversation
  return chatMode === 'admin';
};

/**
 * TECHNIQUE 7: Smart Expiry - Weekend vs Weekday
 * Different expiry for business hours
 */
export const getSmartExpiryHours = (): number => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  
  // Weekend: longer expiry (48 hours)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 48;
  }
  
  // Business hours (9-5): shorter expiry (4 hours)
  if (hour >= 9 && hour <= 17) {
    return 4;
  }
  
  // After hours: medium expiry (12 hours)
  return 12;
};

/**
 * TECHNIQUE 8: Scheduled Cleanup
 * Clear at specific time daily (e.g., midnight)
 */
export const shouldClearAtMidnight = (): boolean => {
  const metadata = getSessionMetadata();
  if (!metadata) return false;
  
  const lastActivity = new Date(metadata.lastActivity);
  const now = new Date();
  
  // Check if it's a new day
  return lastActivity.getDate() !== now.getDate();
};

/**
 * TECHNIQUE 9: Storage Size Management
 * Clear old sessions when storage is full
 */
export const manageStorageSize = (): void => {
  try {
    const used = JSON.stringify(localStorage).length;
    const limit = 5 * 1024 * 1024; // 5MB limit
    
    if (used > limit * 0.8) { // 80% full
      console.log('[Storage] Approaching limit, clearing old sessions');
      clearExpiredSession();
    }
  } catch (e) {
    console.error('Failed to check storage size:', e);
  }
};

/**
 * TECHNIQUE 10: User Preference Based
 * Let user choose history duration
 */
export type HistoryPreference = 'always' | '24hours' | '7days' | 'never';

export const applyUserPreference = (preference: HistoryPreference): boolean => {
  const metadata = getSessionMetadata();
  if (!metadata) return false;
  
  switch (preference) {
    case 'never':
      return true; // Always clear
    case '24hours':
      return isSessionExpired(24);
    case '7days':
      return isSessionExpiredByAge(7);
    case 'always':
      return false; // Never clear
    default:
      return false;
  }
};
