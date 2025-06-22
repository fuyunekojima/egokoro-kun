import { GameManager } from './GameManager';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { ChatSystem } from '../components/ChatSystem';
import { SessionList } from '../components/SessionList';
import { GameSession, Player, GameState, DrawingData, ChatMessage } from '../types';
import topicsData from '../data/topics.json';

export class GameApp {
  private gameManager: GameManager;
  private drawingCanvas?: DrawingCanvas;
  private chatSystem?: ChatSystem;
  private sessionList?: SessionList;
  private selectedSessionId?: string;
  private timerInterval?: number;
  private currentTimeLeft: number = 0;
  private sessionUnsubscribe?: () => void;
  private drawingUnsubscribe?: () => void;
  private playersUnsubscribe?: () => void;
  private gameState: GameState = {
    session: null,
    currentPlayer: null,
    messages: [],
    isConnected: false
  };

  constructor() {
    this.gameManager = new GameManager();
    this.bindGameEvents();
  }

  private bindGameEvents(): void {
    this.gameManager.on('playerJoined', this.handlePlayerJoined.bind(this));
    this.gameManager.on('playerLeft', this.handlePlayerLeft.bind(this));
    this.gameManager.on('playerReadyChanged', this.handlePlayerReadyChanged.bind(this));
    this.gameManager.on('gameStarted', this.handleGameStarted.bind(this));
    this.gameManager.on('gameEnded', this.handleGameEnded.bind(this));
    this.gameManager.on('nextTurn', this.handleNextTurn.bind(this));
    this.gameManager.on('correctAnswer', this.handleCorrectAnswer.bind(this));
    this.gameManager.on('chatMessage', this.handleChatMessage.bind(this));
    this.gameManager.on('drawingData', this.handleDrawingData.bind(this));
    this.gameManager.on('settingsUpdated', this.handleSettingsUpdated.bind(this));
  }

  async initializeUI(): Promise<void> {
    this.showScreen('home');
    this.initializeSessionList();
    this.bindUIEvents();
    
    // GameManagerの初期化を待ってからセッション一覧を読み込み
    await this.gameManager.waitForInitialization();
    await this.loadSessionList();
  }

  private initializeSessionList(): void {
    const container = document.getElementById('session-list-container');
    if (container) {
      this.sessionList = new SessionList(
        container,
        this.handleSessionSelect.bind(this),
        this.loadSessionList.bind(this)
      );
    }
  }

  private async loadSessionList(): Promise<void> {
    try {
      const sessions = await this.gameManager.getSessionList();
      this.sessionList?.updateSessions(sessions);
    } catch (error) {
      console.error('Failed to load session list:', error);
    }
  }

  // main.tsから呼び出されるパブリックメソッド
  async refreshSessionList(): Promise<void> {
    await this.loadSessionList();
  }

  private handleSessionSelect(sessionId: string, hasPassword: boolean): void {
    this.selectedSessionId = sessionId;
    if (hasPassword) {
      this.showPasswordModal();
    } else {
      this.showJoinSessionForm(sessionId);
    }
  }

