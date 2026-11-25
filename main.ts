// Fortune in a Pot — make.fun entry (program/v1, Node 22, stdlib only).
//
// The bounty asks for one line, at most 120 characters, telling a
// houseplant's fortune: kind, funny, and unmistakably about the plant on
// the windowsill. A gardener judge compares entries two at a time on five
// criteria, in this order:
//
//   1. It is a fortune for a houseplant, about the plant's own future.
//   2. It is funny in a way a plant lover would laugh at — a small joke
//      that lands, not a pun groaned at.
//   3. It is kind and warm, with no doom, no withering and no mockery.
//   4. It sounds like a fortune, with the cadence of a prediction.
//   5. It is one line of at most 120 characters that reads cleanly aloud.
//
// This program holds a set of hand-written candidate one-liners, scores
// each one deterministically against those five criteria (weights in the
// brief's order: 40 / 25 / 20 / 10 / 5), writes the winner to
// $MAKEFUN_OUTPUT_DIR/entry.txt (falling back to /output/entry.txt), then
// reads the file back and verifies it byte-for-byte against every gate:
// UTF-8, 1-120 characters, a single line, not only white space.
//
// Revision pass: the scorer was tightened in four ways that track the
// judge's brief more closely than the first draft did. (a) A groan-pun
// guard: any line leaning on a tired plant pun ("aloe", "lettuce",
// "turnip", ...) has its humour score capped, because the brief wants a
// joke that lands, not a pun groaned at. (b) A freshness check: the set
// must not carry the same joke twice — a candidate that repeats a
// distinctive joke-core an earlier candidate already used loses humour
// points, so the plainer second cut of a joke cannot win on its twin's
// strength. (c) A padding check on criterion 5: the brief says there is
// no padding to reach the limit and length for its own sake does not
// count, so a clean line over 115 characters loses one point. (d) The
// tie-break now prefers the funnier line before falling back to
// alphabetical order, matching the judge's own order (funny before kind).
// Four new hand-written candidates were added in the same pass.
//
// No network, no dependencies, no randomness: the same run always picks
// the same line.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Candidate = {
  text: string;
  // Humour, 0-10, the author's own judgement of how well the joke lands
  // for a plant lover. Humour cannot be counted from keywords, so it is
  // annotated by hand next to each line, with the reason in `note`.
  humor: number;
  note: string;
};

