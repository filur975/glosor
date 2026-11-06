// Glosor: a vocabulary trainer for Swedish and English, as a web app. Same screens as glosor_tk.py.
import * as quiz from "./quiz.js";
import * as store from "./store.js";

const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.3l2.9 2.9 6.1-6.4" fill="none" ' +
  'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------- Navigation ----------
// Screens enter along the direction you travel: deeper from the right, back from the left.
// Leaving the list screen adds one history entry, so the phone's back gesture returns to the lists.
let current = null, skipPop = false;

function show(name, ...args) {
  const screen = $(name);
  const prev = current;
  if (prev) prev.hidden = true;
  current = screen;
  screens[name].onShow?.(...args);
  screen.hidden = false;
  screen.classList.remove("enter", "back");
  if (prev) {
    void screen.offsetWidth; // restart the animation
    screen.classList.add("enter");
    screen.classList.toggle("back", Number(screen.dataset.depth) < Number(prev.dataset.depth));
  }
  window.scrollTo(0, 0);
  screens[name].focus?.();

  const inner = history.state?.inner;
  if (name !== "home" && !inner) history.pushState({ inner: true }, "");
  else if (name === "home" && inner) {
    skipPop = true;
    history.back();
  }
}

addEventListener("popstate", () => {
  if (skipPop) skipPop = false;
  else if (current?.id !== "home") show("home");
});

document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => show(b.dataset.go)));

// ---------- Lists ----------
const home = {
  lists: [],
  selected: new Set(),

  onShow(selectId) {
    this.lists = store.loadData().lists;
    const ids = new Set(this.lists.map(l => l.id));
    let sel = selectId ? new Set([selectId]) : this.selected;
    sel = new Set([...sel].filter(id => ids.has(id)));
    if (!sel.size && this.lists.length) sel.add(this.lists[0].id);
    this.selected = sel;
    this.render();
  },

  render() {
    const ul = $("choices");
    ul.replaceChildren();
    if (!this.lists.length) {
      ul.append(el("li", { className: "empty", textContent: "Inga listor än – skapa en med ”Ny lista”." }));
    }
    // Headings only when there are both kinds of lists.
    const heading = text => el("li", { className: "caption group", role: "presentation", textContent: text });
    const mixed = this.lists.some(l => l.shared) && this.lists.some(l => !l.shared);
    this.lists.forEach((lst, i) => {
      if (mixed && i === 0) ul.append(heading("Listor"));
      if (mixed && !lst.shared && this.lists[i - 1]?.shared) ul.append(heading("Mina listor"));
      const check = el("span", { className: "check", innerHTML: CHECK_SVG });
      const li = el("li", { className: "choice", tabIndex: i === 0 ? 0 : -1, role: "option" }, check,
        el("span", { className: "choice-name", textContent: lst.name }),
        el("span", { className: "choice-count", textContent: `${lst.words.length} ord` }));
      li.setAttribute("aria-selected", this.selected.has(lst.id));
      li.dataset.id = lst.id;
      ul.append(li);
    });
    this.updateButtons();
  },

  toggle(li) {
    const id = li.dataset.id;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    li.setAttribute("aria-selected", this.selected.has(id));
    this.updateButtons();
  },

  checked() {
    return this.lists.filter(l => this.selected.has(l.id));
  },

  updateButtons() {
    const checked = this.checked();
    $("btn-practice").disabled = checked.length < 1;
    // Shared lists come from the server, so they can't be changed here.
    $("btn-edit").disabled = checked.length !== 1 || Boolean(checked[0].shared);
  },

  practice() {
    const chosen = this.checked();
    const words = quiz.combine(chosen);
    if (words.length) show("mode", words);
    else if (chosen.length === 1) show("edit", chosen[0]);
  },

  toast(text) {
    $("toast").textContent = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => ($("toast").textContent = ""), 4000);
  },

  async exportLists() {
    const data = store.exportData();
    if (!data.lists.length) {
      this.toast("Du har inga egna listor att exportera.");
      return;
    }
    const json = JSON.stringify(data, null, 2);
    const file = new File([json], "glosor.json", { type: "application/json" });
    // On phones the share sheet is the natural way to save or send a file.
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Glosor" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    const a = el("a", { href: URL.createObjectURL(file), download: file.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  async importLists(file) {
    try {
      const n = store.importData(JSON.parse(await file.text()));
      this.onShow();
      this.toast(n === 1 ? "1 lista importerad." : `${n} listor importerade.`);
    } catch {
      this.toast("Filen kunde inte läsas. Välj en fil som exporterats från Glosor.");
    }
  },
};

