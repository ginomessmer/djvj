/**
 * Reads an image file (PNG, JPEG, SVG, ...) scaled to fit `maxWidth` x `maxHeight`, as a WebP data
 * URL (keeps transparency, a fraction of the size of PNG: several images must fit in storage).
 * Bitmaps are only ever scaled down; an SVG is drawn at full size, since it has no pixels to lose.
 */
export async function readImageAsDataUrl(
  file: File,
  maxWidth = 1024,
  maxHeight = 512,
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Not an image the browser can read.'));
      element.src = objectUrl;
    });
    const vector = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    // An SVG without width and height reports no size: assume a square.
    const width = image.naturalWidth || maxHeight;
    const height = image.naturalHeight || maxHeight;
    const fit = Math.min(maxWidth / width, maxHeight / height);
    const scale = vector ? fit : Math.min(1, fit);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.92);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