// ---------------------------------------------------------------------------
// Candidates: every line written by hand for this bounty. Each is a
// prediction spoken to the plant itself ("you"), set on this windowsill,
// with the joke in the second half — the keeper's pride doing the comic
// work, never the plant's expense.
// ---------------------------------------------------------------------------
const CANDIDATES: Candidate[] = [
  {
    text: "Soon the morning sun will find your newest leaf, and your keeper will swear you grew it overnight just to show off.",
    humor: 7,
    note: "The plant showing off overnight is a gentle, visual joke.",
  },
  {
    text: "This week, a sunbeam will land exactly where you lean, and you will bloom like you planned it all along.",
    humor: 6,
    note: "The plant as a quiet schemer; mild, warm, a little smug.",
  },
  {
    text: "Your future is bright and leafy: new growth by Friday, and applause from everyone who walks past the sill.",
    humor: 6,
    note: "Applause from passers-by is charming but the joke is thin.",
  },
  {
    text: "Before the week is out, you will unfurl a leaf so perfect your keeper will photograph it, then pretend they did not.",
    humor: 8,
    note: "Every plant keeper has taken that photo; the denial lands.",
  },
  {
    text: "The stars say: good light, good water, and one very proud human who will tell guests you are thriving because of them.",
    humor: 7,
    note: "The keeper taking credit for the plant's thriving is relatable.",
  },
  {
    text: "Soon you will catch the best sun on this sill, stretch one brave leaf toward it, and make the whole room jealous.",
    humor: 7,
    note: "A confident plant making the room jealous; playful, not mean.",
  },
  {
    text: "A small miracle is coming to this windowsill: you, greener than yesterday, with a new leaf and zero apologies.",
    humor: 6,
    note: "'Zero apologies' is sassy, but the joke does not quite land.",
  },
  {
    text: "By Sunday you will have a new leaf, a sunbeam on this sill, and a keeper bragging about you to people who did not ask.",
    humor: 9,
    note: "The strongest joke: a proud keeper oversharing to unwilling guests. Every plant lover knows that keeper — or is that keeper.",
  },
  {
    text: "Your leaves will turn toward the morning light like applause, and this windowsill will be the best seat in the house.",
    humor: 5,
    note: "Pretty and warm, but more poetry than joke.",
  },
  {
    text: "Fortune smiles on this sill: a new leaf is on its way, and your keeper is about to take full credit for your glow-up.",
    humor: 8,
    note: "'Take full credit for your glow-up' is a sharp, modern joke.",
  },
  {
    text: "Good news from the windowsill: a fresh leaf is coming, the sun saved you the best spot, and your keeper told friends.",
    humor: 7,
    note: "The keeper telling friends is warm, but a softer cut of the same joke.",
  },
  {
    text: "This windowsill has big plans for you: one perfect new leaf, golden light, and a keeper who will take the credit.",
    humor: 7,
    note: "Same credit-taking joke as the glow-up line, slightly plainer.",
  },
  // --- Revision pass: four new lines, each a fresh joke, each shorter
  // than the old winner, so none of them leans on length. ---
  {
    text: "Soon you will outgrow this pot on the sill, and your keeper will buy a bigger one and call it your promotion.",
    humor: 8,
    note: "Repotting framed as a career move: the keeper's pride, told as the plant's promotion. Fresh, modern, warm.",
  },
  {
    text: "Next week you will wake on this sill with a perfect new leaf, and your keeper will call it your good hair day.",
    humor: 8,
    note: "A new leaf as a good hair day — the keeper's framing is the joke, and every plant lover has said something like it.",
  },
  {
    text: "Tomorrow morning the sun will find you first on this sill, and your keeper will take it as a compliment.",
    humor: 7,
    note: "Quiet joke: the keeper taking the sun's favour as a personal compliment. Warm rather than loud.",
  },
  {
    text: "By Sunday your keeper will introduce you to guests by name, right here on this sill, like family.",
    humor: 7,
    note: "The keeper introducing the plant by name, like family — a small, true portrait of plant people.",
  },
];

// Word lists the scorer reads off the text itself. All matching is
// case-insensitive and whole-word, so "leaf" never matches "belief".
const PLANT_WORDS = [
  "plant", "leaf", "leaves", "pot", "root", "roots", "bloom", "blooms",
  "unfurl", "grow", "grew", "green", "greener", "stem", "stems",
];
const FUTURE_MARKERS = [
  "will", "is coming", "is on its way", "has big plans", "coming",
];
const WINDOW_WORDS = ["windowsill", "sill", "this window"];
const WARM_WORDS = [
  "bright", "bloom", "thrive", "thriving", "proud", "golden", "miracle",
  "applause", "perfect", "happy", "love", "loved", "fresh", "brave",
  "best", "smile", "smiles", "sunbeam", "gentle", "kind", "warm", "glow",
  "family", "compliment",
];
const DOOM_WORDS = [
  "wilt", "wilted", "wither", "withering", "die", "dying", "dead", "dry",
  "drying", "rot", "rotting", "brown", "doom", "thirsty", "neglected",
  "forgotten", "droop", "drooping", "stupid", "ugly", "dumb",
];
const FORTUNE_OPENERS = [
  "soon", "this week", "next week", "tomorrow", "before", "by",
  "your future", "the stars say", "fortune smiles", "a small miracle",
  "good news", "this windowsill", "your leaves",
];

