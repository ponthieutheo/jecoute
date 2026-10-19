import type { TFunction } from "i18next";
import type { Call, Line, Speaker } from "@/bindings";

const pad = (n: number) => n.toString().padStart(2, "0");

/** Une durée en secondes en horloge : « 4:05 », « 1:02:05 ». */
export const clock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** Durée d'un appel en minutes arrondies, jamais moins d'une. */
export const minutes = (call: {
  started_at: number;
  ended_at: number | null;
}) => {
  const ms = (call.ended_at ?? Date.now()) - call.started_at;
  return Math.max(1, Math.round(ms / 60_000));
};

/** Qui a dit une ligne : la personne nommée, sinon « Moi » / « Les autres » (direct). */
export const speakerOf = (
  call: Call,
  line: Line,
  t: TFunction,
): { name: string; color: number } => {
  const known = call.speakers.find((s) => s.id === line.speaker);
  if (known) return { name: known.name, color: known.color };
  return line.speaker === "me"
    ? { name: t("app.calls.me"), color: 0 }
    : { name: t("app.calls.others"), color: 1 };
};

/** Couleur d'une personne (jetons --j-sp-0 à --j-sp-5 de app.css). */
export const speakerColor = (index: number) => `var(--j-sp-${index % 6})`;

export const initial = (s: Speaker) =>
  (s.name.trim().charAt(0) || "?").toLocaleUpperCase();

/**
 * La note d'un appel en Markdown, pour l'export et le presse-papiers : une
 * fiche (date, durée, personnes), les notes de l'IA, puis la transcription
 * horodatée.
 */
export const callMarkdown = (call: Call, t: TFunction, language: string) => {
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(call.started_at));
  const sections: string[] = [`# ${call.title}`];

  const facts = [
    `- ${t("app.calls.md.date")} ${date}`,
    `- ${t("app.calls.md.length")} ${t("app.calls.minutes", { count: minutes(call) })}`,
  ];
  if (call.speakers.length > 0) {
    facts.push(
      `- ${t("app.calls.md.people")} ${call.speakers.map((s) => s.name).join(", ")}`,
    );
  }
  sections.push(facts.join("\n"));

  if (call.summary)
    sections.push(`## ${t("app.calls.summary")}\n\n${call.summary}`);
  if (call.key_points.length > 0) {
    const points = call.key_points.map((p) => `- ${p}`).join("\n");
    sections.push(`## ${t("app.calls.keyPoints")}\n\n${points}`);
  }
  if (call.todos.length > 0) {
    const tasks = call.todos
      .map((todo) => {
        const box = todo.done ? "[x]" : "[ ]";
        const who = [todo.owner, todo.due].filter(Boolean).join(" · ");
        return who ? `- ${box} ${todo.text} — ${who}` : `- ${box} ${todo.text}`;
      })
      .join("\n");
    sections.push(`## ${t("app.calls.todos")}\n\n${tasks}`);
  }
  if (call.lines.length > 0) {
    const said = call.lines
      .map(
        (l) =>
          `\`${clock(l.start)}\` **${speakerOf(call, l, t).name}** — ${l.text}`,
      )
      .join("\n\n");
    sections.push(`## ${t("app.calls.transcript")}\n\n${said}`);
  }
  return `${sections.join("\n\n")}\n`;
};