$("choices").addEventListener("click", e => {
  const li = e.target.closest(".choice");
  if (li) {
    li.focus();
    home.toggle(li);
  }
});
$("choices").addEventListener("keydown", e => {
  const li = e.target.closest(".choice");
  if (!li) return;
  if (e.key === " ") home.toggle(li);
  else if (e.key === "Enter") home.practice();
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const items = [...$("choices").querySelectorAll(".choice")];
    const next = items[items.indexOf(li) + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      li.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  } else return;
  e.preventDefault();
});
$("btn-practice").addEventListener("click", () => home.practice());
$("btn-edit").addEventListener("click", () => !$("btn-edit").disabled && show("edit", home.checked()[0]));
$("btn-new").addEventListener("click", () => show("edit", null));
$("btn-export").addEventListener("click", () => home.exportLists());
$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", e => {
  if (e.target.files[0]) home.importLists(e.target.files[0]);
  e.target.value = "";
});

// ---------- Edit a list ----------
const edit = {
  editing: null,

  onShow(lst) {
    this.editing = lst;
    $("edit-title").textContent = lst ? "Redigera lista" : "Ny lista";
    $("list-name").value = lst ? lst.name : "";
    this.setNameError(false);
    $("words").replaceChildren();
    for (const w of lst ? lst.words : [{}, {}, {}]) this.addRow(w.sv ?? "", w.en ?? "");
    $("btn-delete").hidden = !lst;
  },

  focus() {
    // On phones, opening the keyboard straight away hides most of the screen.
    if (!matchMedia("(pointer: coarse)").matches) $("list-name").focus();
  },

  setNameError(on) {
    $("list-name").classList.toggle("invalid", on);
    $("name-error").hidden = !on;
  },

  addRow(sv = "", en = "") {
    const field = (value, lang, label) => el("input", { className: "field", value, lang, autocomplete: "off",
      autocapitalize: "off", ariaLabel: label });
    const svIn = field(sv, "sv", "Svenska"), enIn = field(en, "en", "Engelska");
    const row = el("div", { className: "word-row" }, svIn, enIn);
    row.append(el("button", { className: "icon", type: "button", textContent: "✕", tabIndex: -1,
      ariaLabel: "Ta bort ord", onclick: () => row.remove() }));
    $("words").append(row);
    return svIn;
  },

  save() {
    const name = $("list-name").value.trim().slice(0, 80);
    if (!name) {
      this.setNameError(true);
      $("list-name").focus();
      return;
    }
    const words = [...$("words").children].map(r => {
      const [sv, en] = r.querySelectorAll("input");
      return { sv: sv.value, en: en.value };
    });
    const saved = store.saveList(this.editing ? this.editing.id : null, name, words);
    show("home", saved.id);
  },

  delete() {
    // Deleting can't be undone, so this is the one place that asks first.
    if (confirm(`Vill du ta bort listan ”${this.editing.name}”?`)) {
      store.deleteList(this.editing.id);
      show("home");
    }
  },
};

$("list-name").addEventListener("input", () => edit.setNameError(false));
$("list-name").addEventListener("keydown", e => {
  if (e.key === "Enter") $("words").querySelector("input")?.focus();
});
$("btn-add-word").addEventListener("click", () => {
  const input = edit.addRow();
  input.scrollIntoView({ block: "nearest", behavior: "smooth" });
  input.focus();
});
$("btn-save").addEventListener("click", () => edit.save());
$("btn-cancel").addEventListener("click", () => show("home"));
$("btn-delete").addEventListener("click", () => edit.delete());

// ---------- Choose direction ----------
const mode = {
  words: [],
  onShow(words) {
    if (words) this.words = words;
  },
  focus() {
    current.querySelector("button").focus();
  },
};

document.querySelectorAll("[data-direction]").forEach(b =>
  b.addEventListener("click", () => show("quiz", mode.words, b.dataset.direction)));

