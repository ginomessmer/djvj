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
/** Room above and below an image. */
const PAD_Y = 64;
const MAX_TEXT_PX = 250;
/** Outline width of an image, in texture pixels. */
const OUTLINE_PX = 7;
const MAX_CACHED_IMAGES = 16;

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
 * Draws a headline text or image into a texture the composite shader styles. Channels, not
 * colours: red is the fill, green the outline, blue the detail (how bright that part of an image
 * is; a text's is full). The
 * shader reads blurred mip levels for glow and refraction, so letters stay crisp and the halo
 * follows each letter as it moves.
 */
export class HeadlineTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private drawnKey = '';
  private edges: GlyphEdges = [0, 1];
  /** Decoded images by data URL, so showing one again is instant. */
  private readonly images = new Map<string, HTMLImageElement>();

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
   * Redraws only when something changed. A text is drawn in the face of its style, so a new style
   * redraws too. An image draws once it has decoded (a frame or two after its first use).
   * @returns where the letters are: one more entry than letters (an image is one)
   */
  update(content: TextContent, style: TextStyle, imageUrl: string): GlyphEdges {
    const image = content.kind === 'image' ? this.image(imageUrl) : null;
    const key =
      content.kind === 'text'
        ? `t:${content.text}\u0000${style}`
        : `i:${content.imageId}:${image ? 'ready' : 'loading'}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.draw(content, style, image);
    }
    return this.edges;
  }

  dispose(): void {
    this.texture.dispose();
  }

  /** The decoded image, or null while it decodes. */
  private image(url: string): HTMLImageElement | null {
    if (!url) return null;
    let image = this.images.get(url);
    if (!image) {
      if (this.images.size >= MAX_CACHED_IMAGES) this.images.clear();
      image = new Image();
      image.src = url;
      this.images.set(url, image);
    }
    return image.complete && image.naturalWidth > 0 ? image : null;
  }

  private draw(content: TextContent, style: TextStyle, image: HTMLImageElement | null): void {
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#000';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.globalCompositeOperation = 'lighter'; // channels add up, they never cover each other

    if (content.kind === 'text') {
      this.edges = this.drawText(context, displayText(content.text, style), style, HEIGHT / 2);
    } else {
      this.edges = [0, 1];
      if (image) this.drawImage(context, image);
    }
    this.texture.needsUpdate = true;
  }

  private drawText(
    context: CanvasRenderingContext2D,
    text: string,
    style: TextStyle,
    centreY: number,
  ): GlyphEdges {
    const face = FACES[style];
    const glyphs = splitGlyphs(text);
    let size = MAX_TEXT_PX;
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

  /**
   * An image becomes a silhouette (red) with outlines (green, for neon) along its edge and where
   * light meets dark inside it, and its brightness kept as detail (blue), so lettering inside a
   * logo still reads.
   */
  private drawImage(context: CanvasRenderingContext2D, image: HTMLImageElement): void {
    const scale = Math.min(
      (WIDTH - 2 * PAD_X) / image.naturalWidth,
      (HEIGHT - 2 * PAD_Y) / image.naturalHeight,
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const scratchContext = scratch.getContext('2d');
    if (!scratchContext) return;
    scratchContext.drawImage(image, 0, 0, width, height);
    const pixels = scratchContext.getImageData(0, 0, width, height);
    const { data } = pixels;

    const alpha = new Uint8Array(width * height);
    const detail = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i++) {
      const o = i * 4;
      alpha[i] = data[o + 3];
      // Brightness as the brightest channel: a saturated red logo is bright, not dark.
      detail[i] = Math.round((Math.max(data[o], data[o + 1], data[o + 2]) * alpha[i]) / 255);
    }
    // Edges of the shape, and inside it where light meets dark (lettering inside a badge).
    const inner = erode(alpha, width, height, OUTLINE_PX);
    const innerDetail = erode(detail, width, height, Math.ceil(OUTLINE_PX / 2));

    for (let i = 0; i < alpha.length; i++) {
      const o = i * 4;
      data[o] = alpha[i];
      data[o + 1] = Math.max(alpha[i] - inner[i], detail[i] - innerDetail[i]);
      data[o + 2] = detail[i];
      data[o + 3] = 255;
    }
    scratchContext.putImageData(pixels, 0, 0);
    context.drawImage(scratch, Math.round((WIDTH - width) / 2), Math.round((HEIGHT - height) / 2));
  }
}

/**
 * Shrinks a coverage mask by `radius` pixels (a minimum filter, done as two passes). What it
 * takes away is a band along the edge: the image's outline.
 */
function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const pass = (source: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(source.length);
    const [lines, length] = horizontal ? [height, width] : [width, height];
    for (let line = 0; line < lines; line++) {
      for (let i = 0; i < length; i++) {
        let min = 255;
        for (let k = Math.max(0, i - radius); k <= Math.min(length - 1, i + radius); k++) {
          const index = horizontal ? line * width + k : k * width + line;
          if (source[index] < min) min = source[index];
        }
        out[horizontal ? line * width + i : i * width + line] = min;
      }
    }
    return out;
  };
  return pass(pass(mask, true), false);
}
