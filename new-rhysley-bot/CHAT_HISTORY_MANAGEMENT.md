# 📚 Chat History Management - Implementation Guide

## Overview
This document explains various techniques to control when chat history is cleared/hidden from the chatbot screen.

---

## 🎯 Implemented Features

### ✅ **1. Time-Based Expiration** (IMPLEMENTED)

**Location:** `client/src/utils/sessionExpiry.ts`

Clear chat history after a configurable period of inactivity.

**Admin Configuration:**
- Go to **Branding Page**
- Set **"Chat History Expiry (hours)"** field
- Default: 24 hours
- Set to 0 to never expire

**How it Works:**
```typescript
// Automatically checks on widget load
if (isSessionExpired(expiryHours)) {
  clearExpiredSession();
  // User sees form again
}
```

**Use Cases:**
- ✅ Privacy-conscious businesses
- ✅ Shared devices (public kiosks)
- ✅ Compliance requirements

---

## 💡 Additional Techniques (Available in Code)

### **2. Visit Count Based**

Clear history after N visits to prevent clutter.

```typescript
import { trackVisit } from './utils/sessionStrategies';

// In App.tsx
const shouldClear = trackVisit(sessionId);
if (shouldClear) {
  clearExpiredSession();
}
```

**Configuration:**
```typescript
const MAX_VISITS_WITH_HISTORY = 5; // Clear after 5 visits
```

---

### **3. Inactivity Timeout**

Clear if user was inactive for too long (different from expiry).

```typescript
import { checkInactivity } from './utils/sessionStrategies';

if (checkInactivity()) {
  // Clear after 30 minutes of inactivity
  clearExpiredSession();
}
```

---

### **4. Message Count Limit**

Clear when conversation gets too long.

```typescript
import { shouldClearByMessageCount } from './utils/sessionStrategies';

if (shouldClearByMessageCount(messages.length)) {
  // Clear after 100 messages
  clearExpiredSession();
}
```

---

### **5. Privacy Mode**

Use sessionStorage instead of localStorage - clears on browser close.

```typescript
import { enablePrivacyMode } from './utils/sessionStrategies';

// Call on bot initialization
enablePrivacyMode();
```

**Use Cases:**
- Sensitive information handling
- Banking/Healthcare chatbots
- Anonymous browsing mode

---

### **6. Smart Expiry (Business Hours)**

Different expiry times based on day/time.

```typescript
import { getSmartExpiryHours } from './utils/sessionStrategies';

const expiryHours = getSmartExpiryHours();
// Weekend: 48 hours
// Business hours: 4 hours
// After hours: 12 hours
```

---

### **7. Daily Cleanup**

Clear at specific time each day (e.g., midnight).

```typescript
import { shouldClearAtMidnight } from './utils/sessionStrategies';

if (shouldClearAtMidnight()) {
  clearExpiredSession();
}
```

---

### **8. Admin Chat Separation**

Clear bot history after admin handoff.

```typescript
import { shouldClearAfterAdminChat } from './utils/sessionStrategies';

if (shouldClearAfterAdminChat(chatMode)) {
  // Fresh start after talking to human
  clearExpiredSession();
}
```

---

### **9. Storage Management**

Auto-clear old sessions when storage is full.

```typescript
import { manageStorageSize } from './utils/sessionStrategies';

// Call periodically
manageStorageSize();
```

---

### **10. User Preference**

Let users choose their own history duration.

```typescript
import { applyUserPreference } from './utils/sessionStrategies';

const preference = 'always' | '24hours' | '7days' | 'never';
const shouldClear = applyUserPreference(preference);
```

---

## 🔧 Implementation Examples

### **Example 1: Add Multiple Strategies**

