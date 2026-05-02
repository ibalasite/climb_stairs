import { colorFromIndex } from '../canvas/colors.js';

export const AVATAR_MAX_DATAURI_LEN = 12_000;

/**
 * Render an avatar as inline HTML.
 * - data:image/* → <img>
 * - emoji string → emoji on colored circle
 * - empty / undefined → first character of nickname on colored circle
 */
export function renderAvatarHtml(
  avatar: string | undefined,
  nickname: string,
  colorIndex: number,
  sizePx: number,
): string {
  const color = colorFromIndex(colorIndex);
  if (avatar !== undefined && avatar.startsWith('data:image/')) {
    const safe = avatar.replace(/"/g, '');
    return `<span class="avatar-img-wrap" style="width:${sizePx}px;height:${sizePx}px;border-color:${color}">
      <img class="avatar-img" src="${safe}" alt="${escapeAttr(nickname)}" />
    </span>`;
  }
  const fallback = (nickname.trim() || '?').slice(0, 1);
  const display = avatar !== undefined && avatar.length > 0 && avatar.length <= 8 ? avatar : fallback;
  return `<span class="avatar-fallback" style="
    width:${sizePx}px;height:${sizePx}px;
    background:${color}33;border:2px solid ${color};
    color:${color};font-size:${Math.round(sizePx * 0.55)}px;
  ">${escapeHtml(display)}</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Resize an image File to ≤ targetSize px on each side, then return a JPEG data URI.
 * Throws if the resulting URI exceeds AVATAR_MAX_DATAURI_LEN even at 0.5 quality.
 */
export async function fileToAvatarDataUri(file: File, targetSize = 128): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('請選擇圖片檔案');
  }
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(targetSize / bitmap.width, targetSize / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c2d = canvas.getContext('2d');
  if (c2d === null) throw new Error('Canvas 不支援');
  c2d.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Try descending qualities until under limit
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const uri = canvas.toDataURL('image/jpeg', q);
    if (uri.length <= AVATAR_MAX_DATAURI_LEN) return uri;
  }
  throw new Error('圖片無法壓縮到限制以內，請選擇較小的圖');
}
