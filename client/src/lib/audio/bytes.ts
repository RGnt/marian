export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
