import { GameSession, ChatMessage, DrawingData } from '../types';

interface CloudSession {
  session: GameSession;
  timestamp: number;
  chatMessages: ChatMessage[];
  currentDrawing?: DrawingData;
}

export class CloudSessionManager {
  private static readonly API_BASE = 'https://api.jsonbin.io/v3/b';
  private static readonly API_KEY = '$2a$10$demo.key.for.jsonbin.io'; // Replace with actual API key
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  // Fallback to localStorage for demo purposes
  private static readonly STORAGE_KEY = 'egokoro_sessions';
  private static readonly USE_CLOUD = false; // Set to true when API key is configured

  static async saveSession(session: GameSession): Promise<void> {
    const cloudSession: CloudSession = {
      session,
      timestamp: Date.now(),
      chatMessages: session.chatMessages || [],
      currentDrawing: session.currentDrawing
    };

    if (this.USE_CLOUD) {
      try {
        await this.saveToCloud(session.id, cloudSession);
      } catch (error) {
        console.warn('Cloud save failed, falling back to localStorage:', error);
        this.saveToLocalStorage(session.id, cloudSession);
      }
    } else {
      this.saveToLocalStorage(session.id, cloudSession);
    }
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    if (this.USE_CLOUD) {
      try {
        const cloudSession = await this.getFromCloud(sessionId);
        if (cloudSession && this.isSessionValid(cloudSession)) {
          return cloudSession.session;
        }
      } catch (error) {
        console.warn('Cloud fetch failed, trying localStorage:', error);
      }
    }

    const localSession = this.getFromLocalStorage(sessionId);
    return localSession && this.isSessionValid(localSession) ? localSession.session : null;
  }

  static async getSessionIds(): Promise<string[]> {
    const sessions = this.getAllFromLocalStorage();
    return Object.keys(sessions).filter(id => {
      const session = sessions[id];
      return this.isSessionValid(session);
    });
  }

  static async deleteSession(sessionId: string): Promise<void> {
    if (this.USE_CLOUD) {
      try {
        await this.deleteFromCloud(sessionId);
      } catch (error) {
        console.warn('Cloud delete failed:', error);
      }
    }
    this.deleteFromLocalStorage(sessionId);
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
    const sessions = this.getAllFromLocalStorage();
    const now = Date.now();
    let hasChanges = false;

    Object.keys(sessions).forEach(sessionId => {
      const session = sessions[sessionId];
      if (now - session.timestamp > this.SESSION_EXPIRY) {
        delete sessions[sessionId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    }
  }

  // Cloud storage methods (JSONBin.io as example)
  private static async saveToCloud(sessionId: string, cloudSession: CloudSession): Promise<void> {
    const response = await fetch(`${this.API_BASE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': this.API_KEY,
        'X-Bin-Name': `egokoro-session-${sessionId}`
      },
      body: JSON.stringify(cloudSession)
    });

    if (!response.ok) {
      throw new Error(`Cloud save failed: ${response.statusText}`);
    }
  }

  private static async getFromCloud(_sessionId: string): Promise<CloudSession | null> {
    // This would require storing bin IDs, simplified for demo
    throw new Error('Cloud fetch not implemented in demo');
  }

  private static async deleteFromCloud(_sessionId: string): Promise<void> {
    // Implementation would depend on cloud service
    throw new Error('Cloud delete not implemented in demo');
  }

  // Local storage methods
  private static saveToLocalStorage(sessionId: string, cloudSession: CloudSession): void {
    const sessions = this.getAllFromLocalStorage();
    sessions[sessionId] = cloudSession;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getFromLocalStorage(sessionId: string): CloudSession | null {
    const sessions = this.getAllFromLocalStorage();
    return sessions[sessionId] || null;
  }

  private static deleteFromLocalStorage(sessionId: string): void {
    const sessions = this.getAllFromLocalStorage();
    delete sessions[sessionId];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getAllFromLocalStorage(): Record<string, CloudSession> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to parse stored sessions:', error);
      return {};
    }
  }

  private static isSessionValid(cloudSession: CloudSession): boolean {
    const now = Date.now();
    return (now - cloudSession.timestamp) < this.SESSION_EXPIRY;
  }
}