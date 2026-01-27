export function base64ToBlob(b64: string, mime: string): Blob {
  const binStr = atob(b64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