// Tired plant puns the judge's brief rules out: a joke that lands, not a
// pun groaned at. Any line leaning on one of these is a groaner, however
// well it scores elsewhere.
const GROAN_PUNS = [
  "aloe", "lettuce", "thyme", "turnip", "plantastic", "be-leaf",
  "leaf me alone", "grow on you", "rooting for you", "succ it up",
  "kale", "i'm rooting",
];

// Distinctive joke cores. When two candidates share one, the later one is
// the stale cut of the joke and loses humour points (see score()).
const JOKE_CORES: { name: string; pattern: RegExp }[] = [
  { name: "take the credit", pattern: /take (full |the )?credit/i },
  { name: "bragging keeper", pattern: /brag/i },
  { name: "keeper's photo", pattern: /photograph/i },
  { name: "showing off", pattern: /show off/i },
];

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function countWords(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (hasWord(text, w)) n++;
  return n;
}

// The gate, exactly as the brief states it: UTF-8 text of 1 to 120
// characters, not only white space, a single line. Character count is in
// Unicode code points, matching how the gate counts characters.
function gateFailures(text: string): string[] {
  const failures: string[] = [];
  const chars = [...text].length;
  if (chars < 1) failures.push("empty");
  if (chars > 120) failures.push(`too long: ${chars} characters`);
  if (/[\r\n]/.test(text)) failures.push("more than one line");
  if (text.trim().length === 0) failures.push("only white space");
  if (text !== text.trim()) failures.push("leading or trailing space");
  return failures;
}

type Score = {
  candidate: Candidate;
  c1: number; // 1. a fortune for this houseplant, about its own future (40)
  c2: number; // 2. funny in a way a plant lover laughs at (25)
  c3: number; // 3. kind and warm, no doom or mockery (20)
  c4: number; // 4. sounds like a fortune, cadence of a prediction (10)
  c5: number; // 5. one clean line within 120 characters (5)
  total: number;
  disqualified: string[];
  notes: string[];
};

function score(candidate: Candidate, repeatedCores: string[]): Score {
  const { text } = candidate;
  const disqualified = gateFailures(text);
  const notes: string[] = [];

  // 1. A fortune for a houseplant (40): spoken to the plant itself (15),
  //    a prediction about its future (15), and written for this plant in
  //    this window, not any plant in any room (10).
  const addressedToPlant =
    countWords(text, PLANT_WORDS) > 0 || /\byou\b/i.test(text) || /\byour\b/i.test(text);
  const predictsFuture = FUTURE_MARKERS.some((m) => hasWord(text, m));
  const thisWindow = WINDOW_WORDS.some((w) => hasWord(text, w));
  const c1 = (addressedToPlant ? 15 : 0) + (predictsFuture ? 15 : 0) + (thisWindow ? 10 : 0);

  // 2. Funny (25): the hand-annotated humour score, scaled — then
  //    tightened twice. A groan pun caps the humour at 10, because the
  //    brief wants a joke that lands, not a pun groaned at. A repeated
  //    joke-core costs 5: the set must not carry the same joke twice.
  let c2 = (candidate.humor / 10) * 25;
  const groanHits = countWords(text, GROAN_PUNS);
  if (groanHits > 0) {
    c2 = Math.min(c2, 10);
    notes.push(`groan pun (${groanHits} hit${groanHits > 1 ? "s" : ""})`);
  }
  if (repeatedCores.length > 0) {
    c2 = Math.max(0, c2 - 5 * repeatedCores.length);
    notes.push(`stale joke: repeats ${repeatedCores.join(", ")}`);
  }

  // 3. Kind and warm (20): a warm base, plus warm words, minus a heavy
  //    penalty for any doom, withering or mockery.
  const warmHits = countWords(text, WARM_WORDS);
  const doomHits = countWords(text, DOOM_WORDS);
  const c3 = Math.max(0, Math.min(20, 10 + warmHits * 2 - doomHits * 10));

  // 4. Fortune cadence (10): opens like a prediction (5) and carries a
  //    prediction verb (5).
  const lower = text.toLowerCase();
  const opensLikeFortune = FORTUNE_OPENERS.some((o) => lower.startsWith(o));
  const c4 = (opensLikeFortune ? 5 : 0) + (predictsFuture ? 5 : 0);

  // 5. Clean line (5): the gate itself, as a score — minus one point
  //    past 115 characters, because the brief says there is no padding
  //    to reach the limit and length for its own sake does not count.
  const chars = [...text].length;
  const c5 = disqualified.length === 0 ? (chars > 115 ? 4 : 5) : 0;

  return {
    candidate,
    c1,
    c2,
    c3,
    c4,
    c5,
    total: c1 + c2 + c3 + c4 + c5,
    disqualified,
    notes,
  };
}

