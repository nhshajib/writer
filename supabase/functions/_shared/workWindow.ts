/** Daily writing hours, evaluated in an IANA time zone, including DST. */
export interface WorkWindow {
  start: string;
  end: string;
  time_zone: string;
  /** ISO weekdays: Monday=1 through Sunday=7. Omitted means every day. */
  days?: number[];
}

export function readWorkWindow(raw: unknown): WorkWindow | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new RangeError("Writing hours must be an object.");
  const value = raw as Record<string, unknown>;
  const clock = (v: unknown): v is string => typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
  if (!clock(value.start) || !clock(value.end) || value.start === value.end) {
    throw new RangeError("Choose different opening and closing times for writing hours.");
  }
  if (typeof value.time_zone !== "string" || value.time_zone.length > 100) throw new RangeError("Choose a time zone.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.time_zone }).format(0);
  } catch {
    throw new RangeError("Choose a valid time zone for writing hours.");
  }
  if (
    value.days !== undefined &&
    (!Array.isArray(value.days) || value.days.length < 1 || value.days.length > 7 ||
      value.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7))
  ) {
    throw new RangeError("Choose at least one writing day.");
  }
  return {
    start: value.start,
    end: value.end,
    time_zone: value.time_zone,
    ...(value.days ? { days: [...new Set(value.days as number[])] } : {}),
  };
}

/** Cache minute decisions for one projection; no customer-specific global cache. */
export function writingClock(window: WorkWindow) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: window.time_zone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const start = minutes(window.start), end = minutes(window.end);
  const days = new Set(window.days ?? [1, 2, 3, 4, 5, 6, 7]);
  const weekdays: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const cache = new Map<number, boolean>();
  const allowed = (at: number) => {
    const minute = Math.floor(at / 60_000);
    if (cache.has(minute)) return cache.get(minute)!;
    const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
    const clock = Number(parts.hour) * 60 + Number(parts.minute);
    const day = weekdays[parts.weekday];
    const ownerDay = start > end && clock < end ? (day + 5) % 7 + 1 : day;
    const result = days.has(ownerDay) && (start < end ? clock >= start && clock < end : clock >= start || clock < end);
    cache.set(minute, result);
    return result;
  };
  return (at: number): number => {
    if (!Number.isFinite(at)) throw new RangeError("Invalid writing time.");
    if (allowed(at)) return at;
    // UTC minutes make nonexistent and repeated local DST times unambiguous.
    const first = Math.floor(at / 60_000) * 60_000 + 60_000;
    for (let i = 0; i <= 8 * 24 * 60; i++) {
      const candidate = first + i * 60_000;
      if (allowed(candidate)) return candidate;
    }
    throw new RangeError("No writing window is available in the next week.");
  };
}

export function windowSchedule(offsets: number[], startsAt: number, window: WorkWindow): number[] {
  const next = writingClock(window);
  let shift = 0;
  return offsets.map((offset) => {
    const wanted = startsAt + offset + shift;
    shift += next(wanted) - wanted;
    return offset + shift;
  });
}
