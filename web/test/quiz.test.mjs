import assert from "node:assert/strict";
import test from "node:test";
import * as quiz from "../quiz.js";

// Deterministic stand-in for Math.random.
function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

test("isCorrect", () => {
  assert.ok(quiz.isCorrect("  Strawberry   JAM ", "strawberry jam"));
  assert.ok(quiz.isCorrect("film", "film/movie"));
  assert.ok(!quiz.isCorrect("", "dog"));
  assert.ok(!quiz.isCorrect("cat", "dog"));
});

test("combine skips duplicates", () => {
  const words = quiz.combine([
    { id: "a", words: [{ sv: "hund", en: "dog" }] },
    { id: "b", words: [{ sv: "hund", en: "dog" }, { sv: "katt", en: "cat" }] },
  ]);
  assert.deepEqual(words.map(w => [w.sv, w.list_id]), [["hund", "a"], ["katt", "b"]]);
});

test("session flow", () => {
  const s = new quiz.Session([{ sv: "hund", en: "dog" }, { sv: "katt", en: "cat" }], "sv-en", seeded(1));
  const first = s.current.word;
  assert.deepEqual(s.check("wrong"), [false, true]);
  assert.notEqual(s.current.word, first); // missed word moved back
  assert.deepEqual(s.check(s.answerOf(s.current.word)), [true, true]);
  assert.equal(s.current.word, first);
  assert.deepEqual(s.check(s.answerOf(first)), [true, false]); // retry doesn't count
  assert.equal(s.current, null);
  assert.deepEqual([s.mastered, s.hits, s.missed], [2, 1, [first]]);
});

test("reveal counts as a miss", () => {
  const s = new quiz.Session([{ sv: "hund", en: "dog" }], "en-sv");
  assert.equal(s.question(s.current.word), "dog");
  assert.ok(s.reveal());
  assert.deepEqual(s.check("hund"), [true, false]);
  assert.equal(s.hits, 0);
});
