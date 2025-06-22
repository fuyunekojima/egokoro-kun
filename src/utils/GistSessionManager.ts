import { GameSession, ChatMessage, DrawingData } from '../types';

interface GistSessionData {
  session: GameSession;
  timestamp: number;
  chatMessages: ChatMessage[];
  currentDrawing?: DrawingData;
}

export class GistSessionManager {
  private static readonly GITHUB_API = 'https://api.github.com';
  private static readonly GIST_DESCRIPTION = 'Egokoro-kun Game Session';
  private static readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly FALLBACK_STORAGE_KEY = 'egokoro_gist_sessions';

  // GitHub Personal Access Token (public_repo scope needed)
  // For demo purposes, we'll use anonymous gists (no token required)
  private static readonly GITHUB_TOKEN = ''; // Add token for authenticated requests

  static async saveSession(session: GameSession): Promise<void> {
    const sessionData: GistSessionData = {
      session,
      timestamp: Date.now(),
      chatMessages: session.chatMessages || [],
      currentDrawing: session.currentDrawing
    };

    try {
      const gistData = {
        description: `${this.GIST_DESCRIPTION} - ${session.name}`,
        public: false, // Private gist
        files: {
          [`session-${session.id}.json`]: {
            content: JSON.stringify(sessionData, null, 2)
          }
        }
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      };

      if (this.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${this.GITHUB_TOKEN}`;
      }

      const response = await fetch(`${this.GITHUB_API}/gists`, {
        method: 'POST',
        headers,
        body: JSON.stringify(gistData)
      });

      if (response.ok) {
        const gist = await response.json();
        // Store gist ID for later retrieval
        this.storeGistId(session.id, gist.id);
        console.log(`Session saved to gist: ${gist.html_url}`);
      } else {
        throw new Error(`GitHub API error: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to save to GitHub Gist, using fallback:', error);
      this.saveFallback(session.id, sessionData);
    }
  }

  static async getSession(sessionId: string): Promise<GameSession | null> {
    try {
      const gistId = this.getGistId(sessionId);
      if (gistId) {
        const response = await fetch(`${this.GITHUB_API}/gists/${gistId}`);
        if (response.ok) {
          const gist = await response.json();
          const fileName = `session-${sessionId}.json`;
          const file = gist.files[fileName];
          
          if (file && file.content) {
            const sessionData: GistSessionData = JSON.parse(file.content);
            if (this.isSessionValid(sessionData)) {
              return sessionData.session;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch from GitHub Gist:', error);
    }

    // Fallback to localStorage
    const fallbackData = this.getFallback(sessionId);
    return fallbackData && this.isSessionValid(fallbackData) ? fallbackData.session : null;
  }

  static async getSessionIds(): Promise<string[]> {
    // For GitHub Gists, we need to store session IDs locally
    // since we can't easily list all gists without authentication
    const gistIds = this.getAllGistIds();
    const fallbackIds = this.getFallbackSessionIds();
    
    // Combine and deduplicate
    const allIds = [...new Set([...Object.keys(gistIds), ...fallbackIds])];
    
    // Validate sessions still exist and are not expired
    const validIds: string[] = [];
    for (const sessionId of allIds) {
      try {
        const session = await this.getSession(sessionId);
        if (session) {
          validIds.push(sessionId);
        }
      } catch (error) {
        console.warn(`Session ${sessionId} validation failed:`, error);
      }
    }
    
    return validIds;
  }

  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const gistId = this.getGistId(sessionId);
      if (gistId && this.GITHUB_TOKEN) {
        await fetch(`${this.GITHUB_API}/gists/${gistId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${this.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
      }
      this.removeGistId(sessionId);
    } catch (error) {
      console.warn('Failed to delete from GitHub Gist:', error);
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

  // Gist ID management
  private static storeGistId(sessionId: string, gistId: string): void {
    const gistIds = this.getAllGistIds();
    gistIds[sessionId] = gistId;
    localStorage.setItem('egokoro_gist_ids', JSON.stringify(gistIds));
  }

  private static getGistId(sessionId: string): string | null {
    const gistIds = this.getAllGistIds();
    return gistIds[sessionId] || null;
  }

  private static removeGistId(sessionId: string): void {
    const gistIds = this.getAllGistIds();
    delete gistIds[sessionId];
    localStorage.setItem('egokoro_gist_ids', JSON.stringify(gistIds));
  }

  private static getAllGistIds(): Record<string, string> {
    try {
      const stored = localStorage.getItem('egokoro_gist_ids');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  // Fallback localStorage methods
  private static saveFallback(sessionId: string, sessionData: GistSessionData): void {
    const sessions = this.getAllFallback();
    sessions[sessionId] = sessionData;
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getFallback(sessionId: string): GistSessionData | null {
    const sessions = this.getAllFallback();
    return sessions[sessionId] || null;
  }

  private static deleteFallback(sessionId: string): void {
    const sessions = this.getAllFallback();
    delete sessions[sessionId];
    localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(sessions));
  }

  private static getAllFallback(): Record<string, GistSessionData> {
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

  private static isSessionValid(sessionData: GistSessionData): boolean {
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