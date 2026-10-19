import type { DayStats } from "@/bindings";

export type Period = "week" | "month" | "all";
export type Bucket = "day" | "week" | "month";

export interface Bar {
  /** Premier jour de la barre (heure locale). */
  start: Date;
  words: number;
  /** Aujourd'hui (ou la semaine / le mois en cours). */
  current: boolean;
}

/** « 2026-10-19 » → date locale à minuit. */
export const parseDay = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const dayKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Lundi de la semaine d'un jour. */
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

const daysBetween = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  );

/**
 * Les barres du graphique : 7 jours, 30 jours, ou depuis la première dictée
 * (par jour jusqu'à 60 jours, puis par semaine, puis par mois au-delà d'un an).
 */
export const buildSeries = (
  days: DayStats[],
  todayKey: string,
  period: Period,
): { bucket: Bucket; bars: Bar[] } => {
  const today = parseDay(todayKey);
  const words = new Map(days.map((d) => [d.day, d.words]));
  const daily = (count: number): Bar[] =>
    Array.from({ length: count }, (_, i) => {
      const start = addDays(today, i - count + 1);
      return {
        start,
        words: words.get(dayKeyOf(start)) ?? 0,
        current: i === count - 1,
      };
    });

  if (period === "week") return { bucket: "day", bars: daily(7) };
  if (period === "month") return { bucket: "day", bars: daily(30) };

  const first = days.length ? parseDay(days[0].day) : today;
  const span = Math.max(30, daysBetween(first, today) + 1);
  if (span <= 60) return { bucket: "day", bars: daily(span) };

  if (span <= 366) {
    const firstWeek = mondayOf(first);
    const thisWeek = mondayOf(today);
    const count = Math.round(daysBetween(firstWeek, thisWeek) / 7) + 1;
    const bars: Bar[] = Array.from({ length: count }, (_, i) => ({
      start: addDays(firstWeek, i * 7),
      words: 0,
      current: i === count - 1,
    }));
    for (const d of days) {
      const i = Math.round(
        daysBetween(firstWeek, mondayOf(parseDay(d.day))) / 7,
      );
      if (bars[i]) bars[i].words += d.words;
    }
    return { bucket: "week", bars };
  }

  const months =
    (today.getFullYear() - first.getFullYear()) * 12 +
    today.getMonth() -
    first.getMonth() +
    1;
  const bars: Bar[] = Array.from({ length: months }, (_, i) => ({
    start: new Date(first.getFullYear(), first.getMonth() + i, 1),
    words: 0,
    current: i === months - 1,
  }));
  for (const d of days) {
    const date = parseDay(d.day);
    const i =
      (date.getFullYear() - first.getFullYear()) * 12 +
      date.getMonth() -
      first.getMonth();
    if (bars[i]) bars[i].words += d.words;
  }
  return { bucket: "month", bars };
};
