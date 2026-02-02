/**
 * Purpose: Create a temporary object URL for a Blob.
 * How: Uses `URL.createObjectURL` to generate a browser-managed URL.
 * @param blob - Binary data to expose as a URL.
 * @returns string - Object URL that should be revoked when no longer needed.
 */
export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
