"use client";

/**
 * Loads an image file, center-crops it to a square (or keeps aspect for
 * question images), downsizes and returns a JPEG data URL.
 */
export async function fileToDataUrl(file: File, opts: { size: number; square: boolean; quality?: number }): Promise<string> {
  const src = await decode(file);
  const w = src.width;
  const h = src.height;
  if (!w || !h) throw new Error("تعذر قراءة الصورة");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  if (opts.square) {
    const side = Math.min(w, h);
    // Faces are usually in the upper-middle of portrait photos.
    const sx = (w - side) / 2;
    const sy = h > w ? (h - side) * 0.3 : 0;
    canvas.width = canvas.height = opts.size;
    ctx.drawImage(src.image, sx, sy, side, side, 0, 0, opts.size, opts.size);
  } else {
    const scale = Math.min(1, opts.size / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(src.image, 0, 0, canvas.width, canvas.height);
  }
  src.close();
  return canvas.toDataURL("image/jpeg", opts.quality ?? 0.82);
}

type Decoded = { image: CanvasImageSource; width: number; height: number; close: () => void };

/** createImageBitmap (respects EXIF rotation from iPhone cameras), falling back to <img>. */
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through (older Safari, unsupported format)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      const t = setTimeout(() => reject(new Error("تعذر قراءة الصورة")), 15000);
      i.onload = () => {
        clearTimeout(t);
        resolve(i);
      };
      i.onerror = () => {
        clearTimeout(t);
        reject(new Error("تعذر قراءة الصورة"));
      };
      i.src = url;
    });
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
