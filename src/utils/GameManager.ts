import { GameSession, Player, TopicValue, GameSettings, ChatMessage, DrawingData, SessionListItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import topicsData from '../data/topics.json';
import { FirebaseSessionManager } from './FirebaseSessionManager';
import { authenticateAnonymously, onAuthStateChange } from './firebase';

export class GameManager {
  private eventListeners: Map<string, Function[]> = new Map();
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();
  private isAuthenticated: boolean = false;
  private initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    // 認証状態の監視を開始
    onAuthStateChange((isAuthenticated) => {
      this.isAuthenticated = isAuthenticated;
      console.log('Authentication state changed:', isAuthenticated);
      
      // 認証完了後にクリーンアップを実行
      if (isAuthenticated) {
        FirebaseSessionManager.cleanup();
      }
    });

    // 匿名認証を実行
    try {
      const success = await authenticateAnonymously();
      if (!success) {
        console.error('Authentication failed, multiplayer features may not work');
      }
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
    }
  }

  async waitForInitialization(): Promise<void> {
    await this.initializationPromise;
  }

  private async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated) {
      return true;
    }

    console.log('Not authenticated, attempting to authenticate...');
    return await authenticateAnonymously();
  }

  async createSession(hostName: string, sessionName: string, password?: string): Promise<GameSession> {
    if (!(await this.ensureAuthenticated())) {
      throw new Error('Authentication failed');
    }

    const sessionId = uuidv4();
    const hostPlayer: Player = {
      id: uuidv4(),
      name: hostName,
      score: 0,
      isReady: false,
      isHost: true
    };

    const session: GameSession = {
      id: sessionId,
      name: sessionName,
      password,
      players: [hostPlayer],
      gameState: 'waiting',
      settings: {
        maxRounds: 2,
        correctAnswerPoints: 10,
        drawerPoints: 5,
        selectedThemes: ['音楽', '動物', '食べ物'],
        timeLimit: 120, // 120秒のタイムリミット
        maxPlayers: 8 // 最大8人
      },
      round: 1,
      turn: 1,
      usedDrawers: []
    };

    await FirebaseSessionManager.saveSession(session);
    return session;
  }

  async joinSession(sessionId: string, playerName: string, password?: string): Promise<{ success: boolean; session?: GameSession; player?: Player; error?: string }> {
    if (!(await this.ensureAuthenticated())) {
      return { success: false, error: 'Authentication failed' };
    }

    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'セッションが見つかりません' };
    }

    if (session.password && session.password !== password) {
      return { success: false, error: 'パスワードが間違っています' };
    }

    if (session.gameState === 'playing') {
      return { success: false, error: 'ゲーム中のため参加できません' };
    }

    if (session.players.length >= session.settings.maxPlayers) {
      return { success: false, error: 'セッションが満員です' };
    }

    const existingPlayer = session.players.find((p: Player) => p.name === playerName);
    if (existingPlayer) {
      return { success: false, error: 'その名前は既に使用されています' };
    }

    const newPlayer: Player = {
      id: uuidv4(),
      name: playerName,
      score: 0,
      isReady: false,
      isHost: false
    };

    session.players.push(newPlayer);
    await FirebaseSessionManager.saveSession(session);
    this.emit('playerJoined', { session, player: newPlayer });
    
    return { success: true, session, player: newPlayer };
  }

  async leaveSession(sessionId: string, playerId: string): Promise<boolean> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) return false;

    const playerIndex = session.players.findIndex((p: Player) => p.id === playerId);
    if (playerIndex === -1) return false;

    const player = session.players[playerIndex];
    session.players.splice(playerIndex, 1);

    if (session.players.length === 0) {
      await FirebaseSessionManager.deleteSession(sessionId);
    } else {
      if (player.isHost && session.players.length > 0) {
        session.players[0].isHost = true;
      }
      await FirebaseSessionManager.saveSession(session);
    }

    this.emit('playerLeft', { session, player });
    return true;
  }

  async toggleReady(sessionId: string, playerId: string): Promise<boolean> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) return false;

    const player = session.players.find((p: Player) => p.id === playerId);
    if (!player) return false;

    player.isReady = !player.isReady;
    await FirebaseSessionManager.saveSession(session);
    this.emit('playerReadyChanged', { session, player });
    return true;
  }

  async startGame(sessionId: string, hostId: string): Promise<boolean> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) return false;

    const host = session.players.find((p: Player) => p.id === hostId);
    if (!host || !host.isHost) return false;

    const allReady = session.players.every((p: Player) => p.isReady);
    if (!allReady || session.players.length < 2) return false;

    session.gameState = 'playing';
    session.round = 1;
    session.turn = 1;
    session.usedDrawers = [];
    
    await this.selectNextDrawer(session);
    this.selectRandomTopic(session);
    
    await FirebaseSessionManager.saveSession(session);
    this.startTurnTimer(session);
    this.emit('gameStarted', { session });
    return true;
  }

  private async selectNextDrawer(session: GameSession): Promise<void> {
    const availableDrawers = session.players.filter((p: Player) => !session.usedDrawers.includes(p.id));
    
    if (availableDrawers.length === 0) {
      session.usedDrawers = [];
      session.round++;
      if (session.round > session.settings.maxRounds) {
        await this.endGame(session);
        return;
      }
    }

    const randomDrawer = availableDrawers[Math.floor(Math.random() * availableDrawers.length)];
    session.currentDrawer = randomDrawer.id;
    session.usedDrawers.push(randomDrawer.id);
  }

  private selectRandomTopic(session: GameSession): void {
    const availableTopics: TopicValue[] = [];
    
    session.settings.selectedThemes.forEach(theme => {
      const themeTopics = (topicsData as any)[theme];
      if (themeTopics) {
        availableTopics.push(...themeTopics);
      }
    });

    if (availableTopics.length > 0) {
      const randomTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];
      session.currentTopic = randomTopic;
    }
  }

  async checkAnswer(sessionId: string, playerId: string, answer: string): Promise<{ isCorrect: boolean; correctAnswer?: string }> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session || !session.currentTopic) {
      return { isCorrect: false };
    }

    const normalizedAnswer = answer.toLowerCase().trim();
    const isCorrect = session.currentTopic.answerNames.some((correctAnswer: string) => 
      correctAnswer.toLowerCase().includes(normalizedAnswer) || 
      normalizedAnswer.includes(correctAnswer.toLowerCase())
    );

    if (isCorrect) {
      this.clearTurnTimer(session.id);
      const player = session.players.find((p: Player) => p.id === playerId);
      const drawer = session.players.find((p: Player) => p.id === session.currentDrawer);
      
      if (player) player.score += session.settings.correctAnswerPoints;
      if (drawer) drawer.score += session.settings.drawerPoints;
      
      await FirebaseSessionManager.saveSession(session);
      this.emit('correctAnswer', { session, player, answer });
      
      setTimeout(async () => await this.nextTurn(session), 2000);
    }

    return { 
      isCorrect, 
      correctAnswer: isCorrect ? session.currentTopic.answerNames[0] : undefined 
    };
  }

  private async nextTurn(session: GameSession): Promise<void> {
    this.clearTurnTimer(session.id);
    await this.selectNextDrawer(session);
    this.selectRandomTopic(session);
    await FirebaseSessionManager.saveSession(session);
    this.startTurnTimer(session);
    this.emit('nextTurn', { session });
  }

  private startTurnTimer(session: GameSession): void {
    this.clearTurnTimer(session.id);
    
    const timer = setTimeout(async () => {
      // タイムアウト時の処理
      this.emit('turnTimeout', { session });
      await this.nextTurn(session);
    }, session.settings.timeLimit * 1000);
    
    this.turnTimers.set(session.id, timer);
  }

  private clearTurnTimer(sessionId: string): void {
    const timer = this.turnTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(sessionId);
    }
  }

  private async endGame(session: GameSession): Promise<void> {
    this.clearTurnTimer(session.id);
    session.gameState = 'finished';
    session.players.forEach((p: Player) => p.isReady = false);
    await FirebaseSessionManager.saveSession(session);
    this.emit('gameEnded', { session });
  }

  async updateSettings(sessionId: string, playerId: string, settings: Partial<GameSettings>): Promise<boolean> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) return false;

    const player = session.players.find((p: Player) => p.id === playerId);
    if (!player || !player.isHost) return false;

    Object.assign(session.settings, settings);
    await FirebaseSessionManager.saveSession(session);
    this.emit('settingsUpdated', { session });
    return true;
  }

  async addChatMessage(sessionId: string, playerId: string, message: string): Promise<ChatMessage | null> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) return null;

    const player = session.players.find((p: Player) => p.id === playerId);
    if (!player) return null;

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      playerId,
      playerName: player.name,
      message,
      timestamp: Date.now()
    };

    if (session.gameState === 'playing' && session.currentDrawer !== playerId) {
      const { isCorrect } = await this.checkAnswer(sessionId, playerId, message);
      chatMessage.isCorrect = isCorrect;
    }

    await FirebaseSessionManager.addChatMessage(sessionId, chatMessage);
    this.emit('chatMessage', { session, message: chatMessage });
    return chatMessage;
  }

  async broadcastDrawing(sessionId: string, drawingData: DrawingData): Promise<void> {
    const session = await FirebaseSessionManager.getSession(sessionId);
    if (!session) return;

    await FirebaseSessionManager.updateDrawing(sessionId, drawingData);
    this.emit('drawingUpdate', { session, drawingData });
  }

  // Debug and utility methods
  async getAllSessions(): Promise<string[]> {
    return await FirebaseSessionManager.getSessionIds();
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    return await FirebaseSessionManager.getSession(sessionId);
  }

  async getSessionList(): Promise<SessionListItem[]> {
    if (!(await this.ensureAuthenticated())) {
      console.warn('Not authenticated, returning empty session list');
      return [];
    }

    const sessionIds = await FirebaseSessionManager.getSessionIds();
    const sessions: SessionListItem[] = [];

    for (const sessionId of sessionIds) {
      const session = await FirebaseSessionManager.getSession(sessionId);
      if (session) {
        const host = session.players.find(p => p.isHost);
        sessions.push({
          id: session.id,
          name: session.name,
          hasPassword: !!session.password,
          playerCount: session.players.length,
          maxPlayers: session.settings.maxPlayers,
          hostName: host?.name || 'Unknown',
          gameState: session.gameState
        });
      }
    }

    return sessions;
  }

  // Real-time synchronization methods
  subscribeToSession(sessionId: string, callback: (session: GameSession | null) => void): () => void {
    return FirebaseSessionManager.subscribeToSession(sessionId, callback);
  }

  subscribeToDrawing(sessionId: string, callback: (drawingData: DrawingData | null) => void): () => void {
    return FirebaseSessionManager.subscribeToDrawing(sessionId, callback);
  }

  subscribeToPlayerStates(sessionId: string, callback: (players: Player[]) => void): () => void {
    return FirebaseSessionManager.subscribeToPlayerStates(sessionId, callback);
  }

  removeSessionListener(sessionId: string): void {
    FirebaseSessionManager.removeListener(sessionId);
  }

  // Event system
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;
    
    listeners.forEach(listener => listener(data));
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
}