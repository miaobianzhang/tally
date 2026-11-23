export interface ImageSize {
  width: number;
  height: number;
}

export interface CropBox {
  width: number;
  height: number;
}

export interface CropTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface SourceCrop {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function coverScale(image: ImageSize, box: CropBox): number {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return 1;
  }
  return Math.max(box.width / image.width, box.height / image.height);
}

export function clampTransform(
  image: ImageSize,
  box: CropBox,
  transform: CropTransform,
): CropTransform {
  const zoom = clamp(transform.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = coverScale(image, box) * zoom;
  const visualWidth = image.width * scale;
  const visualHeight = image.height * scale;
  const maxX = Math.max(0, (visualWidth - box.width) / 2);
  const maxY = Math.max(0, (visualHeight - box.height) / 2);

  return {
    zoom,
    offsetX: clamp(transform.offsetX, -maxX, maxX),
    offsetY: clamp(transform.offsetY, -maxY, maxY),
  };
}

export function computeSourceCrop(
  image: ImageSize,
  box: CropBox,
  transform: CropTransform,
): SourceCrop {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return { originX: 0, originY: 0, width: 1, height: 1 };
  }

  const safe = clampTransform(image, box, transform);
  const scale = coverScale(image, box) * safe.zoom;
  const visualWidth = image.width * scale;
  const visualHeight = image.height * scale;
  const left = (box.width - visualWidth) / 2 + safe.offsetX;
  const top = (box.height - visualHeight) / 2 + safe.offsetY;

  const rawWidth = box.width / scale;
  const rawHeight = box.height / scale;
  const width = Math.max(1, Math.min(image.width, Math.round(rawWidth)));
  const height = Math.max(1, Math.min(image.height, Math.round(rawHeight)));
  const originX = Math.round(
    clamp(-left / scale, 0, Math.max(0, image.width - width)),
  );
  const originY = Math.round(
    clamp(-top / scale, 0, Math.max(0, image.height - height)),
  );

  return {
    originX: Math.min(originX, Math.max(0, image.width - width)),
    originY: Math.min(originY, Math.max(0, image.height - height)),
    width,
    height,
  };
}
