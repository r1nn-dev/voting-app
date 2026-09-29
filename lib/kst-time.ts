// Korea Standard Time helpers for display and form input. Shared with client
// components. These never decide whether a poll is closed (ADR-0006).

const KST_OFFSET = "+09:00";

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAYS: Record<string, string> = {
  Sun: "일",
  Mon: "월",
  Tue: "화",
  Wed: "수",
  Thu: "목",
  Fri: "금",
  Sat: "토",
};

function kstParts(date: Date) {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: parts.minute,
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** "10월 3일 (토) 오후 6:00" */
export function formatKst(date: Date): string {
  const { month, day, weekday, hour, minute } = kstParts(date);
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${month}월 ${day}일 (${weekday}) ${period} ${hour12}:${minute}`;
}

/** Remaining time in its largest unit: "3일", "5시간", "20분", "1분 미만". */
export function formatRemaining(until: Date, from: Date = new Date()): string {
  const ms = until.getTime() - from.getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}

/** Whole days left, rounded up and at least 1: "30일" for 29.9 days, "1일" for 5 hours. */
export function formatDaysLeft(until: Date, from: Date = new Date()): string {
  const days = Math.ceil((until.getTime() - from.getTime()) / 86_400_000);
  return `${Math.max(1, days)}일`;
}

/** Value for <input type="datetime-local">, in KST: "2026-10-03T18:00". */
export function toKstInputValue(date: Date): string {
  const { year, month, day, hour, minute } = kstParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}`;
}

/** Reads a datetime-local value as KST. Null when missing, malformed or impossible (Feb 30). */
export function parseKstInput(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${KST_OFFSET}`);
  // Date rolls impossible days over (Feb 30 → Mar 2); the round trip catches that.
  return !Number.isNaN(date.getTime()) && toKstInputValue(date) === value ? date : null;
}

/** datetime-local value (KST) for `ms` from now. */
export function kstInputFromNow(ms: number): string {
  return toKstInputValue(new Date(Date.now() + ms));
}
