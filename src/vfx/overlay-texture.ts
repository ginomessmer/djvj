import * as THREE from 'three';

const WIDTH = 1024;
const HEIGHT = 512;
/** Width / height of the mark (the canvas it is drawn on). */
export const OVERLAY_ASPECT = WIDTH / HEIGHT;

/** Draws the DJ name and/or logo onto a transparent canvas used as a texture. */
export class OverlayTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private logo: HTMLImageElement | null = null;
  private logoUrl = '';
  private drawnKey = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.texture = new THREE.CanvasTexture(this.canvas);
  }

  /** Redraws only when the name or the logo changed (the logo loads asynchronously). */
  update(name: string, logoUrl: string): void {
    if (logoUrl !== this.logoUrl) this.loadLogo(logoUrl);
    const key = `${name}\u0000${this.logoUrl}\u0000${this.logo ? 'loaded' : 'none'}`;
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    this.draw(name.trim().toUpperCase());
  }

  dispose(): void {
    this.texture.dispose();
  }

  private loadLogo(logoUrl: string): void {
    this.logoUrl = logoUrl;
    this.logo = null;
    if (!logoUrl) return;
    const image = new Image();
    image.onload = () => {
      if (this.logoUrl === logoUrl) this.logo = image;
    };
    image.src = logoUrl;
  }

  private draw(name: string): void {
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);

    const nameHeight = name ? (this.logo ? 150 : HEIGHT) : 0;
    if (this.logo) this.drawLogo(context, HEIGHT - nameHeight);
    if (name) this.drawName(context, name, HEIGHT - nameHeight, nameHeight);
    this.texture.needsUpdate = true;
  }

  private drawLogo(context: CanvasRenderingContext2D, areaHeight: number): void {
    const logo = this.logo as HTMLImageElement;
    const padding = 24;
    const scale = Math.min(
      (WIDTH - 2 * padding) / logo.width,
      (areaHeight - 2 * padding) / logo.height,
    );
    const width = logo.width * scale;
    const height = logo.height * scale;
    context.drawImage(logo, (WIDTH - width) / 2, (areaHeight - height) / 2, width, height);
  }

  private drawName(
    context: CanvasRenderingContext2D,
    name: string,
    top: number,
    areaHeight: number,
  ): void {
    let size = Math.min(150, areaHeight * 0.6);
    const font = (px: number) => `700 ${px}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    context.font = font(size);
    context.letterSpacing = `${Math.round(size * 0.12)}px`;
    const width = context.measureText(name).width;
    if (width > WIDTH - 80) {
      size *= (WIDTH - 80) / width;
      context.font = font(size);
      context.letterSpacing = `${Math.round(size * 0.12)}px`;
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.shadowColor = 'rgba(255, 255, 255, 0.55)';
    context.shadowBlur = size * 0.25;
    context.fillText(name, WIDTH / 2, top + areaHeight / 2);
    context.shadowBlur = 0;
  }
}
