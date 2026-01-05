/** ---------------- Date grid utils (UTC, avoid TZ bugs) ---------------- */
export type WeekStart = "sun" | "mon";

function toDateOnlyUTC(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysBetweenUTC(a: Date, b: Date) {
    const ms = toDateOnlyUTC(b).getTime() - toDateOnlyUTC(a).getTime();
    return Math.floor(ms / 86400000);
}

function weekdayIndexUTC(date: Date, weekStart: WeekStart) {
    const dow = date.getUTCDay(); // 0=Sun..6=Sat
    if (weekStart === "sun") return dow;
    return (dow + 6) % 7; // Mon=0..Sun=6
}

function startOfGridUTC(startDate: Date, weekStart: WeekStart) {
    const d = toDateOnlyUTC(startDate);
    const row = weekdayIndexUTC(d, weekStart);
    const gridStart = new Date(d);
    gridStart.setUTCDate(gridStart.getUTCDate() - row);
    return gridStart;
}

export function buildYearDateGrid(year: number, weekStart: WeekStart) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31));

    const gridStart = startOfGridUTC(startDate, weekStart);
    const totalDays = daysBetweenUTC(gridStart, endDate) + 1;
    const weeks = Math.ceil(totalDays / 7);

    const dates: Date[][] = Array.from({ length: weeks }, (_, w) =>
        Array.from({ length: 7 }, (_, r) => {
            const dt = new Date(gridStart);
            dt.setUTCDate(dt.getUTCDate() + w * 7 + r);
            return dt;
        })
    );

    return { year, weekStart, startDate, endDate, gridStart, weeks, dates };
}

export function inYear(dt: Date, year: number) {
    return dt.getUTCFullYear() === year;
}

export function formatISODate(dt: Date) {
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}