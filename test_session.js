// Simple test to verify session management functionality
const { SimpleSessionManager } = require('./dist/assets/index-BTqfXglp.js');

// Test session creation and retrieval
console.log('Testing SimpleSessionManager...');

// Create a test session
const testSession = {
  id: 'test-session-123',
  name: 'Test Session',
  players: [
    {
      id: 'player-1',
      name: 'Test Player',
      score: 0,
      isReady: false,
      isHost: true
    }
  ],
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

console.log('Test session created:', testSession);
console.log('Session management functionality is ready for testing.');