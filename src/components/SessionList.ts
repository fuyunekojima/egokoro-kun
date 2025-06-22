import { SessionListItem, SessionFilter } from '../types';

export class SessionList {
  private container: HTMLElement;
  private sessions: SessionListItem[] = [];
  private filter: SessionFilter = { showPasswordProtected: true, showPublic: true };
  private onSessionSelect: (sessionId: string, hasPassword: boolean) => void;
  private onRefresh: () => void;

  constructor(
    container: HTMLElement,
    onSessionSelect: (sessionId: string, hasPassword: boolean) => void,
    onRefresh: () => void
  ) {
    this.container = container;
    this.onSessionSelect = onSessionSelect;
    this.onRefresh = onRefresh;
    this.render();
  }

  updateSessions(sessions: SessionListItem[]): void {
    this.sessions = sessions;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="session-list">
        <div class="session-list-header">
          <h3>セッション一覧</h3>
          <div class="session-controls">
            <div class="filter-controls">
              <label>
                <input type="checkbox" id="filter-public" ${this.filter.showPublic ? 'checked' : ''}>
                パブリック
              </label>
              <label>
                <input type="checkbox" id="filter-password" ${this.filter.showPasswordProtected ? 'checked' : ''}>
                パスワード付き
              </label>
            </div>
            <button id="refresh-sessions" class="btn btn-secondary">
              🔄 更新
            </button>
          </div>
        </div>
        <div class="session-list-content">
          ${this.renderSessionItems()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderSessionItems(): string {
    const filteredSessions = this.sessions.filter(session => {
      if (session.hasPassword && !this.filter.showPasswordProtected) return false;
      if (!session.hasPassword && !this.filter.showPublic) return false;
      return true;
    });

    if (filteredSessions.length === 0) {
      return '<div class="no-sessions">セッションが見つかりません</div>';
    }

    return filteredSessions.map(session => `
      <div class="session-item ${session.gameState}" data-session-id="${session.id}" data-has-password="${session.hasPassword}">
        <div class="session-info">
          <div class="session-name">
            ${session.name}
            ${session.hasPassword ? '<span class="password-icon">🔒</span>' : ''}
          </div>
          <div class="session-details">
            <span class="host-name">
              👑 ${session.hostName}
            </span>
            <span class="player-count">
              👥 ${session.playerCount}/${session.maxPlayers}
            </span>
            <span class="game-state ${session.gameState}">
              ${this.getGameStateText(session.gameState)}
            </span>
          </div>
        </div>
        <button class="join-btn ${session.gameState === 'playing' || session.playerCount >= session.maxPlayers ? 'disabled' : ''}"
                ${session.gameState === 'playing' || session.playerCount >= session.maxPlayers ? 'disabled' : ''}>
          ${session.gameState === 'playing' ? 'ゲーム中' : 
            session.playerCount >= session.maxPlayers ? '満員' : '参加'}
        </button>
      </div>
    `).join('');
  }

  private getGameStateText(state: string): string {
    switch (state) {
      case 'waiting': return '待機中';
      case 'playing': return 'ゲーム中';
      case 'finished': return '終了';
      default: return state;
    }
  }

  private attachEventListeners(): void {
    // フィルターの変更
    const publicFilter = this.container.querySelector('#filter-public') as HTMLInputElement;
    const passwordFilter = this.container.querySelector('#filter-password') as HTMLInputElement;
    
    if (publicFilter) {
      publicFilter.addEventListener('change', () => {
        this.filter.showPublic = publicFilter.checked;
        this.render();
      });
    }

    if (passwordFilter) {
      passwordFilter.addEventListener('change', () => {
        this.filter.showPasswordProtected = passwordFilter.checked;
        this.render();
      });
    }

    // 更新ボタン
    const refreshBtn = this.container.querySelector('#refresh-sessions');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.onRefresh();
      });
    }

    // セッション選択
    const sessionItems = this.container.querySelectorAll('.session-item');
    sessionItems.forEach(item => {
      const joinBtn = item.querySelector('.join-btn') as HTMLButtonElement;
      if (joinBtn && !joinBtn.disabled) {
        joinBtn.addEventListener('click', () => {
          const sessionId = item.getAttribute('data-session-id');
          const hasPassword = item.getAttribute('data-has-password') === 'true';
          if (sessionId) {
            this.onSessionSelect(sessionId, hasPassword);
          }
        });
      }
    });
  }
}