import { DrawingData } from '../types';

export class DrawingCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private currentColor = '#000000';
  private currentLineWidth = 5;
  private currentOpacity = 1;
  private onDrawCallback?: (data: DrawingData) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.setupCanvas();
    this.bindEvents();
  }

  private setupCanvas(): void {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalCompositeOperation = 'source-over';
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  private bindEvents(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.canvas.addEventListener('mousemove', this.draw.bind(this));
    this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
    this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));

    // Prevent scrolling when touching the canvas
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault());
    this.canvas.addEventListener('touchend', (e) => e.preventDefault());
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault());

    // Resize handling
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  private getEventPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    
    if (e instanceof MouseEvent) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    } else {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
  }

  private startDrawing(e: MouseEvent): void {
    this.isDrawing = true;
    const pos = this.getEventPos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  private draw(e: MouseEvent): void {
    if (!this.isDrawing) return;

    const pos = this.getEventPos(e);
    this.drawLine(this.lastX, this.lastY, pos.x, pos.y);
    
    if (this.onDrawCallback) {
      this.onDrawCallback({
        type: 'draw',
        x: pos.x,
        y: pos.y,
        prevX: this.lastX,
        prevY: this.lastY,
        color: this.currentColor,
        lineWidth: this.currentLineWidth,
        opacity: this.currentOpacity
      });
    }

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  private stopDrawing(): void {
    this.isDrawing = false;
  }

  private handleTouch(e: TouchEvent): void {
    e.preventDefault();
    
    const touch = e.touches[0] || e.changedTouches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                     e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });

    this.canvas.dispatchEvent(mouseEvent);
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.globalAlpha = this.currentOpacity;
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentLineWidth;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawFromData(data: DrawingData): void {
    if (data.type === 'clear') {
      this.clear();
      return;
    }

    if (data.type === 'draw' && data.x !== undefined && data.y !== undefined && 
        data.prevX !== undefined && data.prevY !== undefined) {
      const prevColor = this.currentColor;
      const prevLineWidth = this.currentLineWidth;
      const prevOpacity = this.currentOpacity;

      this.currentColor = data.color || this.currentColor;
      this.currentLineWidth = data.lineWidth || this.currentLineWidth;
      this.currentOpacity = data.opacity || this.currentOpacity;

      this.drawLine(data.prevX, data.prevY, data.x, data.y);

      this.currentColor = prevColor;
      this.currentLineWidth = prevLineWidth;
      this.currentOpacity = prevOpacity;
    }
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.onDrawCallback) {
      this.onDrawCallback({ type: 'clear' });
    }
  }

  setColor(color: string): void {
    this.currentColor = color;
  }

  setLineWidth(width: number): void {
    this.currentLineWidth = width;
  }

  setOpacity(opacity: number): void {
    this.currentOpacity = opacity;
  }

  setDrawingEnabled(enabled: boolean): void {
    this.canvas.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  onDraw(callback: (data: DrawingData) => void): void {
    this.onDrawCallback = callback;
  }

  getImageData(): string {
    return this.canvas.toDataURL();
  }
}