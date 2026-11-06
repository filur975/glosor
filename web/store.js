// Word-list storage for Glosor in the browser. Same JSON shape as the desktop app's lists.json,
// so lists can be exported from one and imported into the other.
// Two kinds of lists: shared ones (shared: true) come from glosor.json on the server and can't be
// edited here, and the person's own ones, which they created or imported.

const KEY = "glosor";

export function isValid(data) {
  return data !== null && typeof data === "object" && Array.isArray(data.lists);
}

export function loadData(storage = localStorage) {
  const raw = storage.getItem(KEY);
  if (raw !== null) {
    try {
      const data = JSON.parse(raw);
      if (isValid(data)) return data;
    } catch { /* fall through */ }
    // Corrupt data: keep a backup and start fresh.
    storage.setItem(KEY + ".bak", raw);
  }
  const data = { lists: [] };
  saveData(data, storage);
  return data;
}

export function saveData(data, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(data));
}

/** Drop empty rows and keep the counters of words that didn't change. */
export function cleanWords(raw, existing = []) {
  const old = new Map(existing.map(w => [JSON.stringify([w.sv, w.en]), w]));
  const words = [];
  for (const item of raw) {
    const sv = String(item.sv ?? "").trim();
    const en = String(item.en ?? "").trim();
    if (!sv || !en) continue;
    const prev = old.get(JSON.stringify([sv, en])) ?? {};
    words.push({ sv, en, correct: Number(prev.correct) || 0, wrong: Number(prev.wrong) || 0 });
  }
  return words;
}

function newId() {
  // Not crypto.randomUUID: that only exists on https pages.
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/** Create (listId=null) or update a list. Returns the saved list. */
export function saveList(listId, name, words, storage = localStorage) {
  const data = loadData(storage);
  let lst;
  if (listId === null) {
    lst = { id: newId(), name, words: cleanWords(words) };
    data.lists.push(lst);
  } else {
    lst = data.lists.find(l => l.id === listId);
    lst.name = name;
    lst.words = cleanWords(words, lst.words);
  }
  saveData(data, storage);
  return lst;
}

export function deleteList(listId, storage = localStorage) {
  const data = loadData(storage);
  data.lists = data.lists.filter(l => l.id !== listId);
  saveData(data, storage);
}

export function recordResult(word, correct, storage = localStorage) {
  const data = loadData(storage);
  const lst = data.lists.find(l => l.id === word.list_id);
  const w = lst?.words.find(w => w.sv === word.sv && w.en === word.en);
  if (w) {
    w[correct ? "correct" : "wrong"]++;
    saveData(data, storage);
  }
}

/** Brings the shared lists up to date with the server's file, keeping this device's counters. */
export function syncShared(server, storage = localStorage) {
  if (!isValid(server)) throw new Error("bad structure");
  const data = loadData(storage);
  const local = new Map(data.lists.filter(l => l.shared).map(l => [l.id, l]));
  const shared = [];
  for (const lst of server.lists) {
    if (!lst || typeof lst.name !== "string" || !Array.isArray(lst.words)) continue;
    const id = String(lst.id);
    if (shared.some(l => l.id === id)) continue;
    shared.push({ id, name: lst.name, words: cleanWords(lst.words, local.get(id)?.words), shared: true });
  }
  const ids = new Set(shared.map(l => l.id));
  const own = data.lists.filter(l => !l.shared);
  for (const lst of own) {
    if (ids.has(lst.id)) lst.id = newId(); // a new shared list took this id
  }
  data.lists = [...shared, ...own];
  saveData(data, storage);
}

/** The person's own lists, in the same format as the desktop app's lists.json. */
export function exportData(storage = localStorage) {
  return { lists: loadData(storage).lists.filter(l => !l.shared) };
}

/** Adds the lists from an exported file. An own list with the same id is replaced; lists that are
 * already shared are skipped. Returns how many were added. */
export function importData(imported, storage = localStorage) {
  if (!isValid(imported)) throw new Error("bad structure");
  const data = loadData(storage);
  const sharedIds = new Set(data.lists.filter(l => l.shared).map(l => l.id));
  let count = 0;
  for (const lst of imported.lists) {
    if (!lst || typeof lst.name !== "string" || !Array.isArray(lst.words)) continue;
    if (sharedIds.has(String(lst.id))) continue;
    const clean = { id: String(lst.id || newId()), name: lst.name.trim().slice(0, 80) || "Namnlös lista",
      words: cleanWords(lst.words, lst.words) };
    const i = data.lists.findIndex(l => l.id === clean.id);
    if (i >= 0) data.lists[i] = clean;
    else data.lists.push(clean);
    count++;
  }
  saveData(data, storage);
  return count;
}
