# Module File Upload Management

## Status

- Type: minor module
- Value: 1 point
- Status: implemented and validated
- Scope: user avatar, JSON import/export of favorites, and chart export as
  CSV/JSON

The subject requires:

- several file types;
- client and server validation of type, size, and format;
- secure storage with access control;
- preview when relevant;
- upload progress;
- deletion of uploaded files.

ClearTrend covers these requirements with two complementary upload flows:

1. avatar image management;
2. JSON watchlist import and export.

The module also includes a third file flow, download-only: exporting visible
dashboard data as CSV or JSON.

## General Architecture

Both flows use the same security rule:

```text
Quick browser validation
                |
                v
Authenticated Next.js endpoint
                |
                v
Full server-side validation
                |
                +--> avatar: processing and private storage
                |
                +--> JSON: reading, database merge, no file storage
```

Client-side validation improves the user experience, but is never considered
sufficient protection. All important constraints are applied again by the
backend.

Dashboard export does not follow this upload pipeline: it transforms already
loaded data in the browser and sends no file to the server.

## Part 1 - Avatar

### User Flow

Associated code:
[`ProfileSettingsDialog`](../../../web/src/components/ProfileSettingsDialog.tsx#L94)

From profile settings, the user can:

- select a JPEG, PNG, or WebP image;
- see an immediate preview;
- zoom into the image;
- move the image horizontally and vertically;
- save the framing;
- replace the avatar;
- remove the avatar.

Zoom and movement remain driven by:

- `avatarScale`;
- `avatarOffsetX`;
- `avatarOffsetY`.

### Client Validation

Associated code:
[`handleFileChange`](../../../web/src/components/ProfileSettingsDialog.tsx#L281)

Before sending, the browser checks:

- JPEG, PNG, or WebP MIME type;
- maximum size of 5 MB;
- presence of a file.

A local preview is created with `URL.createObjectURL`. The form uses
`XMLHttpRequest` to display real upload progress.

### Server Processing with Sharp

Associated code:
[`processAvatarImage`](../../../web/src/lib/avatar-images.ts#L35)

The server does not rely only on the extension or first bytes. Sharp actually
decodes the image.

Pipeline:

```text
JPEG / PNG / WebP
        |
        +--> maximum size: 5 MB
        +--> announced format = decoded format
        +--> minimum: 64 x 64 pixels
        +--> maximum: 25 million input pixels
        +--> reject animated images
        +--> EXIF orientation correction
        +--> maximum resize: 1024 x 1024
        +--> preserve ratio
        +--> no upscaling of small images
        +--> WebP conversion, quality 82
        +--> metadata removal
```

All new images are stored as WebP. This limits the formats served by the
application and notably removes EXIF or GPS metadata.

Sharp normalizes the complete image, but does not destructively apply the crop
chosen by the user. Zoom and offsets are stored in the database, then applied
with CSS by `UserAvatar`. The user can therefore change the framing later
without re-encoding the image several times.

### Why Sharp

A MIME or extension check does not prove that a file contains a valid image.
Sharp decodes bytes with a specialized library and enables a single pipeline
to:

- compare the real format with the announced MIME;
- limit the number of pixels before processing;
- correct orientation;
- resize without distortion;
- remove metadata;
- produce a single format.

WebP was selected to reduce storage size while keeping sufficient quality for
an avatar.

### Private Storage

Associated code:
[`ensureAvatarDirectory`](../../../web/src/lib/avatar-storage.ts#L16)

Avatars are stored outside Next.js's `public/` directory:

```text
/app/uploads/avatars
```

Next.js therefore cannot serve them automatically as public resources. Reading
them must go through the authenticated API.

In Docker, this directory is connected to the persistent volume:

```text
avatar_uploads
```

The web container can be recreated without deleting avatars. Files remain
separate from the Docker image and source code.

Applied permissions:

- directory `0700`: only the process owner can read, write, and traverse it;
- file `0600`: only the owner can read or modify the avatar.

Each file uses a non-predictable name containing the user ID and a random UUID:

```text
<user-id>-<random-uuid>.webp
```

The ID makes technical association with the account easier. The UUID avoids
name collisions and allows avatar replacement without cache issues.

### Access Control

Associated code:
[`GET /api/profile/avatar/[fileName]`](../../../web/src/app/api/profile/avatar/[fileName]/route.ts#L20)

Files are not accessible through a direct public URL. They are served by:

```text
GET /api/profile/avatar/[fileName]
```

The route:

1. requires an authenticated session;
2. loads the current profile;
3. verifies that the requested file is exactly this profile's active avatar;
4. returns `404` for another name or an old avatar;
5. serves the content with `Content-Type: image/webp` and
   `X-Content-Type-Options: nosniff`.

A user therefore cannot read another user's private avatar by guessing its
name.

The `Cache-Control: private, max-age=31536000, immutable` header is compatible
with this behavior: each replacement generates a different UUID name. The
browser can therefore keep the response for a long time without displaying the
wrong avatar version.

### Replacement and Deletion

Associated code:
[`PATCH /api/profile`](../../../web/src/app/api/profile/route.ts#L117)

During replacement:

1. the new file is processed and written;
2. the database is updated;
3. the old local file is deleted.

If the database update fails, the new file is deleted to avoid an orphan file.

The avatar is also deleted:

- when the user clicks `Remove`;
- when the user account is deleted.

## Part 2 - Watchlist JSON

### Goal

A user can export favorite symbols and then send the file to another user. The
import adds recognized symbols to favorites without deleting existing ones.

This feature remains in profile settings. No artificial file-management page
was added.

### Format

Associated code:
[`validateWatchlistFile`](../../../web/src/lib/watchlist-file.ts#L37)

The format is intentionally small and versioned:

```json
{
  "exportedAt": "2026-06-07T17:23:22.565Z",
  "format": "cleartrend-watchlist",
  "symbols": ["AAPL", "MSFT", "NVDA"],
  "version": 1
}
```

Required fields:

- `format` must be `cleartrend-watchlist`;
- `version` must be `1`;
- `symbols` must be an array.

`exportedAt` is informational.

### Why JSON

JSON maps directly to a list of symbols and allows fields to be added
unambiguously in a future version. The `format` and `version` fields prevent
another JSON document from being mistakenly interpreted as a ClearTrend
watchlist.

Import merges favorites instead of replacing the existing list. This strategy
is safer for a file shared between users: an import cannot silently delete
already saved favorites.

### Export

Associated code:
[`GET /api/assets/watchlist/file`](../../../web/src/app/api/assets/watchlist/file/route.ts#L29)

Endpoint:

```text
GET /api/assets/watchlist/file
```

The route:

- requires a valid session or API identity;
- reads only the current user's favorites;
- generates JSON without storing a server file;
- returns a private download without cache.

File name:

```text
cleartrend-watchlist-YYYY-MM-DD.json
```

### Client Validation of Import

Associated code:
[`handleWatchlistFileChange`](../../../web/src/components/ProfileSettingsDialog.tsx#L327)

Before upload, the browser checks:

- `.json` extension;
- MIME `application/json`;
- size between 1 byte and 64 KB;
- syntactically valid JSON;
- supported format and version;
- presence of the `symbols` array;
- maximum 999 entries;
- symbol syntax.

The interface displays a preview:

- number of valid symbols;
- first symbols found;
- number of invalid entries ignored.

The user then explicitly confirms adding them to favorites.

The preview is built locally before sending. It helps detect a wrong file and
know the number of invalid entries without modifying the database.

### Progress

Associated code:
[`handleWatchlistImport`](../../../web/src/components/ProfileSettingsDialog.tsx#L418)

Import uses `XMLHttpRequest` and `request.upload.progress`.

A `progress` bar displays the percentage of transmitted bytes. The button is
disabled while sending to avoid duplicate imports.

### Server Validation

Associated code:
[`POST /api/assets/watchlist/file`](../../../web/src/app/api/assets/watchlist/file/route.ts#L52)

Endpoint:

```text
POST /api/assets/watchlist/file
Content-Type: multipart/form-data
```

The server repeats all important validations. It never trusts browser
validation.

It checks:

- authentication;
- `multipart/form-data`;
- `.json` file name;
- MIME `application/json`;
- non-empty file;
- maximum size of 64 KB;
- valid JSON;
- format and version;
- array and entry count;
- symbol syntax and deduplication;
- symbol existence in the tickers exposed by FastAPI.

Recognized symbols are merged with existing favorites. Duplicates do not create
a new entry and unknown symbols are returned as ignored.

The JSON file itself is not kept. Only valid symbols are stored in the user's
watchlist. There is therefore no imported document to protect or delete after
processing.

Example response:

```json
{
  "alreadyFavoriteSymbols": ["AAPL"],
  "favoriteSymbols": ["AAPL", "MSFT"],
  "ignoredSymbols": ["ZZZZZZ"],
  "importedSymbols": ["MSFT"],
  "invalidEntries": 1
}
```

## Part 3 - Dashboard Export as CSV and JSON

### Goal

The chart lets users download the currently visible candles so they can open
them in a spreadsheet, analyze them with another tool, or keep a snapshot of
the displayed data.

The `Export CSV` and `Export JSON` buttons use exactly:

- the selected asset;
- the active range, for example `1D` or `1M`;
- the dates chosen by the user;
- the candles remaining after this filtering.

They are disabled while loading, on error, or when no candle is visible.

### Exported Content

Associated code:
[`createChartCsvExport` and `createChartJsonExport`](../../../web/src/lib/chart-analytics.ts#L58)

Each candle contains:

| Field | Meaning |
|---|---|
| `datetime` | Candle date and time |
| `open` | Opening price |
| `high` | Highest price |
| `low` | Lowest price |
| `close` | Closing price |
| `volume` | Volume, when available |
| `change_percent` / `changePercent` | Variation between open and close |

The CSV adds `symbol` and `range` on each row so it remains understandable when
opened alone in a spreadsheet.

The JSON adds global metadata: symbol, range, interval, source, update date,
export date, `cleartrend-chart` format, and version `1`. Its versioned format
clearly identifies a ClearTrend export.

### Download Generation

Associated code:
[`downloadChartData`](../../../web/src/components/AssetChart.tsx#L864)

Content is generated entirely in `AssetChart`:

```text
Visible candles
      |
      +--> CSV or JSON conversion
      |
      +--> Blob creation in memory
      |
      +--> temporary browser URL
      |
      +--> download, then URL release
```

No file is created or kept on the server. There is therefore no private storage
or additional access control: the exported data is the data the user already
received to display the dashboard.

File names:

```text
cleartrend-<symbol>-<range>-YYYY-MM-DD.csv
cleartrend-<symbol>-<range>-YYYY-MM-DD.json
```

## Variables and Limits

### Avatar

| Rule | Value |
|---|---:|
| Maximum file size | 5 MB |
| Minimum dimension | 64 x 64 px |
| Maximum input pixels | 25,000,000 |
| Maximum output dimension | 1024 x 1024 px |
| Output format | WebP |
| WebP quality | 82 |
| Docker directory | `/app/uploads/avatars` |
| Directory variable | `AVATAR_UPLOAD_DIR` |

### Watchlist JSON

| Rule | Value |
|---|---:|
| MIME | `application/json` |
| Extension | `.json` |
| Maximum size | 64 KB |
| Maximum number of symbols | 999 |
| Version | 1 |

### Dashboard Export

| Rule | Value |
|---|---:|
| Formats | CSV and JSON |
| JSON schema | `cleartrend-chart`, version 1 |
| Variation precision | 6 decimals maximum |
| Exported data | Visible candles after filtering |
| Server storage | None |

## Automated Tests

Start the project in development mode:

```sh
make dev
```

Run all module tests:

```sh
make test-file-upload
```

The command executes three scenarios from `tests/scripts/`.

### Image Pipeline

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:avatar-images
```

Cases verified:

- square JPEG;
- panoramic PNG;
- vertical WebP;
- 4000 x 4000 JPEG;
- EXIF orientation;
- metadata removal;
- image too small;
- pixel limit exceeded;
- falsified MIME;
- non-image content.

### Avatar API

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:avatar-upload
```

The test:

- creates a temporary account;
- authenticates;
- uploads a panoramic image with zoom and offsets;
- verifies crop values in the database;
- verifies rejection without a session;
- replaces the image with a vertical format;
- verifies deletion of the old file;
- tests an image that is too small, a falsified MIME, and a file that is too
  large;
- removes the avatar;
- deletes the temporary account.

### Watchlist JSON API

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml \
  exec -T web npm run test:watchlist-file
```

The test:

- verifies rejection without authentication;
- exports an empty list;
- imports valid, duplicate, invalid, and unknown symbols;
- verifies favorite merging;
- reexports the list;
- tests a second idempotent import;
- rejects a wrong MIME;
- rejects broken JSON;
- rejects an unknown version;
- rejects a file larger than 64 KB;
- deletes the temporary account.

### Dashboard CSV and JSON Export

```sh
make test-analytics-dashboard
```

The test verifies:

- CSV header and rows;
- missing values, such as unavailable volume;
- percentage variation calculation;
- JSON format and version;
- chart metadata;
- dated file name.

## Manual Verification

### Avatar

1. Open profile settings.
2. Choose a panoramic image.
3. Move the image and change zoom.
4. Save and reopen the profile.
5. Verify that the framing is preserved.
6. Replace the image with a vertical image.
7. Remove the avatar.

### Watchlist JSON

1. Add two or three symbols to favorites.
2. Open profile settings.
3. Click `Export JSON`.
4. Remove one favorite.
5. Click `Import JSON`.
6. Verify the preview and confirm.
7. Verify that the favorite returns in the watchlist.

### Dashboard Export

1. Open an asset in the dashboard.
2. Choose a range and, if necessary, limit the dates.
3. Click `Export CSV`, then open the file in a spreadsheet.
4. Click `Export JSON` and verify its metadata and candles.
5. Confirm that the files contain only visible data.

## Main Files

| File | Role |
|---|---|
| `web/src/lib/avatar-images.ts` | Sharp pipeline |
| `web/src/lib/avatar-storage.ts` | Private storage and deletion |
| `web/src/lib/profile-rules.ts` | File limits and crop bounds |
| `web/src/lib/profile-types.ts` | Profile contract and crop metadata |
| `web/src/app/api/profile/route.ts` | Avatar upload and metadata |
| `web/src/app/api/profile/avatar/[fileName]/route.ts` | Authenticated read |
| `web/src/components/ProfileSettingsDialog.tsx` | Previews, progress, and actions |
| `web/src/components/UserAvatar.tsx` | Visual application of zoom and offsets |
| `web/src/lib/watchlist-file.ts` | JSON format and validation |
| `web/src/app/api/assets/watchlist/file/route.ts` | Import and export |
| `web/src/lib/assets.ts` | Reading and merging favorites in the database |
| `web/src/app/api/account/delete/route.ts` | Avatar cleanup on account deletion |
| `web/src/lib/chart-analytics.ts` | CSV/JSON content and file-name construction |
| `web/src/components/AssetChart.tsx` | Download trigger for visible candles |
| `docker-compose.yml` | Persistent `avatar_uploads` volume |
| `tests/scripts/` | Automated scenarios for the three flows |

## Accepted Limitations

- Symbols must exist in the FastAPI cache at import time.
- Cropping is applied at display time and not embedded in the WebP file. Another
  consumer of the raw file would therefore not recover the same framing.
- The Docker volume is shared by a single web instance. A horizontal
  architecture with several servers would require shared object storage.
- Dashboard export is a snapshot of already loaded data. It does not ask the
  backend for a wider history than the visible range.
- CSV is intended for tabular analysis and does not preserve all global
  metadata available in JSON.
