import { File, Paths } from 'expo-file-system';

export type StoredImageKind = 'avatar' | 'background';

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function uniqueImageName(kind: StoredImageKind): string {
  return `${kind}-${Date.now()}-${randomSuffix()}.jpg`;
}

/** Copies a cache/cropped image into Documents under a fresh, cache-safe name. */
export async function copyImageToDocuments(
  sourceUri: string,
  kind: StoredImageKind,
): Promise<string> {
  const destination = new File(Paths.document, uniqueImageName(kind));
  const source = new File(sourceUri);
  try {
    await source.copy(destination);
    return destination.uri;
  } catch (error) {
    try {
      if (destination.exists) destination.delete();
    } catch {
      // Best-effort cleanup.
    }
    throw error;
  }
}

function baseName(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const segment = withoutQuery.split('/').pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The persisted URI can become stale when the app container changes (iOS) or
 * when an older build used a fixed filename. Try the original file first, then
 * the same basename in the current Documents directory.
 */
export function resolveStoredImageUri(
  uri: string | null | undefined,
): string | null {
  if (!uri) return null;
  try {
    const file = new File(uri);
    if (file.exists) return file.uri;
  } catch {
    // Fall through to the Documents basename lookup.
  }

  try {
    const name = baseName(uri);
    if (!name) return null;
    const fallback = new File(Paths.document, name);
    return fallback.exists ? fallback.uri : null;
  } catch {
    return null;
  }
}

export function deleteImageFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[tally] failed to delete stored image', error);
  }
}
