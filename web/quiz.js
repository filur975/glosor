// Quiz logic for Glosor, kept separate from the UI so it can be tested. Mirrors quiz.py.

export const CORRECT_MSGS = ["Bra jobbat! 🎉", "Rätt! Fortsätt så! 🌟", "Precis så! 👏", "Snyggt! 🚀", "Superbra! 😀"];
export const WRONG_MSGS = ["Nästan! Det är bra att du försöker 💪", "Inte riktigt, men du lär dig! 🌱",
  "Ingen fara, du klarar den nästa gång! 😊"];
export const REVEAL_MSGS = ["Här är svaret – du får se det igen strax 👀", "Bra att du kollar! Vi tar det igen senare 🙂"];

export function normalize(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCorrect(given, expected) {
  given = normalize(given);
  if (!given) return false;
  const options = expected.split("/").map(normalize);
  return normalize(expected) === given || options.includes(given);
}

/** Words from several lists; identical word pairs are only asked once. */
export function combine(lists) {
  const seen = new Set(), words = [];
  for (const lst of lists) {
    for (const w of lst.words) {
      const key = JSON.stringify([w.sv, w.en]);
      if (!seen.has(key)) {
        seen.add(key);
        words.push({ ...w, list_id: lst.id });
      }
    }
  }
  return words;
}

export function shuffle(arr, random = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** One practice round. A missed word comes back a few words later. */
export class Session {
  constructor(words, direction, random = Math.random) {
    this.direction = direction; // "sv-en" or "en-sv"
    this.queue = shuffle(words.map(word => ({ word, firstTry: null })), random);
    this.all = this.queue.slice();
    this.total = words.length;
    this.mastered = 0;
  }

  get current() {
    return this.queue[0] ?? null;
  }

  question(word) {
    return this.direction === "sv-en" ? word.sv : word.en;
  }

  answerOf(word) {
    return this.direction === "sv-en" ? word.en : word.sv;
  }

  // True if this was the first attempt (so the result should be recorded).
  #firstAttempt(item, ok) {
    if (item.firstTry !== null) return false;
    item.firstTry = ok;
    return true;
  }

  #requeue(item) {
    this.queue.shift();
    this.queue.splice(Math.min(this.queue.length, 3), 0, item);
  }

  /** Returns [correct, firstAttempt] for the current word. */
  check(given) {
    const item = this.current;
    const ok = isCorrect(given, this.answerOf(item.word));
    const first = this.#firstAttempt(item, ok);
    if (ok) {
      this.queue.shift();
      this.mastered++;
    } else {
      this.#requeue(item);
    }
    return [ok, first];
  }

  /** Gives up on the current word. Returns firstAttempt. */
  reveal() {
    const item = this.current;
    const first = this.#firstAttempt(item, false);
    this.#requeue(item);
    return first;
  }

  get hits() {
    return this.all.filter(i => i.firstTry).length;
  }

  get missed() {
    return this.all.filter(i => !i.firstTry).map(i => i.word);
  }
}