// Deterministic order: highest total wins; ties go to the shorter text
// (fewer bytes, as the brief's own tie-break prefers), then to the
// funnier line (the judge weighs funny before kind), then to the
// alphabetically first line, so the pick never depends on input order.
function compareScores(a: Score, b: Score): number {
  if (a.total !== b.total) return b.total - a.total;
  const bytesA = Buffer.byteLength(a.candidate.text, "utf8");
  const bytesB = Buffer.byteLength(b.candidate.text, "utf8");
  if (bytesA !== bytesB) return bytesA - bytesB;
  if (a.candidate.humor !== b.candidate.humor) return b.candidate.humor - a.candidate.humor;
  return a.candidate.text < b.candidate.text ? -1 : 1;
}

function main(): void {
  // Freshness is judged in list order: the first candidate to use a
  // joke-core owns it, and every later candidate sharing it is stale.
  const usedCores = new Set<string>();
  const scored = CANDIDATES.map((candidate) => {
    const cores = JOKE_CORES.filter((c) => c.pattern.test(candidate.text)).map((c) => c.name);
    const repeated = cores.filter((name) => usedCores.has(name));
    for (const name of cores) usedCores.add(name);
    return score(candidate, repeated);
  });
  const valid = scored.filter((s) => s.disqualified.length === 0);
  if (valid.length === 0) {
    throw new Error("No candidate passes the gate.");
  }
  valid.sort(compareScores);
  const winner = valid[0];

  for (const s of [...valid].sort(compareScores)) {
    const flags = s.notes.length > 0 ? ` [${s.notes.join("; ")}]` : "";
    console.log(
      `${s.total.toFixed(1)} ` +
        `(plant ${s.c1} / funny ${s.c2.toFixed(1)} / kind ${s.c3} / ` +
        `fortune ${s.c4} / clean ${s.c5}) ` +
        `[${[...s.candidate.text].length} chars] ${s.candidate.text}${flags}`,
    );
  }
  for (const s of scored.filter((s) => s.disqualified.length > 0)) {
    console.log(`DISQUALIFIED (${s.disqualified.join("; ")}): ${s.candidate.text}`);
  }

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");

  // Write the line exactly, with no trailing newline: the file's bytes
  // are the fortune, so the gate counts exactly the line itself.
  writeFileSync(outPath, winner.candidate.text, "utf8");

  // Read it back and verify byte-for-byte against every gate.
  const back = readFileSync(outPath);
  const expected = Buffer.from(winner.candidate.text, "utf8");
  if (!back.equals(expected)) {
    throw new Error(`Wrote ${outPath} but reading it back differs byte-for-byte.`);
  }
  const failures = gateFailures(back.toString("utf8"));
  if (failures.length > 0) {
    throw new Error(`Written entry fails the gate: ${failures.join("; ")}`);
  }

  console.log(`\nWinner (${[...winner.candidate.text].length} chars): ${winner.candidate.text}`);
  console.log(`Wrote and verified ${outPath}`);
}

main();
