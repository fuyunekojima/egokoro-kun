import { GameSession, ChatMessage, DrawingData } from '../types';

interface SessionData {
  session: GameSession;
  timestamp: number;
  lastActivity: number;
  chatMessages: ChatMessage[];
  currentDrawing?: DrawingData;
}

export class RealtimeSessionManager {
  private static readonly API_URL = 'https://egokoro-sessions.netlify.app/.netlify/functions';
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly FALLBACK_STORAGE_KEY = 'egokoro_sessions_fallback';

  static async saveSession(session: GameSession): Promise<void> {
    const sessionData: SessionData = {
      session,
      timestamp: Date.now(),
      lastActivity: Date.now(),
      chatMessages: session.chatMessages || [],
      currentDrawing: session.currentDrawing
    };

    try {
      const response = await fetch(`${this.API_URL}/save-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
          data: sessionData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to save to cloud, using fallback:', error);
      this.saveFallback(session.id, sessionData);
    }
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    try {
      const response = await fetch(`${this.API_URL}/get-session?sessionId=${sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && this.isSessionValid(data)) {
          return data.session;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch from cloud, trying fallback:', error);
    }

    // Fallback to localStorage
    const fallbackData = this.getFallback(sessionId);
    return fallbackData && this.isSessionValid(fallbackData) ? fallbackData.session : null;
  }

  static async getSessionIds(): Promise<string[]> {
    try {
      const response = await fetch(`${this.API_URL}/list-sessions`);
      if (response.ok) {
        const data = await response.json();
        return data.sessionIds || [];
      }
    } catch (error) {
      console.warn('Failed to fetch session list from cloud:', error);
    }

    // Fallback to localStorage
    return this.getFallbackSessionIds();
  }

  static async deleteSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.API_URL}/delete-session`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
      });
    } catch (error) {
      console.warn('Failed to delete from cloud:', error);
    }

    this.deleteFallback(sessionId);
  }

  static async addChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    if (!session.chatMessages) {
      session.chatMessages = [];
    }
    session.chatMessages.push(message);
    await this.saveSession(session);
  }

  static async updateDrawing(sessionId: string, drawingData: DrawingData): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.currentDrawing = drawingData;
    await this.saveSession(session);
  }

  static cleanup(): void {
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

  // Fallback localStorage methods
  private static saveFallback(sessionId: string, sessionData: SessionData): void {
    const sessions = this.getAllFallback();
    sessions[sessionId] = sessionData;
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getFallback(sessionId: string): SessionData | null {
    const sessions = this.getAllFallback();
    return sessions[sessionId] || null;
  }

  private static deleteFallback(sessionId: string): void {
    const sessions = this.getAllFallback();
    delete sessions[sessionId];
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getAllFallback(): Record<string, SessionData> {
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

  private static isSessionValid(sessionData: SessionData): boolean {
    const now = Date.now();
    return (now - sessionData.timestamp) < this.SESSION_EXPIRY;
  }
}