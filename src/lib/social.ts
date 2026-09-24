export const FEED_CATEGORY = '20000000-0000-4000-8000-000000000001';
export type SocialAuthor = { id?: string; username: string | null; display_name: string | null; temporary_tag?: string | null; avatar_url?: string | null };
export function socialHandle(author: SocialAuthor | null) {
  if (!author) return '@membro';
  return '@' + (author.temporary_tag ? author.display_name || author.username || 'membro' : author.username || author.display_name || 'membro');
}
export function extractHashtags(content: string) {
  return [...new Set(Array.from(content.matchAll(/(?:^|\s)#([\p{L}\p{N}_]{1,40})(?=$|[^\p{L}\p{N}_])/gu), match => match[1].toLocaleLowerCase('pt-BR')))];
}
export function publicationError(content: string, hasImage: boolean) {
  if (content.trim().length > 5000) return 'Use até 5000 caracteres.';
  if (!content.trim() && !hasImage) return 'Escreva algo ou adicione uma imagem.';
  return '';
}

// Re-encode the selected image to remove metadata and reject non-image payloads.
export async function preparePostImage(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Escolha JPG, PNG ou WebP de até 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    if (!picture.naturalWidth || picture.naturalWidth * picture.naturalHeight > 24000000) throw new Error('Imagem muito grande. Escolha uma imagem de até 24 megapixels.');
    const scale = Math.min(1, 1600 / Math.max(picture.naturalWidth, picture.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.')), 'image/jpeg', .85));
  } finally { URL.revokeObjectURL(url); }
}
