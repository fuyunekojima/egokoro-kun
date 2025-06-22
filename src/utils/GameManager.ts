import { GameSession, Player, TopicValue, GameSettings, ChatMessage, DrawingData } from '../types';
import { v4 as uuidv4 } from 'uuid';
import topicsData from '../data/topics.json';

export class GameManager {
  private sessions: Map<string, GameSession> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();

  createSession(hostName: string, sessionName: string, password?: string): GameSession {
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

    this.sessions.set(sessionId, session);
    return session;
  }

  joinSession(sessionId: string, playerName: string, password?: string): { success: boolean; session?: GameSession; player?: Player; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'セッションが見つかりません' };
    }

    if (session.password && session.password !== password) {
      return { success: false, error: 'パスワードが間違っています' };
    }

    if (session.gameState === 'playing') {
      return { success: false, error: 'ゲーム中のため参加できません' };
    }

    const existingPlayer = session.players.find(p => p.name === playerName);
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
    this.emit('playerJoined', { session, player: newPlayer });
    
    return { success: true, session, player: newPlayer };
  }

  leaveSession(sessionId: string, playerId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const playerIndex = session.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;

    const player = session.players[playerIndex];
    session.players.splice(playerIndex, 1);

    if (session.players.length === 0) {
      this.sessions.delete(sessionId);
    } else if (player.isHost && session.players.length > 0) {
      session.players[0].isHost = true;
    }

    this.emit('playerLeft', { session, playerId });
    return true;
  }

  setPlayerReady(sessionId: string, playerId: string, isReady: boolean): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const player = session.players.find(p => p.id === playerId);
    if (!player) return false;

    player.isReady = isReady;
    this.emit('playerReadyChanged', { session, player });
    return true;
  }

  canStartGame(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.players.length < 2) return false;
    
    return session.players.every(p => p.isReady);
  }

  startGame(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !this.canStartGame(sessionId)) return false;

    session.gameState = 'playing';
    session.round = 1;
    session.turn = 1;
    session.usedDrawers = [];
    
    this.selectNextDrawer(session);
    this.selectRandomTopic(session);
    
    this.emit('gameStarted', { session });
    return true;
  }

  private selectNextDrawer(session: GameSession): void {
    const availablePlayers = session.players.filter(p => !session.usedDrawers.includes(p.id));
    
    if (availablePlayers.length === 0) {
      session.round++;
      session.turn = 1;
      session.usedDrawers = [];
      
      if (session.round > session.settings.maxRounds) {
        this.endGame(session);
        return;
      }
      
      this.selectNextDrawer(session);
      return;
    }

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedDrawer = availablePlayers[randomIndex];
    
    session.currentDrawer = selectedDrawer.id;
    session.usedDrawers.push(selectedDrawer.id);
    session.turn++;
  }

  private selectRandomTopic(session: GameSession): void {
    const selectedThemes = topicsData.topic.themes.filter(theme => 
      session.settings.selectedThemes.includes(theme.name)
    );
    
    if (selectedThemes.length === 0) return;

    const allTopics: TopicValue[] = [];
    selectedThemes.forEach(theme => {
      allTopics.push(...theme.values);
    });

    const randomIndex = Math.floor(Math.random() * allTopics.length);
    session.currentTopic = allTopics[randomIndex];
  }

  checkAnswer(sessionId: string, playerId: string, answer: string): { isCorrect: boolean; session?: GameSession } {
    const session = this.sessions.get(sessionId);
    if (!session || !session.currentTopic || session.currentDrawer === playerId) {
      return { isCorrect: false };
    }

    const normalizedAnswer = answer.toLowerCase().trim();
    const isCorrect = session.currentTopic.answerNames.some(correctAnswer => 
      correctAnswer.toLowerCase() === normalizedAnswer
    );

    if (isCorrect) {
      const player = session.players.find(p => p.id === playerId);
      const drawer = session.players.find(p => p.id === session.currentDrawer);
      
      if (player) player.score += session.settings.correctAnswerPoints;
      if (drawer) drawer.score += session.settings.drawerPoints;

      this.emit('correctAnswer', { session, playerId, answer });
      
      setTimeout(() => {
        this.nextTurn(session);
      }, 3000);
    }

    return { isCorrect, session };
  }

  private nextTurn(session: GameSession): void {
    this.selectNextDrawer(session);
    this.selectRandomTopic(session);
    this.emit('nextTurn', { session });
  }

  private endGame(session: GameSession): void {
    session.gameState = 'finished';
    session.players.forEach(p => p.isReady = false);
    this.emit('gameEnded', { session });
  }

  updateSettings(sessionId: string, playerId: string, settings: Partial<GameSettings>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const player = session.players.find(p => p.id === playerId);
    if (!player || !player.isHost) return false;

    Object.assign(session.settings, settings);
    this.emit('settingsUpdated', { session });
    return true;
  }

  addChatMessage(sessionId: string, playerId: string, message: string): ChatMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const player = session.players.find(p => p.id === playerId);
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

    this.emit('chatMessage', { session, message: chatMessage });
    return chatMessage;
  }

  broadcastDrawing(sessionId: string, drawingData: DrawingData): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.emit('drawingData', { session, drawingData });
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
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