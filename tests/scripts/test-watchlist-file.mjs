import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const email = `watchlist-file-test-${randomUUID()}@example.test`;
const password = `Watchlist-${randomUUID()}`;
const testIp = `watchlist-file-test-${randomUUID()}`;
const cookies = new Map();

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

async function assertStatus(response, expectedStatus) {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected HTTP ${expectedStatus}, received ${response.status}: ${await response.text()}`
    );
  }
}

async function uploadWatchlist(content, type = "application/json") {
  const formData = new FormData();

  formData.set(
    "watchlist",
    new Blob([content], { type }),
    "watchlist.json"
  );

  return request("/api/assets/watchlist/file", {
    body: formData,
    method: "POST",
  });
}

const unauthenticatedExport = await fetch(
  `${baseUrl}/api/assets/watchlist/file`
);
assert.equal(unauthenticatedExport.status, 401);

const registerResponse = await request("/api/auth/register", {
  body: JSON.stringify({ email, password }),
  headers: {
    "Content-Type": "application/json",
  },
  method: "POST",
});
await assertStatus(registerResponse, 200);

const csrfResponse = await request("/api/auth/csrf");
await assertStatus(csrfResponse, 200);
const { csrfToken } = await csrfResponse.json();
const loginResponse = await request("/api/auth/callback/credentials", {
  body: new URLSearchParams({
    callbackUrl: `${baseUrl}/dashboard`,
    csrfToken,
    email,
    json: "true",
    password,
  }),
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  method: "POST",
  redirect: "manual",
});

assert.ok(loginResponse.status === 200 || loginResponse.status === 302);
assert.ok(
  Array.from(cookies.keys()).some((name) => name.includes("session-token"))
);

const emptyExportResponse = await request("/api/assets/watchlist/file");
await assertStatus(emptyExportResponse, 200);
assert.match(
  emptyExportResponse.headers.get("content-disposition") ?? "",
  /^attachment; filename="cleartrend-watchlist-\d{4}-\d{2}-\d{2}\.json"$/
);
const emptyExport = await emptyExportResponse.json();
assert.equal(emptyExport.format, "cleartrend-watchlist");
assert.equal(emptyExport.version, 1);
assert.deepEqual(emptyExport.symbols, []);

const validPayload = JSON.stringify({
  format: "cleartrend-watchlist",
  symbols: ["aapl", "MSFT", "AAPL", "ZZZZZZ", 42],
  version: 1,
});
const importResponse = await uploadWatchlist(validPayload);
await assertStatus(importResponse, 200);
const importResult = await importResponse.json();

assert.deepEqual(importResult.importedSymbols.sort(), ["AAPL", "MSFT"]);
assert.deepEqual(importResult.ignoredSymbols, ["ZZZZZZ"]);
assert.equal(importResult.invalidEntries, 1);
assert.deepEqual(importResult.favoriteSymbols.sort(), ["AAPL", "MSFT"]);

const exportResponse = await request("/api/assets/watchlist/file");
await assertStatus(exportResponse, 200);
const exportedWatchlist = await exportResponse.json();
assert.deepEqual(exportedWatchlist.symbols.sort(), ["AAPL", "MSFT"]);

const duplicateImportResponse = await uploadWatchlist(validPayload);
await assertStatus(duplicateImportResponse, 200);
const duplicateImport = await duplicateImportResponse.json();
assert.deepEqual(duplicateImport.importedSymbols, []);
assert.deepEqual(
  duplicateImport.alreadyFavoriteSymbols.sort(),
  ["AAPL", "MSFT"]
);

const wrongTypeResponse = await uploadWatchlist(validPayload, "text/plain");
assert.equal(wrongTypeResponse.status, 400);

const invalidJsonResponse = await uploadWatchlist("{invalid");
assert.equal(invalidJsonResponse.status, 400);
assert.equal(
  (await invalidJsonResponse.json()).error,
  "The watchlist file contains invalid JSON."
);

const unsupportedVersionResponse = await uploadWatchlist(
  JSON.stringify({
    format: "cleartrend-watchlist",
    symbols: ["AAPL"],
    version: 2,
  })
);
assert.equal(unsupportedVersionResponse.status, 400);
assert.equal(
  (await unsupportedVersionResponse.json()).error,
  "Unsupported watchlist JSON format or version."
);

const oversizedResponse = await uploadWatchlist(" ".repeat(64 * 1024 + 1));
assert.equal(oversizedResponse.status, 400);
assert.equal(
  (await oversizedResponse.json()).error,
  "The watchlist file must be 64 KB or smaller."
);

const deleteResponse = await request("/api/account/delete", {
  method: "DELETE",
});
await assertStatus(deleteResponse, 204);

console.log("Watchlist JSON import/export API: all tests passed.");
