export type DiffPart = {
  kind: "same" | "ins" | "del";
  /** Le mot tel qu'il apparaît dans sa version (corrigée pour « same »). */
  text: string;
  /** Pour « same » : le mot dans la version brute (casse, ponctuation). */
  raw?: string;
};

const normalize = (word: string) =>
  word.toLocaleLowerCase().replace(/[.,:;!?«»"“”’'()…-]/g, "");

const MAX_CELLS = 250_000;

/**
 * Différences mot à mot entre la transcription brute et la version corrigée
 * (plus longue sous-suite commune, ponctuation et casse ignorées) :
 * « del » = retiré par l'IA, « ins » = ajouté par l'IA.
 */
export const wordDiff = (raw: string, corrected: string): DiffPart[] => {
  const a = raw.split(/\s+/).filter(Boolean);
  const b = corrected.split(/\s+/).filter(Boolean);
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map((text) => ({ kind: "del" as const, text })),
      ...b.map((text) => ({ kind: "ins" as const, text })),
    ];
  }
  const na = a.map(normalize);
  const nb = b.map(normalize);
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        na[i] === nb[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) {
      out.push({ kind: "same", text: b[j], raw: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      out.push({ kind: "del", text: a[i++] });
    } else {
      out.push({ kind: "ins", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ kind: "del", text: a[i++] });
  while (j < b.length) out.push({ kind: "ins", text: b[j++] });
  return out;
};