  private bindUIEvents(): void {
    // Home screen events
    const createSessionBtn = document.getElementById('create-session-btn') as HTMLButtonElement;
    const manualJoinBtn = document.getElementById('manual-join-btn') as HTMLButtonElement;

    createSessionBtn?.addEventListener('click', this.showCreateSessionForm.bind(this));
    manualJoinBtn?.addEventListener('click', () => this.showJoinSessionForm());

    // Debug functionality
    const debugSessionsBtn = document.getElementById('debug-sessions-btn') as HTMLButtonElement;
    const refreshSessionsBtn = document.getElementById('refresh-sessions-btn') as HTMLButtonElement;
    debugSessionsBtn?.addEventListener('click', this.toggleDebugSessions.bind(this));
    refreshSessionsBtn?.addEventListener('click', this.refreshSessionsList.bind(this));

    // Create session form
    const createForm = document.getElementById('create-session-form') as HTMLFormElement;
    createForm?.addEventListener('submit', this.handleCreateSession.bind(this));

    // Join session form
    const joinForm = document.getElementById('join-session-form') as HTMLFormElement;
    joinForm?.addEventListener('submit', this.handleJoinSession.bind(this));

    // Password modal
    const passwordForm = document.getElementById('password-form') as HTMLFormElement;
    const cancelPasswordBtn = document.getElementById('cancel-password') as HTMLButtonElement;
    passwordForm?.addEventListener('submit', this.handlePasswordSubmit.bind(this));
    cancelPasswordBtn?.addEventListener('click', this.hidePasswordModal.bind(this));

    // Game controls
    const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
    const startGameBtn = document.getElementById('start-game-btn') as HTMLButtonElement;
    const leaveSessionBtn = document.getElementById('leave-session-btn') as HTMLButtonElement;

    readyBtn?.addEventListener('click', this.toggleReady.bind(this));
    startGameBtn?.addEventListener('click', this.startGame.bind(this));
    leaveSessionBtn?.addEventListener('click', this.leaveSession.bind(this));

    // Drawing tools
    this.bindDrawingToolEvents();

    // Settings
    this.bindSettingsEvents();
  }

