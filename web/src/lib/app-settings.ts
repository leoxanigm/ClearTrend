import { getPrisma } from '@/lib/prisma';

export const financeRefreshRateSettingKey = 'financeRefreshRateSeconds';
export const financeRefreshRateOptions = [60, 300, 900] as const;
export const defaultFinanceRefreshRateSeconds = 300;

export type FinanceRefreshRateSeconds =
  (typeof financeRefreshRateOptions)[number];

export function normalizeFinanceRefreshRate(
  value: unknown
): FinanceRefreshRateSeconds {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN;

  return financeRefreshRateOptions.includes(
    numericValue as FinanceRefreshRateSeconds
  )
    ? (numericValue as FinanceRefreshRateSeconds)
    : defaultFinanceRefreshRateSeconds;
}

export async function getFinanceRefreshRateSeconds() {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    SELECT value
    FROM app_settings
    WHERE key = ${financeRefreshRateSettingKey}
    LIMIT 1
  `;

  return normalizeFinanceRefreshRate(rows[0]?.value);
}

export async function setFinanceRefreshRateSeconds(value: unknown) {
  const refreshRateSeconds = normalizeFinanceRefreshRate(value);
  const prisma = getPrisma();

  await prisma.$executeRaw`
    INSERT INTO app_settings (key, value, "updatedAt")
    VALUES (${financeRefreshRateSettingKey}, ${String(refreshRateSeconds)}, now())
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      "updatedAt" = now()
  `;

  return refreshRateSeconds;
}

export async function deleteFinanceRefreshRateSeconds() {
  const prisma = getPrisma();

  await prisma.$executeRaw`
    DELETE FROM app_settings
    WHERE key = ${financeRefreshRateSettingKey}
  `;

  return defaultFinanceRefreshRateSeconds;
}
