"use client";

/** Downscale a photo to at most `max` px on the long side and re-encode as JPEG. */
export async function compressImage(source: Blob | HTMLCanvasElement, max = 1600, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) bitmap = source;
  else bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });

  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process photo"))), "image/jpeg", quality),
  );
}
