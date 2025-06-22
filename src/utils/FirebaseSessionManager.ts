import { 
  ref, 
  set, 
  get, 
  remove, 
  push, 
  onValue
} from 'firebase/database';
import { database, isFirebaseEnabled } from './firebase';
import { GameSession, ChatMessage, DrawingData } from '../types';

interface FirebaseSessionData {
  session: GameSession;
  timestamp: number;
  lastActivity: number;
  chatMessages: ChatMessage[];
  currentDrawing?: DrawingData;
}

export class FirebaseSessionManager {
  private static readonly SESSION_PATH = 'sessions';
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly FALLBACK_STORAGE_KEY = 'egokoro_firebase_fallback';
  private static listeners: Map<string, () => void> = new Map();

  static async saveSession(session: GameSession): Promise<void> {
    if (!isFirebaseEnabled || !database) {
      console.warn('Firebase not available, using fallback storage');
      this.saveFallback(session.id, {
        session,
        timestamp: Date.now(),
        lastActivity: Date.now(),
        chatMessages: session.chatMessages || [],
        currentDrawing: session.currentDrawing
      });
      return;
    }

    try {
      const sessionData: FirebaseSessionData = {
        session,
        timestamp: Date.now(),
        lastActivity: Date.now(),
        chatMessages: session.chatMessages || [],
        currentDrawing: session.currentDrawing
      };

      const sessionRef = ref(database, `${this.SESSION_PATH}/${session.id}`);
      await set(sessionRef, sessionData);
      
      console.log(`Session ${session.id} saved to Firebase`);
    } catch (error) {
      console.error('Failed to save session to Firebase:', error);
      // Fallback to localStorage
      this.saveFallback(session.id, {
        session,
        timestamp: Date.now(),
        lastActivity: Date.now(),
        chatMessages: session.chatMessages || [],
        currentDrawing: session.currentDrawing
      });
    }
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    if (!isFirebaseEnabled || !database) {
      console.warn('Firebase not available, using fallback storage');
      const fallbackData = this.getFallback(sessionId);
      return fallbackData && this.isSessionValid(fallbackData) ? fallbackData.session : null;
    }

    try {
      const sessionRef = ref(database, `${this.SESSION_PATH}/${sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (snapshot.exists()) {
        const sessionData: FirebaseSessionData = snapshot.val();
        
        if (this.isSessionValid(sessionData)) {
          // Update last activity
          await this.updateLastActivity(sessionId);
          return sessionData.session;
        } else {
          // Session expired, remove it
          await this.deleteSession(sessionId);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get session from Firebase:', error);
      // Fallback to localStorage
      const fallbackData = this.getFallback(sessionId);
      return fallbackData && this.isSessionValid(fallbackData) ? fallbackData.session : null;
    }
  }

  static async getSessionIds(): Promise<string[]> {
    if (!isFirebaseEnabled || !database) {
      console.warn('Firebase not available, using fallback storage');
      return this.getFallbackSessionIds();
    }

    try {
      const sessionsRef = ref(database, this.SESSION_PATH);
      const snapshot = await get(sessionsRef);
      
      if (snapshot.exists()) {
        const sessions = snapshot.val();
        const validSessionIds: string[] = [];
        
        for (const sessionId in sessions) {
          const sessionData: FirebaseSessionData = sessions[sessionId];
          if (this.isSessionValid(sessionData)) {
            validSessionIds.push(sessionId);
          } else {
            // Remove expired session
            await this.deleteSession(sessionId);
          }
        }
        
        return validSessionIds;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get session IDs from Firebase:', error);
      return this.getFallbackSessionIds();
    }
  }

  static async deleteSession(sessionId: string): Promise<void> {
    if (!isFirebaseEnabled || !database) {
      this.deleteFallback(sessionId);
      return;
    }

    try {
      const sessionRef = ref(database, `${this.SESSION_PATH}/${sessionId}`);
      await remove(sessionRef);
      console.log(`Session ${sessionId} deleted from Firebase`);
    } catch (error) {
      console.error('Failed to delete session from Firebase:', error);
    }
    
    // Also remove from fallback
    this.deleteFallback(sessionId);
    
    // Remove any listeners
    this.removeListener(sessionId);
  }

  static async addChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    if (!isFirebaseEnabled || !database) {
      const session = await this.getSession(sessionId);
      if (!session) return;
      
      if (!session.chatMessages) {
        session.chatMessages = [];
      }
      session.chatMessages.push(message);
      await this.saveSession(session);
      return;
    }

    try {
      const chatRef = ref(database, `${this.SESSION_PATH}/${sessionId}/chatMessages`);
      await push(chatRef, message);
      await this.updateLastActivity(sessionId);
    } catch (error) {
      console.error('Failed to add chat message to Firebase:', error);
      // Fallback to updating the entire session
      const session = await this.getSession(sessionId);
      if (session) {
        if (!session.chatMessages) {
          session.chatMessages = [];
        }
        session.chatMessages.push(message);
        await this.saveSession(session);
      }
    }
  }

  static async updateDrawing(sessionId: string, drawingData: DrawingData): Promise<void> {
    if (!isFirebaseEnabled || !database) {
      const session = await this.getSession(sessionId);
      if (!session) return;
      
      session.currentDrawing = drawingData;
      await this.saveSession(session);
      return;
    }

    try {
      const drawingRef = ref(database, `${this.SESSION_PATH}/${sessionId}/currentDrawing`);
      await set(drawingRef, drawingData);
      await this.updateLastActivity(sessionId);
    } catch (error) {
      console.error('Failed to update drawing in Firebase:', error);
      // Fallback to updating the entire session
      const session = await this.getSession(sessionId);
      if (session) {
        session.currentDrawing = drawingData;
        await this.saveSession(session);
      }
    }
  }

  static subscribeToSession(sessionId: string, callback: (session: GameSession | null) => void): () => void {
    if (!isFirebaseEnabled || !database) {
      console.warn('Firebase not available, subscription not supported');
      return () => {};
    }

    const sessionRef = ref(database, `${this.SESSION_PATH}/${sessionId}`);
    
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessionData: FirebaseSessionData = snapshot.val();
        if (this.isSessionValid(sessionData)) {
          callback(sessionData.session);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });

    // Store the unsubscribe function
    this.listeners.set(sessionId, unsubscribe);
    
    return unsubscribe;
  }

  static removeListener(sessionId: string): void {
    const unsubscribe = this.listeners.get(sessionId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(sessionId);
    }
  }

  private static async updateLastActivity(sessionId: string): Promise<void> {
    if (!isFirebaseEnabled || !database) return;

    try {
      const activityRef = ref(database, `${this.SESSION_PATH}/${sessionId}/lastActivity`);
      await set(activityRef, Date.now());
    } catch (error) {
      console.error('Failed to update last activity:', error);
    }
  }

  private static isSessionValid(sessionData: FirebaseSessionData): boolean {
    const now = Date.now();
    return (now - sessionData.timestamp) < this.SESSION_EXPIRY;
  }

  // Fallback localStorage methods
  private static saveFallback(sessionId: string, sessionData: FirebaseSessionData): void {
    const sessions = this.getAllFallback();
    sessions[sessionId] = sessionData;
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getFallback(sessionId: string): FirebaseSessionData | null {
    const sessions = this.getAllFallback();
    return sessions[sessionId] || null;
  }

  private static deleteFallback(sessionId: string): void {
    const sessions = this.getAllFallback();
    delete sessions[sessionId];
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getAllFallback(): Record<string, FirebaseSessionData> {
    try {
      const stored = localStorage.getItem(this.FALLBACK_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to parse fallback sessions:', error);
      return {};
    }
  }

  private static getFallbackSessionIds(): string[] {
    const sessions = this.getAllFallback();
    return Object.keys(sessions).filter(id => {
      const sessionData = sessions[id];
      return this.isSessionValid(sessionData);
    });
  }

  static cleanup(): void {
    // Cleanup fallback storage
    const sessions = this.getAllFallback();
    const now = Date.now();
    let hasChanges = false;

    Object.keys(sessions).forEach(sessionId => {
      const sessionData = sessions[sessionId];
      if (now - sessionData.timestamp > this.SESSION_EXPIRY) {
        delete sessions[sessionId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
    }
  }
}