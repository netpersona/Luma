import sharp from "sharp";

interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "jpeg" | "png" | "avif";
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

interface ThumbnailSizes {
  small: { width: number; height: number };
  medium: { width: number; height: number };
  large: { width: number; height: number };
}

const DEFAULT_THUMBNAIL_SIZES: ThumbnailSizes = {
  small: { width: 100, height: 150 },
  medium: { width: 200, height: 300 },
  large: { width: 400, height: 600 },
};

export async function optimizeImage(
  input: Buffer | string,
  options: OptimizeOptions = {}
): Promise<Buffer> {
  const {
    width,
    height,
    quality = 80,
    format = "webp",
    fit = "cover",
  } = options;

  let pipeline = sharp(input);

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit,
      withoutEnlargement: true,
    });
  }

  switch (format) {
    case "webp":
      pipeline = pipeline.webp({ quality });
      break;
    case "jpeg":
      pipeline = pipeline.jpeg({ quality, progressive: true });
      break;
    case "png":
      pipeline = pipeline.png({ quality, progressive: true });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality });
      break;
  }

  return pipeline.toBuffer();
}

export async function generateCoverThumbnails(
  input: Buffer | string,
  sizes: ThumbnailSizes = DEFAULT_THUMBNAIL_SIZES
): Promise<{
  small: Buffer;
  medium: Buffer;
  large: Buffer;
  original: Buffer;
}> {
  const [small, medium, large, original] = await Promise.all([
    optimizeImage(input, { ...sizes.small, format: "webp", quality: 75 }),
    optimizeImage(input, { ...sizes.medium, format: "webp", quality: 80 }),
    optimizeImage(input, { ...sizes.large, format: "webp", quality: 85 }),
    optimizeImage(input, { format: "webp", quality: 85 }),
  ]);

  return { small, medium, large, original };
}

export async function optimizeCover(
  input: Buffer | string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: "webp" | "jpeg" | "png";
  } = {}
): Promise<Buffer> {
  const {
    maxWidth = 600,
    maxHeight = 900,
    quality = 85,
    format = "webp",
  } = options;

  return optimizeImage(input, {
    width: maxWidth,
    height: maxHeight,
    quality,
    format,
    fit: "inside",
  });
}

export async function getImageMetadata(input: Buffer | string): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}> {
  const metadata = await sharp(input).metadata();
  const stats = await sharp(input).toBuffer({ resolveWithObject: true });

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    size: stats.info.size,
  };
}

export async function convertToWebP(
  input: Buffer | string,
  quality: number = 80
): Promise<Buffer> {
  return sharp(input).webp({ quality }).toBuffer();
}

export async function resizeForThumbnail(
  input: Buffer | string,
  size: "small" | "medium" | "large" = "medium"
): Promise<Buffer> {
  const dimensions = DEFAULT_THUMBNAIL_SIZES[size];
  return optimizeImage(input, {
    ...dimensions,
    format: "webp",
    quality: 80,
  });
}

export async function extractDominantColor(input: Buffer | string): Promise<{
  r: number;
  g: number;
  b: number;
  hex: string;
}> {
  const { dominant } = await sharp(input).stats();
  
  const hex = `#${Math.round(dominant.r).toString(16).padStart(2, "0")}${Math.round(dominant.g).toString(16).padStart(2, "0")}${Math.round(dominant.b).toString(16).padStart(2, "0")}`;
  
  return {
    r: Math.round(dominant.r),
    g: Math.round(dominant.g),
    b: Math.round(dominant.b),
    hex,
  };
}

export async function createBlurPlaceholder(
  input: Buffer | string
): Promise<string> {
  const blurred = await sharp(input)
    .resize(20, 30, { fit: "inside" })
    .blur(2)
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${blurred.toString("base64")}`;
}
