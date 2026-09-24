"use client";

/**
 * Loads an image file, center-crops it to a square (or keeps aspect for
 * question images), downsizes and returns a JPEG data URL.
 */
export async function fileToDataUrl(file: File, opts: { size: number; square: boolean; quality?: number }): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("تعذر قراءة الصورة"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    if (opts.square) {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      // Faces are usually in the upper-middle of portrait photos.
      const sx = (img.naturalWidth - side) / 2;
      const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.3 : 0;
      canvas.width = canvas.height = opts.size;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, opts.size, opts.size);
    } else {
      const scale = Math.min(1, opts.size / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL("image/jpeg", opts.quality ?? 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