// ---------- Quiz ----------
const quizScreen = {
  session: null,
  answered: false,

  onShow(words, direction) {
    this.session = new quiz.Session(words, direction);
    $("progress-fill").style.transition = "none";
    this.next();
    void $("progress-fill").offsetWidth;
    $("progress-fill").style.transition = "";
  },

  focus() {
    $("answer").focus();
  },

  next() {
    const s = this.session;
    if (!s.current) {
      show("summary", s);
      return;
    }
    this.answered = false;
    const toEnglish = s.direction === "sv-en";
    $("prompt").textContent = toEnglish ? "Vad heter detta på engelska?" : "Vad heter detta på svenska?";
    $("word").textContent = s.question(s.current.word);
    $("word").lang = toEnglish ? "sv" : "en";
    $("answer").lang = toEnglish ? "en" : "sv";
    $("answer").readOnly = false;
    $("answer").value = "";
    this.feedback();
    $("btn-check").hidden = false;
    $("btn-next").hidden = true;
    this.updateProgress();
    $("answer").focus();
  },

  updateProgress() {
    const s = this.session;
    $("progress-fill").style.width = `${(100 * s.mastered) / s.total}%`;
    $("progress-text").textContent = `${s.mastered} av ${s.total} ord klara`;
  },

  check() {
    if (this.answered) {
      this.next();
      return;
    }
    const given = $("answer").value;
    if (!given.trim()) return;
    const s = this.session, word = s.current.word;
    const [ok, first] = s.check(given);
    if (first) store.recordResult(word, ok);
    if (ok) this.afterAnswer("ok", pick(quiz.CORRECT_MSGS));
    else {
      this.afterAnswer("bad", pick(quiz.WRONG_MSGS), `Rätt stavning: ${s.answerOf(word)}`);
      this.shake();
    }
  },

  afterAnswer(kind, message, answer = "") {
    this.answered = true;
    this.feedback(kind, message, answer);
    // Read-only rather than disabled, so the phone keyboard stays up and Enter goes to the next word.
    $("answer").readOnly = true;
    $("btn-check").hidden = true;
    $("btn-next").hidden = false;
    if (!matchMedia("(pointer: coarse)").matches) $("btn-next").focus();
    this.updateProgress();
  },

  feedback(kind, message, answer) {
    const box = $("feedback");
    box.className = "feedback";
    box.replaceChildren();
    if (!kind) return;
    box.append(el("span", { className: "lead", textContent: message }));
    if (answer) box.append(el("span", { className: "answer", textContent: answer }));
    void box.offsetWidth;
    box.classList.add(kind, "show");
  },

  shake() {
    // A short, damped side-to-side shake of the answer field, like a wrong password on a Mac.
    const input = $("answer");
    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
  },
};

$("answer-form").addEventListener("submit", e => {
  e.preventDefault();
  quizScreen.check();
});
$("btn-next").addEventListener("click", () => quizScreen.next());

// ---------- Summary ----------
const summary = {
  session: null,

  onShow(s) {
    this.session = s;
    $("score").textContent = `${s.hits} av ${s.total}`;
    $("results").replaceChildren(...s.all.map(item => {
      const ok = Boolean(item.firstTry);
      const text = el("span", { className: "text" }, `${s.question(item.word)} – `);
      text.append(ok ? s.answerOf(item.word) : el("b", { textContent: `rätt svar: ${s.answerOf(item.word)}` }));
      return el("li", {}, el("span", { className: `mark ${ok ? "ok" : "bad"}`, textContent: ok ? "✓" : "✗",
        ariaLabel: ok ? "Rätt" : "Fel" }), text);
    }));
    const missed = s.missed.length > 0;
    $("btn-retry").hidden = !missed;
    $("summary-buttons").classList.toggle("single", !missed);
  },

  focus() {
    ($("btn-retry").hidden ? $("btn-again") : $("btn-retry")).focus();
  },
};

$("btn-retry").addEventListener("click", () =>
  show("quiz", summary.session.missed, summary.session.direction));
$("btn-again").addEventListener("click", () => show("mode"));

// ---------- Start ----------
const screens = { home, edit, mode, quiz: quizScreen, summary };
show("home");
syncShared();

/** Fetches the shared lists. Offline, the copy from the last visit is used. */
async function syncShared() {
  try {
    const response = await fetch("glosor.json", { cache: "no-cache" });
    if (!response.ok) return;
    store.syncShared(await response.json());
  } catch {
    return;
  }
  if (current?.id === "home") home.onShow();
}

// Ask the browser not to clear the word lists when the device runs low on space.
navigator.storage?.persist?.();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
