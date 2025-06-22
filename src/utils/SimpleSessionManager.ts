import { GameSession, ChatMessage, DrawingData } from '../types';

export class SimpleSessionManager {
  private static readonly STORAGE_KEY = 'egokoro_sessions';
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  static saveSession(session: GameSession): void {
    const sessions = this.getAllSessions();
    sessions[session.id] = {
      ...session,
      lastActivity: Date.now()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  static getSession(sessionId: string): GameSession | null {
    const sessions = this.getAllSessions();
    const session = sessions[sessionId];
    
    if (!session) return null;
    
    // Check if session has expired
    if (Date.now() - session.lastActivity > this.SESSION_EXPIRY) {
      delete sessions[sessionId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
      return null;
    }
    
    return session;
  }

  static getAllSessions(): Record<string, GameSession & { lastActivity: number }> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to parse sessions from localStorage:', error);
      return {};
    }
  }

  static getSessionIds(): string[] {
    const sessions = this.getAllSessions();
    const now = Date.now();
    
    // Filter out expired sessions
    const validSessionIds = Object.keys(sessions).filter(id => {
      const session = sessions[id];
      return (now - session.lastActivity) <= this.SESSION_EXPIRY;
    });
    
    return validSessionIds;
  }

  static deleteSession(sessionId: string): void {
    const sessions = this.getAllSessions();
    delete sessions[sessionId];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  static updateSessionActivity(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      this.saveSession(session);
    }
  }

  static addChatMessage(sessionId: string, message: ChatMessage): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    if (!session.chatMessages) session.chatMessages = [];
    session.chatMessages.push(message);
    
    // Keep only last 100 messages to prevent storage overflow
    if (session.chatMessages.length > 100) {
      session.chatMessages = session.chatMessages.slice(-100);
    }
    
    this.saveSession(session);
    return true;
  }

  static updateDrawing(sessionId: string, drawingData: DrawingData): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.currentDrawing = drawingData;
    this.saveSession(session);
    return true;
  }

  // Cleanup expired sessions
  static cleanup(): void {
    const sessions = this.getAllSessions();
    const now = Date.now();
    let hasChanges = false;

    Object.keys(sessions).forEach(id => {
      if (now - sessions[id].lastActivity > this.SESSION_EXPIRY) {
        delete sessions[id];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    }
  }
}