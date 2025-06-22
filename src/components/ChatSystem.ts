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
    // Qiita記事を参考にした確実なIME対応
    let isComposing = false;
    
    // compositionstart/endでIME状態を追跡
    this.chatInput.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    
    this.chatInput.addEventListener('compositionend', () => {
      isComposing = false;
    });
    
    // keydownイベントでIME状態を複数の方法でチェック
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // 記事の方法：複数の条件でIME状態をチェック
        const isIMEActive = e.isComposing || 
                           (e as any).key === 'Process' || 
                           e.keyCode === 229 || 
                           isComposing;
        
        if (!isIMEActive) {
          // IME中でない場合のみ送信
          e.preventDefault();
          this.sendMessage();
        }
      }
    });

    // input eventでも追加チェック（記事の方法2）
    this.chatInput.addEventListener('input', (e) => {
      const inputEvent = e as InputEvent;
      const imeTypes = ['insertCompositionText', 'deleteCompositionText', 'insertFromComposition', 'deleteByComposition'];
      if (imeTypes.includes(inputEvent.inputType || '')) {
        // IME入力中の場合のロギング
        console.log('IME input detected:', inputEvent.inputType);
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