  private bindDrawingToolEvents(): void {
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = (e.target as HTMLElement).dataset.color;
        if (color && this.drawingCanvas) {
          this.drawingCanvas.setColor(color);
          this.updateActiveColorButton(e.target as HTMLElement);
        }
      });
    });

    const lineWidthSlider = document.getElementById('line-width') as HTMLInputElement;
    lineWidthSlider?.addEventListener('input', (e) => {
      const width = parseInt((e.target as HTMLInputElement).value);
      if (this.drawingCanvas) {
        this.drawingCanvas.setLineWidth(width);
      }
    });

    const opacitySlider = document.getElementById('opacity') as HTMLInputElement;
    opacitySlider?.addEventListener('input', (e) => {
      const opacity = parseFloat((e.target as HTMLInputElement).value);
      if (this.drawingCanvas) {
        this.drawingCanvas.setOpacity(opacity);
      }
    });

    const clearBtn = document.getElementById('clear-canvas-btn') as HTMLButtonElement;
    clearBtn?.addEventListener('click', () => {
      if (this.drawingCanvas) {
        this.drawingCanvas.clear();
      }
    });
  }

  private bindSettingsEvents(): void {
    const settingsForm = document.getElementById('settings-form') as HTMLFormElement;
    settingsForm?.addEventListener('submit', this.handleSettingsUpdate.bind(this));
  }

  private showScreen(screenName: string): void {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // ホーム画面に戻ったときにセッション一覧を更新
    if (screenName === 'home') {
      this.loadSessionList();
    }
  }

  private showCreateSessionForm(): void {
    this.showScreen('create-session');
  }

  private showJoinSessionForm(sessionId?: string): void {
    this.showScreen('join-session');
    if (sessionId) {
      const sessionIdInput = document.getElementById('session-id') as HTMLInputElement;
      if (sessionIdInput) {
        sessionIdInput.value = sessionId;
      }
    }
  }

  private showPasswordModal(): void {
    const modal = document.getElementById('password-modal');
    if (modal) {
      modal.style.display = 'flex';
      const passwordInput = document.getElementById('session-password') as HTMLInputElement;
      if (passwordInput) {
        passwordInput.focus();
      }
    }
  }

  private hidePasswordModal(): void {
    const modal = document.getElementById('password-modal');
    if (modal) {
      modal.style.display = 'none';
      const passwordInput = document.getElementById('session-password') as HTMLInputElement;
      if (passwordInput) {
        passwordInput.value = '';
      }
    }
  }

  private handlePasswordSubmit(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const password = formData.get('session-password') as string;
    
    if (!this.selectedSessionId) {
      this.showError('セッションが選択されていません');
      return;
    }

    this.hidePasswordModal();
    
    // パスワード付きでセッション参加画面を表示
    this.showJoinSessionForm(this.selectedSessionId);
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.value = password;
    }
  }

  private handleCreateSession(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const hostName = formData.get('host-name') as string;
    const sessionName = formData.get('session-name') as string;
    const password = formData.get('password') as string || undefined;

    if (!hostName.trim() || !sessionName.trim()) {
      this.showError('名前とセッション名を入力してください');
      return;
    }

    this.gameManager.createSession(hostName, sessionName, password).then(session => {
      this.gameState.session = session;
      this.gameState.currentPlayer = session.players[0];
      this.gameState.isConnected = true;

      this.startRealtimeSync(session.id);
      this.showGameLobby();
    }).catch(error => {
      console.error('Failed to create session:', error);
      this.showError('セッションの作成に失敗しました');
    });
  }

  private handleJoinSession(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const playerName = formData.get('player-name') as string;
    const sessionId = formData.get('session-id') as string;
    const password = formData.get('password') as string || undefined;

    if (!playerName.trim() || !sessionId.trim()) {
      this.showError('名前とセッションIDを入力してください');
      return;
    }

    this.gameManager.joinSession(sessionId, playerName, password).then(result => {
      if (!result.success) {
        this.showError(result.error || '参加に失敗しました');
        return;
      }

      this.gameState.session = result.session!;
      this.gameState.currentPlayer = result.player!;
      this.gameState.isConnected = true;

      this.startRealtimeSync(result.session!.id);
      this.showGameLobby();
    }).catch(error => {
      console.error('Failed to join session:', error);
      this.showError('セッションへの参加に失敗しました');
    });
  }

  private showGameLobby(): void {
    this.showScreen('game-lobby');
    this.updateLobbyUI();
    this.initializeCanvas();
    this.initializeChat();
    this.updateSettingsUI();
  }

  private initializeCanvas(): void {
    const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.drawingCanvas = new DrawingCanvas(canvas);
      this.drawingCanvas.onDraw((data: DrawingData) => {
        if (this.gameState.session) {
          this.gameManager.broadcastDrawing(this.gameState.session.id, data);
        }
      });
    }
  }

  private initializeChat(): void {
    const chatContainer = document.getElementById('chat-container')!;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const chatMessages = document.getElementById('chat-messages')!;
    const floatingContainer = document.getElementById('floating-messages')!;

    this.chatSystem = new ChatSystem(chatContainer, chatInput, chatMessages, floatingContainer);
    this.chatSystem.onMessage((message: string) => {
      if (this.gameState.session && this.gameState.currentPlayer) {
        this.gameManager.addChatMessage(
          this.gameState.session.id,
          this.gameState.currentPlayer.id,
          message
        );
      }
    });
  }

  private updateLobbyUI(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer) return;

    // Update session info
    const sessionNameEl = document.getElementById('session-name-display');
    const sessionIdEl = document.getElementById('session-id-display');
    
    if (sessionNameEl) sessionNameEl.textContent = this.gameState.session.name;
    if (sessionIdEl) sessionIdEl.textContent = this.gameState.session.id;

    // Update players list
    this.updatePlayersList();

    // Update buttons
    this.updateGameButtons();
  }

  private updatePlayersList(): void {
    const playersListEl = document.getElementById('players-list');
    if (!playersListEl || !this.gameState.session) return;

    playersListEl.innerHTML = '';
    
    this.gameState.session.players.forEach(player => {
      const playerEl = document.createElement('div');
      playerEl.className = 'player-item';
      playerEl.innerHTML = `
        <span class="player-name">${player.name}</span>
        <span class="player-score">スコア: ${player.score}</span>
        <span class="player-status">
          ${player.isHost ? '👑' : ''}
          ${player.isReady ? '✅' : '⏳'}
          ${this.gameState.session!.currentDrawer === player.id ? '🎨' : ''}
        </span>
      `;
      playersListEl.appendChild(playerEl);
    });
  }

  private updateGameButtons(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer) return;

    const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
    const startGameBtn = document.getElementById('start-game-btn') as HTMLButtonElement;

    if (readyBtn) {
      readyBtn.textContent = this.gameState.currentPlayer.isReady ? '準備解除' : '準備完了';
      readyBtn.disabled = this.gameState.session.gameState === 'playing';
    }

    if (startGameBtn) {
      startGameBtn.style.display = this.gameState.currentPlayer.isHost ? 'block' : 'none';
      const allReady = this.gameState.session.players.every(p => p.isReady);
      const hasEnoughPlayers = this.gameState.session.players.length >= 2;
      startGameBtn.disabled = !allReady || !hasEnoughPlayers || this.gameState.session.gameState === 'playing';
    }
  }

  private updateSettingsUI(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer?.isHost) return;

    const settingsContainer = document.getElementById('settings-container');
    if (settingsContainer) {
      settingsContainer.style.display = 'block';
    }

    // Update form values
    const maxRoundsInput = document.getElementById('max-rounds') as HTMLInputElement;
    const correctPointsInput = document.getElementById('correct-points') as HTMLInputElement;
    const drawerPointsInput = document.getElementById('drawer-points') as HTMLInputElement;
    const maxPlayersInput = document.getElementById('max-players') as HTMLInputElement;
    const timeLimitInput = document.getElementById('time-limit') as HTMLInputElement;

    if (maxRoundsInput) maxRoundsInput.value = this.gameState.session.settings.maxRounds.toString();
    if (correctPointsInput) correctPointsInput.value = this.gameState.session.settings.correctAnswerPoints.toString();
    if (drawerPointsInput) drawerPointsInput.value = this.gameState.session.settings.drawerPoints.toString();
    if (maxPlayersInput) maxPlayersInput.value = this.gameState.session.settings.maxPlayers.toString();
    if (timeLimitInput) timeLimitInput.value = this.gameState.session.settings.timeLimit.toString();

    // Update theme checkboxes
    this.updateThemeCheckboxes();
  }

  private updateThemeCheckboxes(): void {
    const themesContainer = document.getElementById('themes-container');
    if (!themesContainer || !this.gameState.session) return;

    themesContainer.innerHTML = '';
    
    topicsData.topic.themes.forEach(theme => {
      const isSelected = this.gameState.session!.settings.selectedThemes.includes(theme.name);
      
      const themeEl = document.createElement('label');
      themeEl.className = 'theme-checkbox';
      themeEl.innerHTML = `
        <input type="checkbox" name="themes" value="${theme.name}" ${isSelected ? 'checked' : ''}>
        <span>${theme.name}</span>
      `;
      
      themesContainer.appendChild(themeEl);
    });
  }

  private async toggleReady(): Promise<void> {
    if (!this.gameState.session || !this.gameState.currentPlayer) {
      console.error('Cannot toggle ready: missing session or currentPlayer', {
        hasSession: !!this.gameState.session,
        hasCurrentPlayer: !!this.gameState.currentPlayer
      });
      return;
    }

    // currentPlayerの情報を最新のセッション情報で更新
    const latestCurrentPlayer = this.gameState.session.players.find(p => p.id === this.gameState.currentPlayer!.id);
    if (latestCurrentPlayer) {
      this.gameState.currentPlayer = latestCurrentPlayer;
    }

    console.log('Attempting to toggle ready for:', {
      sessionId: this.gameState.session.id,
      playerId: this.gameState.currentPlayer.id,
      playerName: this.gameState.currentPlayer.name,
      currentReady: this.gameState.currentPlayer.isReady
    });

    try {
      const success = await this.gameManager.toggleReady(
        this.gameState.session.id,
        this.gameState.currentPlayer.id
      );
      
      if (!success) {
        console.error('Failed to toggle ready state');
        this.showError('準備状態の変更に失敗しました');
      } else {
        console.log('Successfully toggled ready state');
      }
    } catch (error) {
      console.error('Error toggling ready state:', error);
      this.showError('準備状態の変更中にエラーが発生しました');
    }
  }

  private startGame(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer) return;

    this.gameManager.startGame(this.gameState.session.id, this.gameState.currentPlayer.id);
  }

  private leaveSession(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer) return;

    this.gameManager.leaveSession(this.gameState.session.id, this.gameState.currentPlayer.id);
    this.stopRealtimeSync(); // Stop real-time synchronization
    this.stopTimer(); // Stop any running timer
    
    this.gameState.session = null;
    this.gameState.currentPlayer = null;
    this.gameState.isConnected = false;
    this.gameState.messages = [];

    this.showScreen('home');
    // ホーム画面に戻ったときにセッション一覧を更新
    this.loadSessionList();
  }

  private handleSettingsUpdate(e: Event): void {
    e.preventDefault();
    if (!this.gameState.session || !this.gameState.currentPlayer?.isHost) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const maxRounds = parseInt(formData.get('max-rounds') as string);
    const correctPoints = parseInt(formData.get('correct-points') as string);
    const drawerPoints = parseInt(formData.get('drawer-points') as string);
    const maxPlayers = parseInt(formData.get('max-players') as string);
    const timeLimit = parseInt(formData.get('time-limit') as string);
    const selectedThemes = formData.getAll('themes') as string[];

    this.gameManager.updateSettings(this.gameState.session.id, this.gameState.currentPlayer.id, {
      maxRounds,
      correctAnswerPoints: correctPoints,
      drawerPoints: drawerPoints,
      maxPlayers,
      timeLimit,
      selectedThemes
    });
  }

  private updateActiveColorButton(activeBtn: HTMLElement): void {
    const colorButtons = document.querySelectorAll('.color-btn');
    colorButtons.forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  private showError(message: string): void {
    // Simple error display - could be enhanced with a modal or toast
    alert(message);
  }

  private updateGameUI(): void {
    if (!this.gameState.session) return;

    this.updatePlayersList();
    this.updateGameButtons();
    this.updateCurrentTurnDisplay();
    this.updateDrawingPermissions();
  }

  private updateCurrentTurnDisplay(): void {
    const currentTurnEl = document.getElementById('current-turn-display');
    if (!currentTurnEl || !this.gameState.session) return;

    if (this.gameState.session.gameState === 'playing') {
      const drawer = this.gameState.session.players.find(p => p.id === this.gameState.session!.currentDrawer);
      const topic = this.gameState.session.currentTopic;
      
      if (drawer && topic) {
        const isCurrentPlayerDrawer = this.gameState.currentPlayer?.id === drawer.id;
        currentTurnEl.innerHTML = `
          <div class="turn-info">
            <div>ラウンド ${this.gameState.session.round} - ターン ${this.gameState.session.turn}</div>
            <div>描き手: ${drawer.name}</div>
            ${isCurrentPlayerDrawer ? `<div class="topic">お題: ${topic.displayName}</div>` : '<div>お題を当ててください！</div>'}
          </div>
        `;
      }
    } else {
      currentTurnEl.innerHTML = '<div>ゲーム待機中</div>';
    }
  }

  private updateDrawingPermissions(): void {
    if (!this.drawingCanvas || !this.gameState.session) return;

    const canDraw = this.gameState.session.gameState !== 'playing' || 
                   this.gameState.currentPlayer?.id === this.gameState.session.currentDrawer;
    
    this.drawingCanvas.setDrawingEnabled(canDraw);

    if (this.chatSystem) {
      const canChat = this.gameState.session.gameState !== 'playing' ||
                     this.gameState.currentPlayer?.id !== this.gameState.session.currentDrawer;
      this.chatSystem.setInputEnabled(canChat);
    }
  }

  // Event handlers
  private handlePlayerJoined(data: { session: GameSession; player: Player }): void {
    console.log('Player joined:', data.player.name);
    this.gameState.session = data.session;
    this.updateLobbyUI();
    this.updateGameUI();
  }

  private handlePlayerLeft(data: { session: GameSession; playerId: string }): void {
    console.log('Player left:', data.playerId);
    this.gameState.session = data.session;
    this.updateLobbyUI();
    this.updateGameUI();
  }

  private handlePlayerReadyChanged(data: { session: GameSession; player: Player }): void {
    this.gameState.session = data.session;
    
    // currentPlayerの状態を更新
    if (data.player.id === this.gameState.currentPlayer?.id) {
      this.gameState.currentPlayer = data.player;
    }
    
    // セッション内のプレイヤー情報も更新
    const playerIndex = this.gameState.session.players.findIndex(p => p.id === data.player.id);
    if (playerIndex !== -1) {
      this.gameState.session.players[playerIndex] = data.player;
    }
    
    this.updateLobbyUI();
    this.updateGameUI();
  }

  private handleGameStarted(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.drawingCanvas?.clear();
    this.chatSystem?.clearMessages();
    this.updateGameUI();
    this.startTimer();
  }

  private handleGameEnded(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.stopTimer();
    this.showGameResults();
    this.updateGameUI();
  }

  private handleNextTurn(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.drawingCanvas?.clear();
    this.updateGameUI();
    this.startTimer();
  }

  private handleCorrectAnswer(data: { session: GameSession; playerId: string; answer: string }): void {
    this.gameState.session = data.session;
    this.updateGameUI();
    this.stopTimer();
  }

  private startTimer(): void {
    if (!this.gameState.session) return;
    
    this.stopTimer();
    this.currentTimeLeft = this.gameState.session.settings.timeLimit;
    this.updateTimerDisplay();
    
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      timerDisplay.style.display = 'block';
    }
    
    this.timerInterval = window.setInterval(() => {
      this.currentTimeLeft--;
      this.updateTimerDisplay();
      
      if (this.currentTimeLeft <= 0) {
        this.stopTimer();
        // タイムアウト処理はGameManagerで行われる
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      timerDisplay.style.display = 'none';
    }
  }

  private updateTimerDisplay(): void {
    const timerValue = document.getElementById('timer-value');
    const timerDisplay = document.getElementById('timer-display');
    
    if (timerValue) {
      timerValue.textContent = this.currentTimeLeft.toString();
    }
    
    if (timerDisplay) {
      timerDisplay.classList.remove('warning', 'critical');
      
      if (this.currentTimeLeft <= 10) {
        timerDisplay.classList.add('critical');
      } else if (this.currentTimeLeft <= 30) {
        timerDisplay.classList.add('warning');
      }
    }
  }

  private handleChatMessage(data: { session: GameSession; message: ChatMessage }): void {
    this.gameState.session = data.session;
    this.gameState.messages.push(data.message);
    this.chatSystem?.addMessage(data.message);
  }

  private handleDrawingData(data: { session: GameSession; drawingData: DrawingData }): void {
    this.drawingCanvas?.drawFromData(data.drawingData);
  }

  private handleSettingsUpdated(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.updateSettingsUI();
  }

  private showGameResults(): void {
    if (!this.gameState.session) return;

    const sortedPlayers = [...this.gameState.session.players].sort((a, b) => b.score - a.score);
    
    let resultsHTML = '<div class="game-results"><h2>ゲーム結果</h2><div class="rankings">';
    
    sortedPlayers.forEach((player, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
      
      resultsHTML += `
        <div class="rank-item">
          <span class="rank">${rank}位 ${medal}</span>
          <span class="player-name">${player.name}</span>
          <span class="score">${player.score}点</span>
        </div>
      `;
    });
    
    resultsHTML += '</div></div>';
    
    // Show results in a modal or dedicated area
    const resultsContainer = document.getElementById('game-results-container');
    if (resultsContainer) {
      resultsContainer.innerHTML = resultsHTML;
      resultsContainer.style.display = 'block';
    }
  }

  // Real-time synchronization methods
  private startRealtimeSync(sessionId: string): void {
    this.stopRealtimeSync(); // Clean up any existing subscriptions

    // Subscribe to session updates
    this.sessionUnsubscribe = this.gameManager.subscribeToSession(sessionId, (session) => {
      if (session) {
        console.log('Session updated:', session);
        this.gameState.session = session;
        
        // currentPlayerの情報を最新に更新
        if (this.gameState.currentPlayer) {
          const updatedCurrentPlayer = session.players.find(p => p.id === this.gameState.currentPlayer!.id);
          if (updatedCurrentPlayer) {
            this.gameState.currentPlayer = updatedCurrentPlayer;
          }
        }
        
        this.updateLobbyUI();
        this.updateGameUI();
      }
    });

    // Subscribe to drawing updates
    this.drawingUnsubscribe = this.gameManager.subscribeToDrawing(sessionId, (drawingData) => {
      if (drawingData && this.drawingCanvas) {
        console.log('Drawing updated:', drawingData);
        this.drawingCanvas.drawFromData(drawingData);
      }
    });

    // Subscribe to player state updates
    this.playersUnsubscribe = this.gameManager.subscribeToPlayerStates(sessionId, (players) => {
      if (this.gameState.session && players) {
        console.log('Players updated:', players);
        this.gameState.session.players = players;
        
        // currentPlayerの情報も更新
        if (this.gameState.currentPlayer) {
          const updatedCurrentPlayer = players.find((p: Player) => p.id === this.gameState.currentPlayer!.id);
          if (updatedCurrentPlayer) {
            this.gameState.currentPlayer = updatedCurrentPlayer;
          }
        }
        
        this.updateLobbyUI();
        this.updateGameUI();
      }
    });

    console.log('Real-time synchronization started for session:', sessionId);
  }

  private stopRealtimeSync(): void {
    if (this.sessionUnsubscribe) {
      this.sessionUnsubscribe();
      this.sessionUnsubscribe = undefined;
    }

    if (this.drawingUnsubscribe) {
      this.drawingUnsubscribe();
      this.drawingUnsubscribe = undefined;
    }

    if (this.playersUnsubscribe) {
      this.playersUnsubscribe();
      this.playersUnsubscribe = undefined;
    }

    console.log('Real-time synchronization stopped');
  }



  // Debug methods
  private toggleDebugSessions(): void {
    const debugContainer = document.getElementById('debug-sessions');
    if (debugContainer) {
      const isVisible = debugContainer.style.display !== 'none';
      debugContainer.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        this.refreshSessionsList();
      }
    }
  }

  private async refreshSessionsList(): Promise<void> {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;

    try {
      const sessions = await this.gameManager.getAllSessions();
      
      if (sessions.length === 0) {
        sessionsList.innerHTML = '<p>アクティブなセッションはありません</p>';
        return;
      }

      let html = '<div class="sessions-grid">';
      for (const sessionId of sessions) {
        const session = await this.gameManager.getSession(sessionId);
        if (session) {
          html += `
            <div class="session-item" style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px;">
              <strong>${session.name}</strong><br>
              <small>ID: ${sessionId}</small><br>
              <small>プレイヤー: ${session.players.length}人</small><br>
              <small>状態: ${session.gameState}</small>
              <button onclick="navigator.clipboard.writeText('${sessionId}')" class="btn btn-small" style="margin-top: 5px;">IDをコピー</button>
            </div>
          `;
        }
      }
      html += '</div>';
      
      sessionsList.innerHTML = html;
    } catch (error) {
      console.error('Failed to refresh sessions list:', error);
      sessionsList.innerHTML = '<p>セッション一覧の取得に失敗しました</p>';
    }
  }
}