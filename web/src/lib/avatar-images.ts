import sharp from "sharp";

export const avatarImageRules = {
  maxDimension: 1024,
  maxInputPixels: 25_000_000,
  minDimension: 64,
  outputMimeType: "image/webp",
};

const formatByMimeType = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

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
    const image = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: avatarImageRules.maxInputPixels,
    });
    const metadata = await image.metadata();

    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new AvatarImageError(
        "Avatar file content does not match its image type."
      );
    }

    if ((metadata.pages ?? 1) > 1) {
      throw new AvatarImageError("Animated avatars are not supported.");
    }

    if (
      metadata.width < avatarImageRules.minDimension ||
      metadata.height < avatarImageRules.minDimension
    ) {
      throw new AvatarImageError(
        `Avatar dimensions must be at least ${avatarImageRules.minDimension} by ${avatarImageRules.minDimension} pixels.`
      );
    }

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

    const message = error instanceof Error ? error.message : "";

    if (/pixel limit|exceeds.*limit/i.test(message)) {
      throw new AvatarImageError(
        "Avatar dimensions exceed the safe processing limit."
      );
    }

    throw new AvatarImageError("Avatar image could not be processed.");
  }
}
