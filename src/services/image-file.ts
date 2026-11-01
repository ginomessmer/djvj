/** Reads an image file, scaled down to fit `maxWidth` x `maxHeight`, as a PNG data URL. */
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
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
