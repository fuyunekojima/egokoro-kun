import { GameSession, ChatMessage, DrawingData } from '../types';

interface JSONBinSessionData {
  session: GameSession;
  timestamp: number;
  chatMessages: ChatMessage[];
  currentDrawing?: DrawingData;
}

interface SessionIndex {
  [sessionId: string]: {
    binId: string;
    timestamp: number;
    name: string;
  };
}

export class JSONBinSessionManager {
  private static readonly API_BASE = 'https://api.jsonbin.io/v3/b';
  private static readonly API_KEY = '$2a$10$demo.key.replace.with.real.key'; // Replace with actual JSONBin.io API key
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly FALLBACK_STORAGE_KEY = 'egokoro_jsonbin_sessions';
  private static readonly INDEX_BIN_ID = 'demo-index-bin-id'; // Replace with actual bin ID for session index

  static async saveSession(session: GameSession): Promise<void> {
    const sessionData: JSONBinSessionData = {
      session,
      timestamp: Date.now(),
      chatMessages: session.chatMessages || [],
      currentDrawing: session.currentDrawing
    };

    try {
      // Create a new bin for this session
      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.API_KEY,
          'X-Bin-Name': `egokoro-session-${session.id}`,
          'X-Bin-Private': 'false'
        },
        body: JSON.stringify(sessionData)
      });

      if (response.ok) {
        const result = await response.json();
        const binId = result.metadata.id;
        
        // Update session index
        await this.updateSessionIndex(session.id, binId, session.name);
        
        console.log(`Session saved to JSONBin: ${binId}`);
      } else {
        throw new Error(`JSONBin API error: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to save to JSONBin, using fallback:', error);
      this.saveFallback(session.id, sessionData);
    }
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    try {
      const binId = await this.getBinId(sessionId);
      if (binId) {
        const response = await fetch(`${this.API_BASE}/${binId}/latest`, {
          headers: {
            'X-Master-Key': this.API_KEY
          }
        });

        if (response.ok) {
          const result = await response.json();
          const sessionData: JSONBinSessionData = result.record;
          
          if (this.isSessionValid(sessionData)) {
            return sessionData.session;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch from JSONBin:', error);
    }

    // Fallback to localStorage
    const fallbackData = this.getFallback(sessionId);
    return fallbackData && this.isSessionValid(fallbackData) ? fallbackData.session : null;
  }

  static async getSessionIds(): Promise<string[]> {
    try {
      const index = await this.getSessionIndex();
      const now = Date.now();
      
      return Object.keys(index).filter(sessionId => {
        const indexEntry = index[sessionId];
        return (now - indexEntry.timestamp) < this.SESSION_EXPIRY;
      });
    } catch (error) {
      console.warn('Failed to fetch session index:', error);
    }

    // Fallback to localStorage
    return this.getFallbackSessionIds();
  }

  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const binId = await this.getBinId(sessionId);
      if (binId) {
        await fetch(`${this.API_BASE}/${binId}`, {
          method: 'DELETE',
          headers: {
            'X-Master-Key': this.API_KEY
          }
        });
      }
      
      // Remove from index
      await this.removeFromSessionIndex(sessionId);
    } catch (error) {
      console.warn('Failed to delete from JSONBin:', error);
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

  // Session index management
  private static async getSessionIndex(): Promise<SessionIndex> {
    try {
      const response = await fetch(`${this.API_BASE}/${this.INDEX_BIN_ID}/latest`, {
        headers: {
          'X-Master-Key': this.API_KEY
        }
      });

      if (response.ok) {
        const result = await response.json();
        return result.record || {};
      }
    } catch (error) {
      console.warn('Failed to fetch session index:', error);
    }
    
    return {};
  }

  private static async updateSessionIndex(sessionId: string, binId: string, sessionName: string): Promise<void> {
    try {
      const index = await this.getSessionIndex();
      index[sessionId] = {
        binId,
        timestamp: Date.now(),
        name: sessionName
      };

      await fetch(`${this.API_BASE}/${this.INDEX_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.API_KEY
        },
        body: JSON.stringify(index)
      });
    } catch (error) {
      console.warn('Failed to update session index:', error);
    }
  }

  private static async removeFromSessionIndex(sessionId: string): Promise<void> {
    try {
      const index = await this.getSessionIndex();
      delete index[sessionId];

      await fetch(`${this.API_BASE}/${this.INDEX_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': this.API_KEY
        },
        body: JSON.stringify(index)
      });
    } catch (error) {
      console.warn('Failed to remove from session index:', error);
    }
  }

  private static async getBinId(sessionId: string): Promise<string | null> {
    const index = await this.getSessionIndex();
    return index[sessionId]?.binId || null;
  }

  // Fallback localStorage methods
  private static saveFallback(sessionId: string, sessionData: JSONBinSessionData): void {
    const sessions = this.getAllFallback();
    sessions[sessionId] = sessionData;
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getFallback(sessionId: string): JSONBinSessionData | null {
    const sessions = this.getAllFallback();
    return sessions[sessionId] || null;
  }

  private static deleteFallback(sessionId: string): void {
    const sessions = this.getAllFallback();
    delete sessions[sessionId];
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getAllFallback(): Record<string, JSONBinSessionData> {
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

  private static isSessionValid(sessionData: JSONBinSessionData): boolean {
    const now = Date.now();
    return (now - sessionData.timestamp) < this.SESSION_EXPIRY;
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
}