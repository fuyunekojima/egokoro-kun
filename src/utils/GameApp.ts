import { GameManager } from './GameManager';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { ChatSystem } from '../components/ChatSystem';
import { GameSession, Player, GameState, DrawingData, ChatMessage } from '../types';
import topicsData from '../data/topics.json';

export class GameApp {
  private gameManager: GameManager;
  private drawingCanvas?: DrawingCanvas;
  private chatSystem?: ChatSystem;
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

  initializeUI(): void {
    this.showScreen('home');
    this.bindUIEvents();
  }

  private bindUIEvents(): void {
    // Home screen events
    const createSessionBtn = document.getElementById('create-session-btn') as HTMLButtonElement;
    const joinSessionBtn = document.getElementById('join-session-btn') as HTMLButtonElement;

    createSessionBtn?.addEventListener('click', this.showCreateSessionForm.bind(this));
    joinSessionBtn?.addEventListener('click', this.showJoinSessionForm.bind(this));

    // Create session form
    const createForm = document.getElementById('create-session-form') as HTMLFormElement;
    createForm?.addEventListener('submit', this.handleCreateSession.bind(this));

    // Join session form
    const joinForm = document.getElementById('join-session-form') as HTMLFormElement;
    joinForm?.addEventListener('submit', this.handleJoinSession.bind(this));

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
  }

  private showCreateSessionForm(): void {
    this.showScreen('create-session');
  }

  private showJoinSessionForm(): void {
    this.showScreen('join-session');
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

    const session = this.gameManager.createSession(hostName, sessionName, password);
    this.gameState.session = session;
    this.gameState.currentPlayer = session.players[0];
    this.gameState.isConnected = true;

    this.showGameLobby();
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

    const result = this.gameManager.joinSession(sessionId, playerName, password);
    
    if (!result.success) {
      this.showError(result.error || '参加に失敗しました');
      return;
    }

    this.gameState.session = result.session!;
    this.gameState.currentPlayer = result.player!;
    this.gameState.isConnected = true;

    this.showGameLobby();
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
      startGameBtn.disabled = !this.gameManager.canStartGame(this.gameState.session.id) ||
                              this.gameState.session.gameState === 'playing';
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

    if (maxRoundsInput) maxRoundsInput.value = this.gameState.session.settings.maxRounds.toString();
    if (correctPointsInput) correctPointsInput.value = this.gameState.session.settings.correctAnswerPoints.toString();
    if (drawerPointsInput) drawerPointsInput.value = this.gameState.session.settings.drawerPoints.toString();

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

  private toggleReady(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer) return;

    const newReadyState = !this.gameState.currentPlayer.isReady;
    this.gameManager.setPlayerReady(
      this.gameState.session.id,
      this.gameState.currentPlayer.id,
      newReadyState
    );
  }

  private startGame(): void {
    if (!this.gameState.session) return;

    this.gameManager.startGame(this.gameState.session.id);
  }

  private leaveSession(): void {
    if (!this.gameState.session || !this.gameState.currentPlayer) return;

    this.gameManager.leaveSession(this.gameState.session.id, this.gameState.currentPlayer.id);
    this.gameState.session = null;
    this.gameState.currentPlayer = null;
    this.gameState.isConnected = false;
    this.gameState.messages = [];

    this.showScreen('home');
  }

  private handleSettingsUpdate(e: Event): void {
    e.preventDefault();
    if (!this.gameState.session || !this.gameState.currentPlayer?.isHost) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const maxRounds = parseInt(formData.get('max-rounds') as string);
    const correctPoints = parseInt(formData.get('correct-points') as string);
    const drawerPoints = parseInt(formData.get('drawer-points') as string);
    const selectedThemes = formData.getAll('themes') as string[];

    this.gameManager.updateSettings(this.gameState.session.id, this.gameState.currentPlayer.id, {
      maxRounds,
      correctAnswerPoints: correctPoints,
      drawerPoints: drawerPoints,
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
    this.gameState.session = data.session;
    this.updateGameUI();
  }

  private handlePlayerLeft(data: { session: GameSession; playerId: string }): void {
    this.gameState.session = data.session;
    this.updateGameUI();
  }

  private handlePlayerReadyChanged(data: { session: GameSession; player: Player }): void {
    this.gameState.session = data.session;
    if (data.player.id === this.gameState.currentPlayer?.id) {
      this.gameState.currentPlayer = data.player;
    }
    this.updateGameUI();
  }

  private handleGameStarted(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.drawingCanvas?.clear();
    this.chatSystem?.clearMessages();
    this.updateGameUI();
  }

  private handleGameEnded(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.showGameResults();
    this.updateGameUI();
  }

  private handleNextTurn(data: { session: GameSession }): void {
    this.gameState.session = data.session;
    this.drawingCanvas?.clear();
    this.updateGameUI();
  }

  private handleCorrectAnswer(data: { session: GameSession; playerId: string; answer: string }): void {
    this.gameState.session = data.session;
    this.updateGameUI();
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
}