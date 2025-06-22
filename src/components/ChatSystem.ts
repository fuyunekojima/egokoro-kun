import { ChatMessage } from '../types';

export class ChatSystem {
  private chatContainer: HTMLElement;
  private chatInput: HTMLInputElement;
  private chatMessages: HTMLElement;
  private floatingContainer: HTMLElement;
  private messages: ChatMessage[] = [];
  private onMessageCallback?: (message: string) => void;

  constructor(
    chatContainer: HTMLElement,
    chatInput: HTMLInputElement,
    chatMessages: HTMLElement,
    floatingContainer: HTMLElement
  ) {
    this.chatContainer = chatContainer;
    this.chatInput = chatInput;
    this.chatMessages = chatMessages;
    this.floatingContainer = floatingContainer;
    this.bindEvents();
  }

  private bindEvents(): void {
    // 正しいIME対応：keydownではなくkeyupを使用
    // IME確定のEnterはkeyupで検出できる
    this.chatInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        // IME変換中でない場合のみ送信
        this.sendMessage();
      }
    });

    // Send button click handler
    const sendButton = this.chatContainer.querySelector('.send-button') as HTMLButtonElement;
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        this.sendMessage();
      });
    }
  }

  private sendMessage(): void {
    const message = this.chatInput.value.trim();
    if (!message) return;

    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }

    this.chatInput.value = '';
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.displayMessage(message);
    this.showFloatingMessage(message);
    this.scrollToBottom();
  }

  private displayMessage(message: ChatMessage): void {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${message.isCorrect ? 'correct' : ''}`;
    
    const timeString = new Date(message.timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageElement.innerHTML = `
      <div class="message-header">
        <span class="player-name">${this.escapeHtml(message.playerName)}</span>
        <span class="timestamp">${timeString}</span>
        ${message.isCorrect ? '<span class="correct-badge">正解!</span>' : ''}
      </div>
      <div class="message-content">${this.escapeHtml(message.message)}</div>
    `;

    this.chatMessages.appendChild(messageElement);

    // Remove old messages if too many
    while (this.chatMessages.children.length > 100) {
      this.chatMessages.removeChild(this.chatMessages.firstChild!);
    }
  }

  private showFloatingMessage(message: ChatMessage): void {
    const floatingMessage = document.createElement('div');
    floatingMessage.className = `floating-message ${message.isCorrect ? 'correct' : ''}`;
    floatingMessage.innerHTML = `
      <span class="floating-name">${this.escapeHtml(message.playerName)}</span>
      <span class="floating-text">${this.escapeHtml(message.message)}</span>
    `;

    this.floatingContainer.appendChild(floatingMessage);

    // Animate the floating message
    const animationDuration = 8000; // 8 seconds
    floatingMessage.style.animation = `floatMessage ${animationDuration}ms linear`;

    // Remove the message after animation
    setTimeout(() => {
      if (floatingMessage.parentNode) {
        floatingMessage.parentNode.removeChild(floatingMessage);
      }
    }, animationDuration);
  }

  private scrollToBottom(): void {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearMessages(): void {
    this.messages = [];
    this.chatMessages.innerHTML = '';
    this.floatingContainer.innerHTML = '';
  }

  setInputEnabled(enabled: boolean): void {
    this.chatInput.disabled = !enabled;
    this.chatInput.placeholder = enabled ? 'ひらがなで答えを入力...' : 'チャット無効';
  }

  onMessage(callback: (message: string) => void): void {
    this.onMessageCallback = callback;
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }
}