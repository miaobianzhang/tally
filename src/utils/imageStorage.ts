import * as ImageManipulator from 'expo-image-manipulator';

import type { SourceCrop } from './crop';
import {
  copyImageToDocuments,
  deleteImageFile,
  type StoredImageKind,
} from './imageFiles';

const OUTPUT_WIDTH: Record<StoredImageKind, number> = {
  avatar: 512,
  background: 1080,
};

const MAX_SOURCE_EDGE = 2400;

export interface CropSource {
  uri: string;
  width: number;
  height: number;
}

/**
 * Decodes, downsamples, normalizes orientation and writes a canonical JPEG to
 * cache. The returned width/height are the exact pixel space used by crop.
 */
export async function prepareCropSource(
  sourceUri: string,
  maxEdge = MAX_SOURCE_EDGE,
): Promise<CropSource> {
  const context = ImageManipulator.ImageManipulator.manipulate(
    sourceUri,
    { maxWidth: maxEdge, maxHeight: maxEdge },
  );
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Crops a picked image and writes the result to cache for preview. */
export async function cropImageToCache(
  sourceUri: string,
  crop: SourceCrop,
  kind: StoredImageKind,
): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(sourceUri);
  context.crop({
    originX: crop.originX,
    originY: crop.originY,
    width: crop.width,
    height: crop.height,
  });
  context.resize({ width: OUTPUT_WIDTH[kind] });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return saved.uri;
}

/** Copies a preview/cropped cache file into Documents under a fresh name. */
export function persistImage(
  cacheUri: string,
  kind: StoredImageKind,
): Promise<string> {
  return copyImageToDocuments(cacheUri, kind);
}

export function deleteStoredImage(uri: string | null | undefined): void {
  deleteImageFile(uri);
}
