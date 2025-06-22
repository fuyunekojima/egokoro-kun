import { GameSession, Player, TopicValue, GameSettings, ChatMessage, DrawingData } from '../types';
import { v4 as uuidv4 } from 'uuid';
import topicsData from '../data/topics.json';
import { SimpleSessionManager } from './SimpleSessionManager';

export class GameManager {
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    // Cleanup expired sessions on initialization
    SimpleSessionManager.cleanup();
  }

  async createSession(hostName: string, sessionName: string, password?: string): Promise<GameSession> {
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
        timeLimit: 60
      },
      round: 1,
      turn: 1,
      usedDrawers: []
    };

    SimpleSessionManager.saveSession(session);
    return session;
  }

  async joinSession(sessionId: string, playerName: string, password?: string): Promise<{ success: boolean; session?: GameSession; player?: Player; error?: string }> {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'セッションが見つかりません' };
    }

    if (session.password && session.password !== password) {
      return { success: false, error: 'パスワードが間違っています' };
    }

    if (session.gameState === 'playing') {
      return { success: false, error: 'ゲーム中のため参加できません' };
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
    SimpleSessionManager.saveSession(session);
    this.emit('playerJoined', { session, player: newPlayer });
    
    return { success: true, session, player: newPlayer };
  }

  leaveSession(sessionId: string, playerId: string): boolean {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session) return false;

    const playerIndex = session.players.findIndex((p: Player) => p.id === playerId);
    if (playerIndex === -1) return false;

    const player = session.players[playerIndex];
    session.players.splice(playerIndex, 1);

    if (session.players.length === 0) {
      SimpleSessionManager.deleteSession(sessionId);
    } else {
      if (player.isHost && session.players.length > 0) {
        session.players[0].isHost = true;
      }
      SimpleSessionManager.saveSession(session);
    }

    this.emit('playerLeft', { session, player });
    return true;
  }

  toggleReady(sessionId: string, playerId: string): boolean {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session) return false;

    const player = session.players.find((p: Player) => p.id === playerId);
    if (!player) return false;

    player.isReady = !player.isReady;
    SimpleSessionManager.saveSession(session);
    this.emit('playerReadyChanged', { session, player });
    return true;
  }

  startGame(sessionId: string, hostId: string): boolean {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session) return false;

    const host = session.players.find((p: Player) => p.id === hostId);
    if (!host || !host.isHost) return false;

    const allReady = session.players.every((p: Player) => p.isReady);
    if (!allReady || session.players.length < 2) return false;

    session.gameState = 'playing';
    session.round = 1;
    session.turn = 1;
    session.usedDrawers = [];
    
    this.selectNextDrawer(session);
    this.selectRandomTopic(session);
    
    SimpleSessionManager.saveSession(session);
    this.emit('gameStarted', { session });
    return true;
  }

  private selectNextDrawer(session: GameSession): void {
    const availableDrawers = session.players.filter((p: Player) => !session.usedDrawers.includes(p.id));
    
    if (availableDrawers.length === 0) {
      session.usedDrawers = [];
      session.round++;
      if (session.round > session.settings.maxRounds) {
        this.endGame(session);
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

  checkAnswer(sessionId: string, playerId: string, answer: string): { isCorrect: boolean; correctAnswer?: string } {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session || !session.currentTopic) {
      return { isCorrect: false };
    }

    const normalizedAnswer = answer.toLowerCase().trim();
    const isCorrect = session.currentTopic.answerNames.some((correctAnswer: string) => 
      correctAnswer.toLowerCase().includes(normalizedAnswer) || 
      normalizedAnswer.includes(correctAnswer.toLowerCase())
    );

    if (isCorrect) {
      const player = session.players.find((p: Player) => p.id === playerId);
      const drawer = session.players.find((p: Player) => p.id === session.currentDrawer);
      
      if (player) player.score += session.settings.correctAnswerPoints;
      if (drawer) drawer.score += session.settings.drawerPoints;
      
      SimpleSessionManager.saveSession(session);
      this.emit('correctAnswer', { session, player, answer });
      
      setTimeout(() => this.nextTurn(session), 2000);
    }

    return { 
      isCorrect, 
      correctAnswer: isCorrect ? session.currentTopic.answerNames[0] : undefined 
    };
  }

  private nextTurn(session: GameSession): void {
    this.selectNextDrawer(session);
    this.selectRandomTopic(session);
    SimpleSessionManager.saveSession(session);
    this.emit('nextTurn', { session });
  }

  private endGame(session: GameSession): void {
    session.gameState = 'finished';
    session.players.forEach((p: Player) => p.isReady = false);
    SimpleSessionManager.saveSession(session);
    this.emit('gameEnded', { session });
  }

  updateSettings(sessionId: string, playerId: string, settings: Partial<GameSettings>): boolean {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session) return false;

    const player = session.players.find((p: Player) => p.id === playerId);
    if (!player || !player.isHost) return false;

    Object.assign(session.settings, settings);
    SimpleSessionManager.saveSession(session);
    this.emit('settingsUpdated', { session });
    return true;
  }

  addChatMessage(sessionId: string, playerId: string, message: string): ChatMessage | null {
    const session = SimpleSessionManager.getSession(sessionId);
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
      const { isCorrect } = this.checkAnswer(sessionId, playerId, message);
      chatMessage.isCorrect = isCorrect;
    }

    SimpleSessionManager.addChatMessage(sessionId, chatMessage);
    this.emit('chatMessage', { session, message: chatMessage });
    return chatMessage;
  }

  broadcastDrawing(sessionId: string, drawingData: DrawingData): void {
    const session = SimpleSessionManager.getSession(sessionId);
    if (!session) return;

    SimpleSessionManager.updateDrawing(sessionId, drawingData);
    this.emit('drawingUpdate', { session, drawingData });
  }

  // Debug and utility methods
  async getAllSessions(): Promise<string[]> {
    return SimpleSessionManager.getSessionIds();
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    return SimpleSessionManager.getSession(sessionId);
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