```typescript
// In App.tsx
useEffect(() => {
  const checkAllStrategies = () => {
    const expiryHours = settings?.historyExpiryHours || 24;
    
    // Strategy 1: Time-based
    if (expiryHours > 0 && isSessionExpired(expiryHours)) {
      console.log('[Clear] Time expiry');
      clearExpiredSession();
      return true;
    }
    
    // Strategy 2: Daily cleanup
    if (shouldClearAtMidnight()) {
      console.log('[Clear] Daily cleanup');
      clearExpiredSession();
      return true;
    }
    
    // Strategy 3: Message count
    if (shouldClearByMessageCount(messages.length)) {
      console.log('[Clear] Too many messages');
      clearExpiredSession();
      return true;
    }
    
    return false;
  };

  const cleared = checkAllStrategies();
  if (!cleared) {
    // Proceed with normal session restore
  }
}, [settings, messages]);
```

---

### **Example 2: Admin Dashboard Control**

Add multiple options in BrandingPage:

```tsx
<div>
  <label>History Retention Policy</label>
  <select 
    name="historyPolicy" 
    value={formData.historyPolicy}
    onChange={handleInputChange}
  >
    <option value="always">Always Keep</option>
    <option value="24hours">24 Hours</option>
    <option value="7days">7 Days</option>
    <option value="daily">Clear Daily</option>
    <option value="session">Clear on Close</option>
  </select>
</div>
```

---

## 📊 Decision Matrix

| Technique | When to Use | Privacy | User Experience |
|-----------|------------|---------|-----------------|
| Time-Based Expiry | General purpose | Medium | Good |
| Visit Count | Return visitors | Low | Good |
| Inactivity | Short sessions | Medium | Fair |
| Message Count | Long conversations | Low | Fair |
| Privacy Mode | Sensitive data | High | Poor (no history) |
| Business Hours | Support chatbots | Low | Excellent |
| Daily Cleanup | Shared devices | High | Good |
| Admin Separation | Hybrid bots | Medium | Excellent |
| Storage Management | High traffic | Medium | Good |
| User Preference | Customer choice | Varies | Excellent |

---

## 🎯 Recommended Combinations

### **For E-commerce:**
```typescript
- Time-Based: 7 days
- Message Count: 200 messages
- Storage Management: Enabled
```

### **For Healthcare:**
```typescript
- Privacy Mode: Enabled
- Inactivity: 15 minutes
- Daily Cleanup: Midnight
```

### **For Customer Support:**
```typescript
- Smart Expiry: Business hours aware
- Admin Separation: Enabled
- User Preference: Available
```

### **For Public Kiosks:**
```typescript
- Session Storage: Enabled (clears on close)
- Inactivity: 5 minutes
- Daily Cleanup: Every 6 hours
```

---

## 🔄 Current Default Behavior

```
1. User fills form → Session created
2. User minimizes → Session preserved
3. User returns within 24 hours → History shown
4. User returns after 24+ hours → Form shown again
5. User clicks refresh → Fresh start
```

---

## 🚀 Quick Setup

### **Basic Time Expiry (Already Configured):**
1. Admin panel → Branding → Chat History Expiry
2. Set hours (default: 24)
3. Save settings
4. Widget automatically enforces expiry

### **Add Privacy Mode:**
```typescript
// In App.tsx
useEffect(() => {
  if (settings?.privacyMode) {
    enablePrivacyMode();
  }
}, [settings]);
```

### **Add Message Limit:**
```typescript
// In App.tsx
useEffect(() => {
  if (messages.length >= 100) {
    setMessages(messages.slice(-50)); // Keep last 50
  }
}, [messages]);
```

---

## 📝 Database Fields

Current schema supports:

```prisma
Bot {
  historyExpiryHours Int? @default(24)
}

Session {
  lastSeen BigInt
  lastMessageAt DateTime?
  createdAt DateTime @default(now())
}
```

**Future Extensions:**
- `historyRetentionPolicy` (enum)
- `maxMessageCount`
- `privacyMode` (boolean)
- `cleanupSchedule` (cron)

---

## ✅ Summary

You now have:
- ✅ **Time-based expiry** (implemented & in admin panel)
- ✅ **10+ techniques** available in code
- ✅ **Flexible configuration** per bot
- ✅ **Session metadata tracking**
- ✅ **Clean separation** of concerns

Choose the techniques that match your business requirements and implement as needed!
