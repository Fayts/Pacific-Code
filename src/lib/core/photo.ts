// Compression de photos côté navigateur (fiches matériel, vitrine).
// Une photo de téléphone de plusieurs Mo devient un JPEG ≤ ~200 Ko,
// largement suffisant pour une carte de catalogue.

const MAX_EDGE = 1200;
const JPEG_QUALITY = 0.82;

export async function compressPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choisissez une image (JPG, PNG…).");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error("Photo illisible — réessayez en JPG ou PNG."));
      el.src = url;
    });
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo illisible — réessayez en JPG ou PNG.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) throw new Error("Photo illisible — réessayez en JPG ou PNG.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Aperçu local d'un blob (avant téléversement). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Photo illisible"));
    reader.readAsDataURL(blob);
  });
}
