import { FONT_5X7 } from "./constant";

/**
 * Converts a Date to a date-only value in UTC (strips time component).
 * @param d - The date to convert
 * @returns A new Date object with only the date portion in UTC
 */
function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Calculates the number of days between two dates.
 * @param a - The start date
 * @param b - The end date
 * @returns The number of days between the two dates
 */
function daysBetween(a: Date, b: Date): number {
  const ms = toDateOnly(b).getTime() - toDateOnly(a).getTime();
  return Math.floor(ms / 86400000);
}

/**
 * Gets the weekday index for a given date based on week start preference.
 * @param date - The date to get the weekday index for
 * @param weekStart - Whether the week starts on Sunday or Monday
 * @returns Weekday index (0-6), where 0 is the start of the week
 */
function weekdayIndex(date: Date, weekStart: "sun" | "mon"): number {
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  if (weekStart === "sun") return dow;
  return (dow + 6) % 7; // Mon=0..Sun=6
}

/**
 * Calculates the grid start date by moving back to the beginning of the week.
 * @param startDate - The reference start date
 * @param weekStart - Whether the week starts on Sunday or Monday
 * @returns The date at the start of the week containing startDate
 */
function startOfGrid(startDate: Date, weekStart: "sun" | "mon"): Date {
  const d = toDateOnly(startDate);
  const row = weekdayIndex(d, weekStart);
  const gridStart = new Date(d);
  gridStart.setUTCDate(gridStart.getUTCDate() - row);
  return gridStart;
}

/**
 * Builds a date grid matrix for a given year.
 * Returns a 2D array where dates[week][day] represents the date at that position.
 * @param year - The year to build the grid for
 * @param weekStart - Whether the week starts on Sunday or Monday (default: "sun")
 * @returns An object containing grid metadata and the dates matrix
 * @property {Date} gridStart - The first date in the grid (may be in previous year)
 * @property {Date} startDate - January 1st of the specified year
 * @property {Date} endDate - December 31st of the specified year
 * @property {number} weeks - Total number of week columns in the grid
 * @property {Date[][]} dates - 2D array of dates, indexed as [week][day]
 */
export function buildYearDateGrid(year: number, weekStart: "sun" | "mon" = "sun") {
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 11, 31));

  const gridStart = startOfGrid(startDate, weekStart);
  const totalDays = daysBetween(gridStart, endDate) + 1;
  const weeks = Math.ceil(totalDays / 7);

  const dates = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, r) => {
      const dt = new Date(gridStart);
      dt.setUTCDate(dt.getUTCDate() + w * 7 + r);
      return dt;
    })
  );

  return { gridStart, startDate, endDate, weeks, dates };
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function makeEmptyGrid(weeks: number, days = 7) {
  return Array.from({ length: weeks }, () => Array.from({ length: days }, () => 0));
}

export function rasterizeText5x7(text: string, spacing = 1) {
  const chars = (text || "").toUpperCase().split("");
  const glyphs = chars.map((c) => FONT_5X7[c] ?? FONT_5X7[" "]);

  const height = 7;
  const charWidth = 5;
  const width = glyphs.length === 0 ? 0 : glyphs.length * (charWidth + spacing) - spacing;
  const bmp = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));

  let x = 0;
  for (const g of glyphs) {
    for (let y = 0; y < height; y++) {
      const row = g[y];
      for (let i = 0; i < charWidth; i++) {
        bmp[y][x + i] = row[i] === "1" ? 1 : 0;
      }
    }
    x += charWidth + spacing;
  }
  return bmp;
}