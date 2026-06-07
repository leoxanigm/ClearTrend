import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const webRoot = process.env.TEST_WEB_ROOT ??
  fileURLToPath(new URL("../../web", import.meta.url));
const require = createRequire(join(webRoot, "package.json"));
const sharp = require("sharp");
const {
  AvatarImageError,
  avatarImageRules,
  processAvatarImage,
} = await import(
  pathToFileURL(join(webRoot, "src/lib/avatar-images.ts")).href
);

async function createImage({
  format,
  height,
  orientation,
  width,
}) {
  let image = sharp({
    create: {
      background: {
        alpha: 1,
        b: 180,
        g: 120,
        r: 40,
      },
      channels: 4,
      height,
      width,
    },
  });

  if (orientation) {
    image = image.withMetadata({ orientation });
  }

  return image.toFormat(format).toBuffer();
}

async function expectProcessed({
  expectedHeight,
  expectedWidth,
  format,
  height,
  mimeType,
  name,
  orientation,
  width,
}) {
  const input = await createImage({
    format,
    height,
    orientation,
    width,
  });
  const output = await processAvatarImage(input, mimeType);
  const metadata = await sharp(output.buffer).metadata();

  assert.equal(output.mimeType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, expectedWidth);
  assert.equal(metadata.height, expectedHeight);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);

  console.log(`PASS ${name}: ${width}x${height} -> ${expectedWidth}x${expectedHeight}`);
}

async function expectRejected(name, action, expectedMessage) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof AvatarImageError);
    assert.equal(error.message, expectedMessage);
    return true;
  });

  console.log(`PASS ${name}: rejected`);
}

await expectProcessed({
  expectedHeight: 800,
  expectedWidth: 800,
  format: "jpeg",
  height: 800,
  mimeType: "image/jpeg",
  name: "square JPEG",
  width: 800,
});

await expectProcessed({
  expectedHeight: 256,
  expectedWidth: 1024,
  format: "png",
  height: 600,
  mimeType: "image/png",
  name: "wide PNG",
  width: 2400,
});

await expectProcessed({
  expectedHeight: 1024,
  expectedWidth: 256,
  format: "webp",
  height: 2400,
  mimeType: "image/webp",
  name: "tall WebP",
  width: 600,
});

await expectProcessed({
  expectedHeight: 1024,
  expectedWidth: 1024,
  format: "jpeg",
  height: 4000,
  mimeType: "image/jpeg",
  name: "large JPEG",
  width: 4000,
});

await expectProcessed({
  expectedHeight: 300,
  expectedWidth: 600,
  format: "jpeg",
  height: 600,
  mimeType: "image/jpeg",
  name: "EXIF-oriented JPEG",
  orientation: 6,
  width: 300,
});

await expectRejected(
  "too-small image",
  async () => {
    const input = await createImage({
      format: "png",
      height: 80,
      width: 32,
    });

    await processAvatarImage(input, "image/png");
  },
  `Avatar dimensions must be at least ${avatarImageRules.minDimension} by ${avatarImageRules.minDimension} pixels.`
);

await expectRejected(
  "pixel-limit image",
  async () => {
    const input = await createImage({
      format: "png",
      height: 5000,
      width: 6000,
    });

    await processAvatarImage(input, "image/png");
  },
  "Avatar dimensions exceed the safe processing limit."
);

await expectRejected(
  "spoofed MIME type",
  async () => {
    const input = await createImage({
      format: "png",
      height: 400,
      width: 400,
    });

    await processAvatarImage(input, "image/jpeg");
  },
  "Avatar file content does not match its image type."
);

await expectRejected(
  "invalid image bytes",
  () => processAvatarImage(Buffer.from("not an image"), "image/jpeg"),
  "Avatar image could not be processed."
);

console.log("Avatar image pipeline: all tests passed.");
