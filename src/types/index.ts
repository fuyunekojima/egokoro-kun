export interface TopicValue {
  displayName: string;
  answerNames: string[];
}

export interface Theme {
  name: string;
  values: TopicValue[];
}

export interface TopicData {
  topic: {
    themes: Theme[];
  };
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
}

export interface GameSession {
  id: string;
  name: string;
  password: string | null;
  players: Player[];
  currentDrawer?: string;
  currentTopic?: TopicValue;
  gameState: 'waiting' | 'playing' | 'finished';
  settings: GameSettings;
  round: number;
  turn: number;
  usedDrawers: string[];
  chatMessages: ChatMessage[];
  currentDrawing: DrawingData | null;
  answeredPlayers?: string[]; // プレイヤーIDのリスト（重複スコアリング防止用）
}

export interface GameSettings {
  maxRounds: number;
  correctAnswerPoints: number;
  drawerPoints: number;
  selectedThemes: string[];
  timeLimit: number; // 描画・回答時間制限（秒）
  maxPlayers: number; // 最大プレイヤー数（2-8人）
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isCorrect?: boolean;
}

export interface DrawingData {
  type: 'draw' | 'clear';
  x?: number;
  y?: number;
  prevX?: number;
  prevY?: number;
  color?: string;
  lineWidth?: number;
  opacity?: number;
}

export interface GameState {
  session: GameSession | null;
  currentPlayer: Player | null;
  messages: ChatMessage[];
  isConnected: boolean;
}

export interface SessionListItem {
  id: string;
  name: string;
  hasPassword: boolean;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  gameState: 'waiting' | 'playing' | 'finished';
}

export interface SessionFilter {
  showPasswordProtected: boolean;
  showPublic: boolean;
}