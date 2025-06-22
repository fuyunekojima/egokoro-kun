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
  password?: string;
  players: Player[];
  currentDrawer?: string;
  currentTopic?: TopicValue;
  gameState: 'waiting' | 'playing' | 'finished';
  settings: GameSettings;
  round: number;
  turn: number;
  usedDrawers: string[];
}

export interface GameSettings {
  maxRounds: number;
  correctAnswerPoints: number;
  drawerPoints: number;
  selectedThemes: string[];
  timeLimit: number;
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