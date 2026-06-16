// The footer models the regular NYSE opening time in its own timezone.
const marketTimeZone = "America/New_York";
const marketOpenHour = 9;
const marketOpenMinute = 30;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

type CalendarDate = {
  day: number;
  month: number;
  year: number;
};

// Fixed-date holidays observed on Friday or Monday follow NYSE convention.
function getObservedDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  if (weekday === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  } else if (weekday === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date;
}

// Build holidays such as the third Monday of January without hard-coded dates.
function getNthWeekday(
  year: number,
  month: number,
  weekday: number,
  occurrence: number
) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - date.getUTCDay() + 7) % 7;

  date.setUTCDate(1 + offset + (occurrence - 1) * 7);
  return date;
}

// Memorial Day is represented as the last Monday of May.
function getLastWeekday(year: number, month: number, weekday: number) {
  const date = new Date(Date.UTC(year, month, 0));
  const offset = (date.getUTCDay() - weekday + 7) % 7;

  date.setUTCDate(date.getUTCDate() - offset);
  return date;
}

// Good Friday is derived from Easter, whose date changes every year.
function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Return the regular full-day NYSE closures used by the dashboard indication.
function getMarketHolidays(year: number) {
  const goodFriday = getEasterSunday(year);

  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);

  return new Set([
    toDateKey(getObservedDate(year, 1, 1)),
    toDateKey(getObservedDate(year + 1, 1, 1)),
    toDateKey(getNthWeekday(year, 1, 1, 3)),
    toDateKey(getNthWeekday(year, 2, 1, 3)),
    toDateKey(goodFriday),
    toDateKey(getLastWeekday(year, 5, 1)),
    toDateKey(getObservedDate(year, 6, 19)),
    toDateKey(getObservedDate(year, 7, 4)),
    toDateKey(getNthWeekday(year, 9, 1, 1)),
    toDateKey(getNthWeekday(year, 11, 4, 4)),
    toDateKey(getObservedDate(year, 12, 25)),
  ]);
}

// Read the current instant as wall-clock fields in New York.
function getZonedDateParts(date: Date): CalendarDate & {
  hour: number;
  minute: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: marketTimeZone,
    weekday: "short",
    year: "numeric",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  const weekdays: Record<string, number> = {
    Fri: 5,
    Mon: 1,
    Sat: 6,
    Sun: 0,
    Thu: 4,
    Tue: 2,
    Wed: 3,
  };

  return {
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    month: Number(parts.month),
    weekday: weekdays[parts.weekday],
    year: Number(parts.year),
  };
}

// Calendar arithmetic is performed in UTC to avoid local daylight-saving jumps.
function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const nextDate = new Date(
    Date.UTC(date.year, date.month - 1, date.day) + days * millisecondsPerDay
  );

  return {
    day: nextDate.getUTCDate(),
    month: nextDate.getUTCMonth() + 1,
    year: nextDate.getUTCFullYear(),
  };
}

// Weekends and configured exchange holidays are not regular trading days.
function isMarketDay(date: CalendarDate) {
  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const weekday = utcDate.getUTCDay();

  return (
    weekday !== 0 &&
    weekday !== 6 &&
    !getMarketHolidays(date.year).has(toDateKey(utcDate))
  );
}

// Intl supplies the historical New York UTC offset, including daylight saving.
function getTimeZoneOffsetMilliseconds(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: marketTimeZone,
    year: "numeric",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return zonedAsUtc - date.getTime();
}

// Convert 09:30 New York wall time into the corresponding absolute timestamp.
function getMarketOpenTimestamp(date: CalendarDate) {
  const approximateTimestamp = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    marketOpenHour,
    marketOpenMinute
  );
  const approximateDate = new Date(approximateTimestamp);

  return (
    approximateTimestamp - getTimeZoneOffsetMilliseconds(approximateDate)
  );
}

// Find today's opening when still upcoming, otherwise the next market day.
export function getNextMarketOpen(now = new Date()) {
  const marketNow = getZonedDateParts(now);
  let candidate: CalendarDate = marketNow;
  const beforeOpen =
    marketNow.hour < marketOpenHour ||
    (marketNow.hour === marketOpenHour &&
      marketNow.minute < marketOpenMinute);

  if (!beforeOpen || !isMarketDay(candidate)) {
    candidate = addCalendarDays(candidate, 1);
  }

  while (!isMarketDay(candidate)) {
    candidate = addCalendarDays(candidate, 1);
  }

  return new Date(getMarketOpenTimestamp(candidate));
}
