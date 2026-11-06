import assert from "node:assert/strict";
import test from "node:test";
import * as store from "../store.js";

class MemoryStorage {
  items = new Map();
  getItem(k) { return this.items.has(k) ? this.items.get(k) : null; }
  setItem(k, v) { this.items.set(k, String(v)); }
}

test("empty data created", () => {
  const mem = new MemoryStorage();
  assert.deepEqual(store.loadData(mem), { lists: [] });
  assert.notEqual(mem.getItem("glosor"), null);
});

test("corrupt data backed up", () => {
  const mem = new MemoryStorage();
  mem.setItem("glosor", "{not json");
  assert.deepEqual(store.loadData(mem), { lists: [] });
  assert.equal(mem.getItem("glosor.bak"), "{not json");
});

test("cleanWords keeps counters", () => {
  const old = [{ sv: "bil", en: "car", correct: 3, wrong: 1 }];
  const words = store.cleanWords([{ sv: " bil ", en: "car" }, { sv: "", en: "x" }, { sv: "hus", en: "house" }], old);
  assert.deepEqual(words, [{ sv: "bil", en: "car", correct: 3, wrong: 1 },
    { sv: "hus", en: "house", correct: 0, wrong: 0 }]);
});

test("save, record, delete", () => {
  const mem = new MemoryStorage();
  let lst = store.saveList(null, "Test", [{ sv: "bil", en: "car" }, { sv: "", en: "x" }], mem);
  assert.equal(lst.words.length, 1);
  store.recordResult({ ...lst.words[0], list_id: lst.id }, true, mem);
  lst = store.saveList(lst.id, "Nytt", [{ sv: "bil", en: "car" }], mem);
  assert.equal(lst.words[0].correct, 1);
  store.deleteList(lst.id, mem);
  assert.equal(store.loadData(mem).lists.length, 0);
});

test("sync keeps counters, drops removed lists and moves own lists out of the way", () => {
  const mem = new MemoryStorage();
  store.syncShared({ lists: [{ id: "djur", name: "Djur", words: [{ sv: "hund", en: "dog" }] },
    { id: "gammal", name: "Gammal", words: [{ sv: "ost", en: "cheese" }] }] }, mem);
  store.recordResult({ sv: "hund", en: "dog", list_id: "djur" }, true, mem);
  const own = store.saveList(null, "Egen", [{ sv: "bil", en: "car" }], mem);
  const ownId = own.id;
  store.syncShared({ lists: [
    { id: "djur", name: "Djuren", words: [{ sv: "hund", en: "dog" }, { sv: "katt", en: "cat" }] },
    { id: ownId, name: "Ny delad", words: [{ sv: "hus", en: "house" }] },
  ] }, mem);
  const lists = store.loadData(mem).lists;
  assert.deepEqual(lists.map(l => [l.name, Boolean(l.shared)]), [["Djuren", true], ["Ny delad", true], ["Egen", false]]);
  assert.deepEqual(lists[0].words.map(w => w.correct), [1, 0]);
  assert.notEqual(lists[2].id, ownId);
  assert.deepEqual(store.exportData(mem).lists.map(l => l.name), ["Egen"]);
});

test("import replaces own lists with the same id, adds new ones and skips shared ones", () => {
  const mem = new MemoryStorage();
  store.syncShared({ lists: [{ id: "djur", name: "Djur", words: [{ sv: "hund", en: "dog" }] }] }, mem);
  store.importData({ lists: [{ id: "mat", name: "Mat", words: [{ sv: "ost", en: "cheese" }] }] }, mem);
  const n = store.importData({ lists: [
    { id: "mat", name: "Maten", words: [{ sv: "bröd", en: "bread", correct: 2, wrong: 1 }] },
    { id: "ny", name: "Ny", words: [{ sv: "bil", en: "car" }] },
    { id: "djur", name: "Kopia", words: [] },
    { name: 5 },
  ] }, mem);
  assert.equal(n, 2);
  const lists = store.loadData(mem).lists;
  assert.deepEqual(lists.map(l => [l.id, l.name]), [["djur", "Djur"], ["mat", "Maten"], ["ny", "Ny"]]);
  assert.equal(lists[1].words[0].correct, 2);
  assert.throws(() => store.importData({ nope: 1 }, mem));
});
