import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

type ImageKind = 'avatar' | 'background';

const MAX_WIDTH: Record<ImageKind, number> = {
  avatar: 512,
  background: 1600,
};

function getImageWidth(uri: string): Promise<number | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width) => resolve(width),
      () => resolve(null),
    );
  });
}

export async function storePickedImage(
  sourceUri: string,
  kind: ImageKind,
): Promise<string> {
  const maxWidth = MAX_WIDTH[kind];
  const width = await getImageWidth(sourceUri);
  const context = ImageManipulator.ImageManipulator.manipulate(sourceUri);
  if (width === null || width > maxWidth) {
    context.resize({ width: maxWidth });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const destination = new File(Paths.document, `${kind}.jpg`);
  if (destination.exists) {
    destination.delete();
  }
  await new File(saved.uri).copy(destination);
  return destination.uri;
}

export function deleteStoredImage(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[tally] failed to delete stored image', error);
  }
}
