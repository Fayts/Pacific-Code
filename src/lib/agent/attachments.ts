// Pièces jointes de la conversation d'agent — préparation côté client.
// Les photos sont redimensionnées et compressées AVANT l'envoi : une photo
// de téléphone de 8 Mo devient ~300 Ko, largement suffisant pour lire une
// grille tarifaire, et ~10× moins cher en tokens. Les PDF partent tels
// quels, bornés. Le serveur revalide tout (types, tailles) : cette étape
// n'est qu'un confort réseau/coût, jamais une barrière de sécurité.

export type AgentAttachmentKind = "image" | "pdf";

export type PreparedAttachment = {
  kind: AgentAttachmentKind;
  name: string;
  mediaType: "image/jpeg" | "application/pdf";
  /** Contenu en base64, sans préfixe data:. */
  data: string;
};

export const MAX_ATTACHMENTS = 3;

/** Bord maximal d'une photo envoyée (lisible par le modèle, ~2 500 tokens). */
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/** PDF : 8 Mo binaires (≈ 11 Mo en base64). */
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export async function prepareAttachment(
  file: File
): Promise<PreparedAttachment> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("PDF trop volumineux (8 Mo maximum).");
    }
    return {
      kind: "pdf",
      name: file.name || "document.pdf",
      mediaType: "application/pdf",
      data: await toBase64(file),
    };
  }
  if (file.type.startsWith("image/")) {
    return {
      kind: "image",
      name: file.name || "photo.jpg",
      mediaType: "image/jpeg",
      data: await compressImage(file),
    };
  }
  throw new Error(
    "Format non pris en charge — joignez une photo (JPG, PNG) ou un PDF."
  );
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function compressImage(file: File): Promise<string> {
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
      MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Photo illisible — réessayez en JPG ou PNG.");
    }
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  } finally {
    URL.revokeObjectURL(url);
  }
}
