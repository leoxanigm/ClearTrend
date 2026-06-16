import sharp from "sharp";

// Security and normalization limits applied while Sharp decodes the upload.
export const avatarImageRules = {
  maxDimension: 1024,
  maxInputPixels: 25_000_000,
  minDimension: 64,
  outputMimeType: "image/webp",
};

// The browser-declared MIME type must match the format detected by Sharp.
const formatByMimeType = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

// Expected validation failures are separated from low-level Sharp errors.
export class AvatarImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarImageError";
  }
}

export type ProcessedAvatarImage = {
  buffer: Buffer;
  height: number;
  mimeType: string;
  size: number;
  width: number;
};

// Decode, validate, resize, and normalize an uploaded avatar into a WebP buffer.
export async function processAvatarImage(
  input: Buffer,
  claimedMimeType: string
): Promise<ProcessedAvatarImage> {
  const expectedFormat = formatByMimeType.get(claimedMimeType);

  if (!expectedFormat) {
    throw new AvatarImageError(
      "Avatar must be a JPEG, PNG, or WebP image."
    );
  }

  try {
    // Decoding the real bytes prevents an extension or MIME-only validation.
    const image = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: avatarImageRules.maxInputPixels,
    });
    const metadata = await image.metadata();

    // Width and height also prove that Sharp could identify a usable image.
    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new AvatarImageError(
        "Avatar file content does not match its image type."
      );
    }

    // Multi-page images such as animated WebP files are intentionally rejected.
    if ((metadata.pages ?? 1) > 1) {
      throw new AvatarImageError("Animated avatars are not supported.");
    }

    // Both sides must be large enough for the circular profile rendering.
    if (
      metadata.width < avatarImageRules.minDimension ||
      metadata.height < avatarImageRules.minDimension
    ) {
      throw new AvatarImageError(
        `Avatar dimensions must be at least ${avatarImageRules.minDimension} by ${avatarImageRules.minDimension} pixels.`
      );
    }

    // rotate() applies EXIF orientation before dimensions are constrained.
    // Sharp emits fresh WebP bytes, so source EXIF/XMP metadata is not retained.
    const { data, info } = await image
      .rotate()
      .resize({
        fit: "inside",
        height: avatarImageRules.maxDimension,
        width: avatarImageRules.maxDimension,
        withoutEnlargement: true,
      })
      .webp({
        effort: 4,
        quality: 82,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      height: info.height,
      mimeType: avatarImageRules.outputMimeType,
      size: info.size,
      width: info.width,
    };
  } catch (error) {
    if (error instanceof AvatarImageError) {
      throw error;
    }

    // Translate implementation-specific pixel-limit errors into a stable API error.
    const message = error instanceof Error ? error.message : "";

    if (/pixel limit|exceeds.*limit/i.test(message)) {
      throw new AvatarImageError(
        "Avatar dimensions exceed the safe processing limit."
      );
    }

    throw new AvatarImageError("Avatar image could not be processed.");
  }
}
