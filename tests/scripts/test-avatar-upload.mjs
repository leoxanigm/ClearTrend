import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// End-to-end test state: isolated account, IP, cookies, and target web server.
const webRoot = process.env.TEST_WEB_ROOT ??
  fileURLToPath(new URL("../../web", import.meta.url));
const require = createRequire(join(webRoot, "package.json"));
const sharp = require("sharp");
const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const email = `avatar-test-${randomUUID()}@example.test`;
const password = `Avatar-${randomUUID()}`;
const testIp = `avatar-test-${randomUUID()}`;
const cookies = new Map();

// Maintain the authenticated session exactly as a browser would across requests.
function rememberCookies(response) {
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");

    if (separator > 0) {
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
}

function cookieHeader() {
  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
}

// Attach the test identity and accumulated cookies to every API call.
async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  const cookie = cookieHeader();

  headers.set("X-Forwarded-For", testIp);

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  rememberCookies(response);
  return response;
}

// Include the response body when an unexpected HTTP status makes the test fail.
async function assertStatus(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected HTTP ${expectedStatus}, received ${response.status}: ${await response.text()}`
    );
  }
}

// Build upload inputs with controlled formats and dimensions.
async function createImage(format, width, height) {
  return sharp({
    create: {
      background: {
        alpha: 1,
        b: 80,
        g: 170,
        r: 30,
      },
      channels: 4,
      height,
      width,
    },
  })
    .toFormat(format)
    .toBuffer();
}

// Submit the same multipart profile contract used by ProfileSettingsDialog.
async function patchProfile({
  avatar,
  avatarMimeType,
  offsetX = 0,
  offsetY = 0,
  removeAvatar = false,
  scale = 1.5,
}) {
  const formData = new FormData();

  formData.set("displayName", "Avatar Test");
  formData.set("avatarScale", String(scale));
  formData.set("avatarOffsetX", String(offsetX));
  formData.set("avatarOffsetY", String(offsetY));
  formData.set("removeAvatar", String(removeAvatar));

  if (avatar) {
    formData.set(
      "avatar",
      new Blob([avatar], { type: avatarMimeType }),
      "avatar-upload"
    );
  }

  return request("/api/profile", {
    body: formData,
    method: "PATCH",
  });
}

// Create and authenticate the owner account before exercising private avatar routes.
const registerResponse = await request("/api/auth/register", {
  body: JSON.stringify({ email, password }),
  headers: {
    "Content-Type": "application/json",
  },
  method: "POST",
});

await assertStatus(registerResponse, 200);

const csrfResponse = await request("/api/auth/csrf");
assert.equal(csrfResponse.status, 200);
const { csrfToken } = await csrfResponse.json();

const loginBody = new URLSearchParams({
  callbackUrl: `${baseUrl}/dashboard`,
  csrfToken,
  email,
  json: "true",
  password,
});
const loginResponse = await request("/api/auth/callback/credentials", {
  body: loginBody,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  method: "POST",
  redirect: "manual",
});

assert.ok(
  loginResponse.status === 200 || loginResponse.status === 302,
  `Login failed with ${loginResponse.status}: ${await loginResponse.text()}`
);
assert.ok(
  Array.from(cookies.keys()).some((name) => name.includes("session-token")),
  "No authenticated session cookie was returned."
);

// Upload a wide image and verify persisted crop metadata.
const wideInput = await createImage("png", 2400, 600);
const wideUploadResponse = await patchProfile({
  avatar: wideInput,
  avatarMimeType: "image/png",
  offsetX: 20,
  offsetY: -15,
  scale: 2,
});
await assertStatus(wideUploadResponse, 200);
const wideProfile = (await wideUploadResponse.json()).profile;

assert.match(wideProfile.avatarUrl, /^\/api\/profile\/avatar\/.+\.webp$/);
assert.equal(wideProfile.avatarMimeType, "image/webp");
assert.equal(wideProfile.avatarScale, 2);
assert.equal(wideProfile.avatarOffsetX, 20);
assert.equal(wideProfile.avatarOffsetY, -15);

// Anonymous and other authenticated users must not read the owner's private avatar.
const unauthenticatedAvatar = await fetch(`${baseUrl}${wideProfile.avatarUrl}`);
assert.equal(unauthenticatedAvatar.status, 401);

const ownerCookies = new Map(cookies);
const otherEmail = `avatar-other-${randomUUID()}@example.test`;

cookies.clear();

const otherRegisterResponse = await request("/api/auth/register", {
  body: JSON.stringify({
    email: otherEmail,
    password,
  }),
  headers: {
    "Content-Type": "application/json",
  },
  method: "POST",
});
await assertStatus(otherRegisterResponse, 200);

const otherCsrfResponse = await request("/api/auth/csrf");
await assertStatus(otherCsrfResponse, 200);
const { csrfToken: otherCsrfToken } = await otherCsrfResponse.json();
const otherLoginResponse = await request("/api/auth/callback/credentials", {
  body: new URLSearchParams({
    callbackUrl: `${baseUrl}/dashboard`,
    csrfToken: otherCsrfToken,
    email: otherEmail,
    json: "true",
    password,
  }),
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  method: "POST",
  redirect: "manual",
});
assert.ok(otherLoginResponse.status === 200 || otherLoginResponse.status === 302);

const otherUserAvatarResponse = await request(wideProfile.avatarUrl);
assert.equal(otherUserAvatarResponse.status, 404);

const otherDeleteResponse = await request("/api/account/delete", {
  method: "DELETE",
});
await assertStatus(otherDeleteResponse, 204);

cookies.clear();
for (const [name, value] of ownerCookies) {
  cookies.set(name, value);
}

// The owner receives the normalized WebP with its constrained dimensions.
const wideAvatarResponse = await request(wideProfile.avatarUrl);
assert.equal(wideAvatarResponse.status, 200);
assert.equal(wideAvatarResponse.headers.get("content-type"), "image/webp");
assert.equal(
  wideAvatarResponse.headers.get("x-content-type-options"),
  "nosniff"
);
const wideMetadata = await sharp(
  Buffer.from(await wideAvatarResponse.arrayBuffer())
).metadata();
assert.equal(wideMetadata.width, 1024);
assert.equal(wideMetadata.height, 256);

// Replacing the avatar must delete the former file and serve the new one.
const tallInput = await createImage("jpeg", 600, 2400);
const tallUploadResponse = await patchProfile({
  avatar: tallInput,
  avatarMimeType: "image/jpeg",
});
await assertStatus(tallUploadResponse, 200);
const tallProfile = (await tallUploadResponse.json()).profile;
assert.notEqual(tallProfile.avatarUrl, wideProfile.avatarUrl);

const replacedAvatarResponse = await request(wideProfile.avatarUrl);
assert.equal(replacedAvatarResponse.status, 404);

const tallAvatarResponse = await request(tallProfile.avatarUrl);
assert.equal(tallAvatarResponse.status, 200);
const tallMetadata = await sharp(
  Buffer.from(await tallAvatarResponse.arrayBuffer())
).metadata();
assert.equal(tallMetadata.width, 256);
assert.equal(tallMetadata.height, 1024);

// Invalid dimensions, spoofed MIME data, and excessive byte size are rejected.
const smallInput = await createImage("png", 32, 80);
const smallResponse = await patchProfile({
  avatar: smallInput,
  avatarMimeType: "image/png",
});
assert.equal(smallResponse.status, 400);
assert.equal(
  (await smallResponse.json()).error,
  "Avatar dimensions must be at least 64 by 64 pixels."
);

const spoofedResponse = await patchProfile({
  avatar: await createImage("png", 400, 400),
  avatarMimeType: "image/jpeg",
});
assert.equal(spoofedResponse.status, 400);
assert.equal(
  (await spoofedResponse.json()).error,
  "Avatar file content does not match its image type."
);

const oversizedResponse = await patchProfile({
  avatar: randomBytes(5 * 1024 * 1024 + 1),
  avatarMimeType: "image/png",
});
assert.equal(oversizedResponse.status, 400);
assert.equal(
  (await oversizedResponse.json()).error,
  "Avatar must be 5 MB or smaller."
);

// Explicit removal deletes the active file before the temporary account is deleted.
const removeResponse = await patchProfile({
  removeAvatar: true,
  scale: 1,
});
await assertStatus(removeResponse, 200);
assert.equal((await removeResponse.json()).profile.avatarUrl, null);

const removedAvatarResponse = await request(tallProfile.avatarUrl);
assert.equal(removedAvatarResponse.status, 404);

const deleteResponse = await request("/api/account/delete", {
  method: "DELETE",
});
await assertStatus(deleteResponse, 204);

console.log("Avatar upload API: all end-to-end tests passed.");
