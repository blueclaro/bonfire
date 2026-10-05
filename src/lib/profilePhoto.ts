export const AVATAR_BUCKET = "avatars";
export const AVATAR_PREFIX = "avatars/";

export function avatarStoragePath(value: string | null | undefined) {
  return value && /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(value) ? value.slice(AVATAR_PREFIX.length) : null;
}

export function profilePhotoError(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Escolha uma foto em JPG, PNG ou WebP.";
  if (file.size > 5 * 1024 * 1024) return "A foto deve ter até 5 MB.";
  if (!file.size) return "A foto está vazia. Escolha outro arquivo.";
  return "";
}

// Recorta o centro e remove os metadados antes de enviar a foto.
export async function prepareProfilePhoto(file: File): Promise<Blob> {
  const invalid = profilePhotoError(file);
  if (invalid) throw new Error(invalid);
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url;
    try { await picture.decode(); } catch { throw new Error("Não foi possível abrir essa foto. Escolha outra imagem."); }
    if (!picture.naturalWidth || !picture.naturalHeight || picture.naturalWidth * picture.naturalHeight > 24000000) {
      throw new Error("Escolha uma imagem de até 24 megapixels.");
    }
    const side = Math.min(picture.naturalWidth, picture.naturalHeight);
    const size = Math.min(512, side);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, size, size);
    context.drawImage(picture, (picture.naturalWidth - side) / 2, (picture.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a foto.")), "image/jpeg", 0.88));
  } finally { URL.revokeObjectURL(url); }
}
