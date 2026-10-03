export const CV_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function validateCvPhoto(file: Pick<File, 'type' | 'size'>) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choisissez une photo JPG, PNG ou WebP.');
  if (file.size > CV_PHOTO_MAX_BYTES) throw new Error('La photo doit faire moins de 5 Mo.');
  if (!file.size) throw new Error('Le fichier photo est vide.');
}

// Decode and crop locally. Neither the original file nor this image is sent to the AI.
export async function prepareCvPhoto(file: File): Promise<string> {
  validateCvPhoto(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Cette image ne peut pas être lue. Choisissez une autre photo.')); image.src = url; });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Cette image ne peut pas être lue.');
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 600;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossible de préparer la photo.');
    context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, 600, 600);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 600, 600);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally { URL.revokeObjectURL(url); }
}
