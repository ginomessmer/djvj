import * as THREE from 'three';
import type { TextContent } from '@/domain/show/text-director';
import { displayText, MAX_TEXT_LENGTH, splitGlyphs, type TextStyle } from '@/domain/show/texts';

const WIDTH = 2048;
const HEIGHT = 512;
/** Texture width: the stage picks the mip level from it. */
export const HEADLINE_TEXTURE_WIDTH = WIDTH;
/** Width / height of the text box. */
export const HEADLINE_ASPECT = WIDTH / HEIGHT;
/** Letters the shader can move one by one; longer texts move as one block from there on. */
export const MAX_GLYPHS = MAX_TEXT_LENGTH;
/** Room around the letters for the glow, which is read from blurred mip levels. */
const PAD_X = 120;
const MAX_TEXT_PX = 250;

interface Face {
  /** A CSS font for a size in px. Only system fonts: the show runs offline. */
  font: (px: number) => string;
  /** Letter spacing as a share of the size. */
  tracking: number;
  /** Outline width as a share of the size (neon draws its tubes along it). */
  stroke: number;
}

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FACES: Record<TextStyle, Face> = {
  neon: {
    font: (px) => `500 ${px}px "Avenir Next", "Futura", ${SANS}`,
    tracking: 0.08,
    stroke: 0.045,
  },
  chrome: {
    font: (px) => `italic 900 ${px}px "Futura", "Avenir Next", ${SANS}`,
    tracking: 0.04,
    stroke: 0.03,
  },
  glass: { font: (px) => `800 ${px}px ${SANS}`, tracking: 0.04, stroke: 0.025 },
  soft: {
    font: (px) => `300 ${px}px "Avenir Next", ${SANS}`,
    tracking: 0.22,
    stroke: 0.02,
  },
  glitch: {
    font: (px) => `700 ${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
    tracking: 0.02,
    stroke: 0.025,
  },
  invert: {
    font: (px) => `900 ${px}px "Helvetica Neue", ${SANS}`,
    tracking: 0,
    stroke: 0.025,
  },
};

/** Where each letter starts, as a share of the texture width; the last entry is the end. */
export type GlyphEdges = number[];

/**
 * Draws a headline text (or the name and logo mark) into a texture the composite shader styles.
 * Channels, not colours: red is the fill, green the outline, blue the detail inside a logo. The
 * shader reads blurred mip levels for glow and refraction, so letters stay crisp and the halo
 * follows each letter as it moves.
 */
export class HeadlineTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private drawnKey = '';
  private edges: GlyphEdges = [0, 1];
  private logo: HTMLImageElement | null = null;
  private logoUrl = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  /**
   * Redraws only when something changed. The text is drawn in the face of its style, so a new
   * style redraws too.
   * @returns where the letters are: one more entry than letters
   */
  update(content: TextContent, style: TextStyle, name: string, logoUrl: string): GlyphEdges {
    if (logoUrl !== this.logoUrl) this.loadLogo(logoUrl);
    const what = content.kind === 'text' ? `t:${content.text}` : `m:${name}:${this.logoUrl}`;
    const key = `${what}\u0000${style}\u0000${this.logo ? 'logo' : ''}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.draw(content, style, name);
    }
    return this.edges;
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

  private draw(content: TextContent, style: TextStyle, name: string): void {
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#000';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.globalCompositeOperation = 'lighter'; // channels add up, they never cover each other

    if (content.kind === 'text') {
      this.edges = this.drawText(
        context,
        displayText(content.text, style),
        style,
        HEIGHT / 2,
        HEIGHT,
      );
    } else {
      this.edges = [0, 1];
      const label = name.trim().toUpperCase();
      const labelHeight = label ? (this.logo ? 150 : HEIGHT) : 0;
      if (this.logo) this.drawLogo(context, HEIGHT - labelHeight);
      if (label) {
        this.drawText(context, label, style, HEIGHT - labelHeight / 2, labelHeight);
      }
    }
    this.texture.needsUpdate = true;
  }

  private drawText(
    context: CanvasRenderingContext2D,
    text: string,
    style: TextStyle,
    centreY: number,
    areaHeight: number,
  ): GlyphEdges {
    const face = FACES[style];
    const glyphs = splitGlyphs(text);
    let size = Math.min(MAX_TEXT_PX, areaHeight * 0.55);
    const setSize = (px: number) => {
      context.font = face.font(px);
      context.letterSpacing = `${Math.round(px * face.tracking)}px`;
    };
    setSize(size);
    const room = WIDTH - 2 * PAD_X;
    const natural = context.measureText(text).width;
    if (natural > room) {
      size *= room / natural;
      setSize(size);
    }

    // Measured as prefixes, so the edges keep the font's kerning.
    const prefixes = [0];
    let prefix = '';
    for (const glyph of glyphs.slice(0, MAX_GLYPHS)) {
      prefix += glyph;
      prefixes.push(context.measureText(prefix).width);
    }
    const width = context.measureText(text).width;
    // Letter spacing trails the last letter too: centre the ink, not the advance.
    const trailing = Math.round(size * face.tracking);
    const left = (WIDTH - (width - trailing)) / 2;

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = '#f0f'; // fill and detail
    context.fillText(text, left, centreY);
    context.strokeStyle = '#0f0';
    context.lineWidth = Math.max(2, size * face.stroke);
    context.lineJoin = 'round';
    context.strokeText(text, left, centreY);

    const edges = prefixes.map((x) => (left + x) / WIDTH);
    edges[edges.length - 1] = Math.max(edges[edges.length - 1], (left + width) / WIDTH);
    edges[0] = 0; // the first and last letter own the margins, and their glow
    edges[edges.length - 1] = 1;
    return edges;
  }

  /** A logo becomes a silhouette (red) with its brightness kept as detail (blue). */
  private drawLogo(context: CanvasRenderingContext2D, areaHeight: number): void {
    const logo = this.logo as HTMLImageElement;
    const padding = 32;
    const scale = Math.min(
      (WIDTH - 2 * PAD_X) / logo.width,
      (areaHeight - 2 * padding) / logo.height,
    );
    const width = Math.max(1, Math.round(logo.width * scale));
    const height = Math.max(1, Math.round(logo.height * scale));
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const scratchContext = scratch.getContext('2d');
    if (!scratchContext) return;
    scratchContext.drawImage(logo, 0, 0, width, height);
    const image = scratchContext.getImageData(0, 0, width, height);
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      data[i] = alpha;
      data[i + 1] = 0;
      data[i + 2] = Math.round((luma * alpha) / 255);
      data[i + 3] = 255;
    }
    scratchContext.putImageData(image, 0, 0);
    context.drawImage(scratch, (WIDTH - width) / 2, (areaHeight - height) / 2);
  }
}
