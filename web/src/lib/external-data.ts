export const externalDataCooldownMs = 5 * 60 * 1000;

export class ExternalDataCooldownError extends Error {
  constructor(message = "External data was requested recently.") {
    super(message);
    this.name = "ExternalDataCooldownError";
  }
}

export function wasAttemptedRecently(
  attemptedAt: Date | number | null | undefined,
  now = Date.now()
) {
  if (!attemptedAt) {
    return false;
  }

  const timestamp =
    attemptedAt instanceof Date ? attemptedAt.getTime() : attemptedAt;

  return now - timestamp < externalDataCooldownMs;
}
