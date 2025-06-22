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
    // 日本語入力問題の根本的解決：
    // 1. Google日本語入力は compositionend の後すぐに Enter keydown を発火させる
    // 2. isComposing は常に false になってしまう場合がある
    // 3. より確実な方法として、Enter時に文字が変化したかを判定する
    
    let lastInputValue = '';
    let lastSentMessage = '';
    let lastSentTime = 0;
    let isComposing = false;
    let justFinishedComposition = false;
    
    // より確実なIME状態追跡
    this.chatInput.addEventListener('compositionstart', () => {
      isComposing = true;
      justFinishedComposition = false;
      console.log('🎌 Composition started');
    });
    
    this.chatInput.addEventListener('compositionend', () => {
      isComposing = false;
      justFinishedComposition = true;
      console.log('🎌 Composition ended');
      
      // 300ms後にフラグをリセット
      setTimeout(() => {
        justFinishedComposition = false;
        console.log('🎌 Composition flag reset');
      }, 300);
    });
    
    // input イベントで文字の変化を追跡
    this.chatInput.addEventListener('input', () => {
      lastInputValue = this.chatInput.value;
    });
    
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const currentMessage = this.chatInput.value.trim();
        const currentTime = Date.now();
        const timeSinceLastSent = currentTime - lastSentTime;
        
        console.log('🎌 Enter pressed:', {
          isComposing,
          justFinishedComposition,
          'e.isComposing': e.isComposing,
          currentMessage,
          lastInputValue,
          'message changed': currentMessage !== lastInputValue.trim(),
          timeSinceLastSent
        });
        
        // 送信をブロックする条件：
        // 1. 現在 IME 変換中
        // 2. 変換が終わったばかり（300ms以内）
        // 3. 同じメッセージを短時間で重複送信
        // 4. 空のメッセージ
        if (isComposing || 
            e.isComposing || 
            justFinishedComposition ||
            !currentMessage ||
            (currentMessage === lastSentMessage && timeSinceLastSent < 1000)) {
          console.log('🎌 Blocking send due to IME or duplicate');
          return;
        }
        
        // Enterが文字確定のためではなく、送信のためかを判定
        // Google IME では確定時に文字が変化する
        const isActualSend = currentMessage.length > 0 && 
                           currentMessage === lastInputValue.trim();
        
        if (!isActualSend) {
          console.log('🎌 Enter was for text confirmation, not sending');
          return;
        }
        
        e.preventDefault();
        lastSentMessage = currentMessage;
        lastSentTime = currentTime;
        this.sendMessage();
        console.log('🎌 Message sent:', currentMessage);
      }
    });

    // Send button click handler
    const sendButton = this.chatContainer.querySelector('.send-button') as HTMLButtonElement;
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        const currentMessage = this.chatInput.value.trim();
        if (currentMessage) {
          this.sendMessage();
        }
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