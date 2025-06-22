import { GameApp } from './utils/GameApp';

// Initialize the game application
const gameApp = new GameApp();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await gameApp.initializeUI();
        console.log('Game app initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game app:', error);
        // Show user-friendly error message
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #ff4444; color: white; padding: 10px 20px; border-radius: 5px; z-index: 1000;';
        errorMsg.textContent = 'アプリケーションの初期化に失敗しました。ページを再読み込みしてください。';
        document.body.appendChild(errorMsg);
    }
    
    // Add some UI enhancements
    initializeUIEnhancements();
});

function initializeUIEnhancements(): void {
    // Update slider value displays
    const lineWidthSlider = document.getElementById('line-width') as HTMLInputElement;
    const lineWidthValue = document.getElementById('line-width-value');
    
    if (lineWidthSlider && lineWidthValue) {
        lineWidthSlider.addEventListener('input', (e) => {
            lineWidthValue.textContent = (e.target as HTMLInputElement).value;
        });
    }
    
    const opacitySlider = document.getElementById('opacity') as HTMLInputElement;
    const opacityValue = document.getElementById('opacity-value');
    
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', (e) => {
            opacityValue.textContent = (e.target as HTMLInputElement).value;
        });
    }
    
    // Add navigation helpers
    addNavigationHelpers();
    
    // Add keyboard shortcuts
    addKeyboardShortcuts();
    
    // Add mobile-specific enhancements
    addMobileEnhancements();
}

function addNavigationHelpers(): void {
    // Back button functionality for forms
    const backButtons = document.querySelectorAll('button[onclick="history.back()"]');
    backButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            showHomeScreen();
        });
    });
}

function showHomeScreen(): void {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    const homeScreen = document.getElementById('home-screen');
    if (homeScreen) {
        homeScreen.classList.add('active');
    }
}

function addKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal[style*="block"]') as HTMLElement;
            if (modal) {
                modal.style.display = 'none';
            }
        }
        
        // Enter to send chat message when input is focused
        if (e.key === 'Enter') {
            const chatInput = document.getElementById('chat-input') as HTMLInputElement;
            if (document.activeElement === chatInput) {
                e.preventDefault();
                const sendButton = document.querySelector('.send-button') as HTMLButtonElement;
                if (sendButton) {
                    sendButton.click();
                }
            }
        }
        
        // Number keys for color selection
        if (e.key >= '1' && e.key <= '9') {
            const colorIndex = parseInt(e.key) - 1;
            const colorButtons = document.querySelectorAll('.color-btn');
            if (colorButtons[colorIndex]) {
                (colorButtons[colorIndex] as HTMLElement).click();
            }
        }
        
        // C for clear canvas
        if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
            e.preventDefault();
            const clearButton = document.getElementById('clear-canvas-btn') as HTMLButtonElement;
            if (clearButton) {
                clearButton.click();
            }
        }
    });
}

function addMobileEnhancements(): void {
    // Prevent zoom on double tap for iOS
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Add touch feedback for buttons
    const buttons = document.querySelectorAll('.btn, .color-btn');
    buttons.forEach(button => {
        button.addEventListener('touchstart', () => {
            button.classList.add('touch-active');
        });
        
        button.addEventListener('touchend', () => {
            setTimeout(() => {
                button.classList.remove('touch-active');
            }, 150);
        });
    });
    
    // Optimize canvas for touch devices
    const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
    if (canvas) {
        // Prevent scrolling when drawing
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
}

// Add touch feedback styles
const style = document.createElement('style');
style.textContent = `
    .touch-active {
        opacity: 0.7;
        transform: scale(0.95);
    }
    
    @media (hover: none) {
        .btn:hover {
            transform: none;
            box-shadow: none;
        }
        
        .color-btn:hover {
            transform: none;
        }
    }
`;
document.head.appendChild(style);

// Error handling
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    // Could add user-friendly error reporting here
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    // Could add user-friendly error reporting here
});

// Service worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Could register a service worker here for offline capabilities
        console.log('Service worker support detected');
    });
}

// Export for debugging purposes
(window as any).gameApp = gameApp;