"""Glosor as a desktop app (Tkinter). Uses the same word lists as the web version."""
import random
import tkinter as tk
import uuid
from tkinter import font as tkfont
from tkinter import messagebox, ttk

import app as store
import quiz

ACCENT = "#2f6fdf"
OK_COLOR = "#1a7f37"
BAD_COLOR = "#c0392b"


# ---------- Data ----------
def load_lists():
    return store.load_data()["lists"]


def save_list(list_id, name, words):
    """Create (list_id=None) or update a list. Returns the saved list."""
    data = store.load_data()
    if list_id is None:
        lst = {"id": uuid.uuid4().hex[:12], "name": name, "words": store.clean_words(words)}
        data["lists"].append(lst)
    else:
        lst = next(l for l in data["lists"] if l["id"] == list_id)
        lst["name"] = name
        lst["words"] = store.clean_words(words, lst["words"])
    store.save_data(data)
    return lst


def delete_list(list_id):
    data = store.load_data()
    data["lists"] = [l for l in data["lists"] if l["id"] != list_id]
    store.save_data(data)


def record_result(word, correct):
    data = store.load_data()
    for lst in data["lists"]:
        if lst["id"] != word["list_id"]:
            continue
        for w in lst["words"]:
            if w["sv"] == word["sv"] and w["en"] == word["en"]:
                w["correct" if correct else "wrong"] += 1
                store.save_data(data)
                return


# ---------- Screens ----------
class Screen(ttk.Frame):
    def __init__(self, app):
        super().__init__(app.body, padding=20)
        self.app = app

    def on_show(self, *args):
        pass


class HomeScreen(Screen):
    def __init__(self, app):
        super().__init__(app)
        ttk.Label(self, text="Välj gloslista", style="H2.TLabel").pack(anchor="w")
        self.choices = ttk.Frame(self)
        self.choices.pack(fill="x", pady=10)
        row = ttk.Frame(self)
        row.pack(anchor="w")
        self.btn_practice = ttk.Button(row, text="Öva", style="Accent.TButton", command=self.practice)
        self.btn_practice.pack(side="left")
        self.btn_edit = ttk.Button(row, text="Redigera", command=self.edit)
        self.btn_edit.pack(side="left", padx=8)
        ttk.Button(row, text="Ny lista", command=lambda: app.show("edit", None)).pack(side="left")
        self.lists, self.vars = [], {}

    def on_show(self, select_id=None):
        prev = {i for i, v in self.vars.items() if v.get()}
        if select_id:
            prev = {select_id}
        self.lists = load_lists()
        if not prev and self.lists:
            prev = {self.lists[0]["id"]}
        for child in self.choices.winfo_children():
            child.destroy()
        self.vars = {}
        for lst in self.lists:
            var = tk.BooleanVar(value=lst["id"] in prev)
            var.trace_add("write", lambda *_: self.update_buttons())
            self.vars[lst["id"]] = var
            ttk.Checkbutton(self.choices, variable=var,
                            text=f"{lst['name']} ({len(lst['words'])} ord)").pack(anchor="w", pady=2)
        self.update_buttons()

    def checked(self):
        return [l for l in self.lists if self.vars[l["id"]].get()]

    def update_buttons(self):
        n = len(self.checked())
        self.btn_practice.state(["!disabled"] if n >= 1 else ["disabled"])
        self.btn_edit.state(["!disabled"] if n == 1 else ["disabled"])

    def edit(self):
        self.app.show("edit", self.checked()[0])

    def practice(self):
        chosen = self.checked()
        words = quiz.combine(chosen)
        if words:
            self.app.show("mode", words)
        elif len(chosen) == 1:
            self.app.show("edit", chosen[0])


class EditScreen(Screen):
    def __init__(self, app):
        super().__init__(app)
        self.title = ttk.Label(self, style="H2.TLabel")
        self.title.pack(anchor="w")
        name_row = ttk.Frame(self)
        name_row.pack(fill="x", pady=(10, 6))
        ttk.Label(name_row, text="Namn:").pack(side="left")
        self.name = ttk.Entry(name_row)
        self.name.pack(side="left", fill="x", expand=True, padx=(8, 0))

        # Scrollable table of word rows.
        wrap = ttk.Frame(self)
        wrap.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(wrap, highlightthickness=0, background=app.bg)
        bar = ttk.Scrollbar(wrap, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=bar.set)
        bar.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)
        self.rows_frame = ttk.Frame(self.canvas)
        self.rows_frame.columnconfigure((0, 1), weight=1)
        ttk.Label(self.rows_frame, text="Svenska").grid(row=0, column=0, sticky="w")
        ttk.Label(self.rows_frame, text="Engelska").grid(row=0, column=1, sticky="w", padx=6)
        win = self.canvas.create_window(0, 0, window=self.rows_frame, anchor="nw")
        self.rows_frame.bind("<Configure>",
                             lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfigure(win, width=e.width))
        for seq in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
            self.canvas.bind_all(seq, self.on_wheel, add="+")

        buttons = ttk.Frame(self)
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(buttons, text="+ Lägg till ord", command=self.add_row_focus).pack(side="left")
        ttk.Button(buttons, text="Spara", style="Accent.TButton", command=self.save).pack(side="left", padx=8)
        ttk.Button(buttons, text="Avbryt", command=lambda: app.show("home")).pack(side="left")
        self.btn_delete = ttk.Button(buttons, text="Ta bort lista", style="Danger.TButton", command=self.delete)
        self.editing, self.rows = None, []

    def on_wheel(self, event):
        if self.app.current is not self:
            return
        step = -1 if event.num == 4 or event.delta > 0 else 1
        self.canvas.yview_scroll(step, "units")

    def on_show(self, lst):
        self.editing = lst
        self.title.configure(text="Redigera lista" if lst else "Ny lista")
        self.name.delete(0, "end")
        self.name.insert(0, lst["name"] if lst else "")
        for row in self.rows:
            for widget in row:
                widget.destroy()
        self.rows, self.next_grid_row = [], 1  # grid row 0 is the header
        for w in (lst["words"] if lst else [{}, {}, {}]):
            self.add_row(w.get("sv", ""), w.get("en", ""))
        if lst:
            self.btn_delete.pack(side="right")
        else:
            self.btn_delete.pack_forget()
        self.canvas.yview_moveto(0)
        self.name.focus_set()

    def add_row(self, sv="", en=""):
        r = self.next_grid_row
        self.next_grid_row += 1
        sv_entry, en_entry = ttk.Entry(self.rows_frame), ttk.Entry(self.rows_frame)
        sv_entry.insert(0, sv)
        en_entry.insert(0, en)
        sv_entry.grid(row=r, column=0, sticky="ew", pady=2)
        en_entry.grid(row=r, column=1, sticky="ew", pady=2, padx=6)
        row = [sv_entry, en_entry]
        remove = ttk.Button(self.rows_frame, text="✕", width=3, command=lambda: self.remove_row(row))
        remove.grid(row=r, column=2, pady=2)
        row.append(remove)
        self.rows.append(row)
        return sv_entry

    def add_row_focus(self):
        entry = self.add_row()
        entry.focus_set()
        self.update_idletasks()
        self.canvas.yview_moveto(1)

    def remove_row(self, row):
        for widget in row:
            widget.destroy()
        self.rows.remove(row)

    def save(self):
        name = self.name.get().strip()[:80]
        if not name:
            self.name.focus_set()
            return
        words = [{"sv": sv.get(), "en": en.get()} for sv, en, _ in self.rows]
        saved = save_list(self.editing["id"] if self.editing else None, name, words)
        self.app.show("home", saved["id"])

    def delete(self):
        if messagebox.askyesno("Ta bort lista", f"Vill du ta bort listan ”{self.editing['name']}”?",
                               parent=self, icon="warning"):
            delete_list(self.editing["id"])
            self.app.show("home")


class ModeScreen(Screen):
    def __init__(self, app):
        super().__init__(app)
        ttk.Label(self, text="Vad vill du öva?", style="H2.TLabel").pack(anchor="w", pady=(0, 10))
        row = ttk.Frame(self)
        row.pack(anchor="w")
        ttk.Button(row, text="Svenska → Engelska", style="Accent.TButton",
                   command=lambda: app.show("quiz", self.words, "sv-en")).pack(side="left")
        ttk.Button(row, text="Engelska → Svenska", style="Accent.TButton",
                   command=lambda: app.show("quiz", self.words, "en-sv")).pack(side="left", padx=8)
        ttk.Button(self, text="Tillbaka", command=lambda: app.show("home")).pack(anchor="w", pady=(16, 0))
        self.words = []

    def on_show(self, words=None):
        if words is not None:
            self.words = words


class QuizScreen(Screen):
    def __init__(self, app):
        super().__init__(app)
        self.progress = ttk.Progressbar(self, maximum=1)
        self.progress.pack(fill="x")
        self.progress_text = ttk.Label(self, style="Hint.TLabel")
        self.progress_text.pack(anchor="w", pady=(4, 12))
        self.prompt = ttk.Label(self, style="Hint.TLabel")
        self.prompt.pack()
        self.word = ttk.Label(self, style="Word.TLabel")
        self.word.pack(pady=10)
        self.answer = ttk.Entry(self, font=app.fonts["big"], justify="center", width=24)
        self.answer.pack()
        self.answer.bind("<Return>", lambda e: self.check())
        self.feedback = ttk.Label(self, wraplength=480, justify="center")
        self.feedback.pack(pady=12)
        row = ttk.Frame(self)
        row.pack()
        self.btn_check = ttk.Button(row, text="Svara", style="Accent.TButton", command=self.check)
        self.btn_reveal = ttk.Button(row, text="Visa svar", command=self.reveal)
        self.btn_next = ttk.Button(row, text="Nästa", style="Accent.TButton", command=self.next_word)
        self.btn_next.bind("<Return>", lambda e: self.next_word())
        ttk.Button(self, text="Avsluta", command=lambda: app.show("home")).pack(pady=(20, 0))
        self.session, self.answered = None, False

    def on_show(self, words, direction):
        self.session = quiz.Session(words, direction)
        self.next_word()

    def next_word(self):
        s = self.session
        if s.current is None:
            self.app.show("summary", s)
            return
        self.answered = False
        self.prompt.configure(text="Vad heter detta på engelska?" if s.direction == "sv-en"
                              else "Vad heter detta på svenska?")
        self.word.configure(text=s.question(s.current.word))
        self.answer.state(["!disabled"])
        self.answer.delete(0, "end")
        self.feedback.configure(text="")
        self.btn_next.pack_forget()
        self.btn_check.pack(side="left")
        self.btn_reveal.pack(side="left", padx=8)
        self.update_progress()
        self.answer.focus_set()

    def update_progress(self):
        s = self.session
        self.progress.configure(value=s.mastered / s.total)
        self.progress_text.configure(text=f"{s.mastered} av {s.total} ord klara")

    def check(self):
        if self.answered:
            self.next_word()
            return
        given = self.answer.get()
        if not given.strip():
            return
        s = self.session
        word = s.current.word
        ok, first = s.check(given)
        if first:
            record_result(word, ok)
        if ok:
            self.show_feedback(random.choice(quiz.CORRECT_MSGS), OK_COLOR)
        else:
            self.show_feedback(f"{random.choice(quiz.WRONG_MSGS)}\nRätt stavning: {s.answer_of(word)}",
                               BAD_COLOR)

    def reveal(self):
        if self.answered:
            return
        s = self.session
        word = s.current.word
        if s.reveal():
            record_result(word, False)
        self.show_feedback(f"{random.choice(quiz.REVEAL_MSGS)}\nSvar: {s.answer_of(word)}", BAD_COLOR)

    def show_feedback(self, text, color):
        self.answered = True
        self.feedback.configure(text=text, foreground=color)
        self.answer.state(["disabled"])
        self.btn_check.pack_forget()
        self.btn_reveal.pack_forget()
        self.btn_next.pack(side="left")
        self.btn_next.focus_set()
        self.update_progress()


class SummaryScreen(Screen):
    def __init__(self, app):
        super().__init__(app)
        ttk.Label(self, text="Bra jobbat! 🎉", style="H2.TLabel").pack(anchor="w")
        self.text = ttk.Label(self, style="Big.TLabel")
        self.text.pack(anchor="w", pady=10)
        self.results = tk.Text(self, height=10, relief="flat", wrap="word", background=app.bg,
                               font=app.fonts["normal"], cursor="arrow")
        self.results.tag_configure("hit", foreground=OK_COLOR)
        self.results.tag_configure("miss", foreground=BAD_COLOR)
        self.results.pack(fill="both", expand=True)
        row = ttk.Frame(self)
        row.pack(anchor="w", pady=(10, 0))
        self.btn_retry = ttk.Button(row, text="Öva på missade ord", style="Accent.TButton",
                                    command=lambda: app.show("quiz", self.session.missed, self.session.direction))
        ttk.Button(row, text="Ny övning", command=lambda: app.show("mode")).pack(side="right")
        self.session = None

    def on_show(self, session):
        self.session = s = session
        self.text.configure(text=f"Du hade {s.hits} av {s.total} rätt på första försöket.")
        self.results.configure(state="normal")
        self.results.delete("1.0", "end")
        for item in s.all:
            q, a = s.question(item.word), s.answer_of(item.word)
            if item.first_try:
                self.results.insert("end", f"✓ {q} – {a}\n", "hit")
            else:
                self.results.insert("end", f"✗ {q} – rätt svar: {a}\n", "miss")
        self.results.configure(state="disabled")
        if s.missed:
            self.btn_retry.pack(side="left", padx=(0, 8))
        else:
            self.btn_retry.pack_forget()


# ---------- App ----------
class GlosorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Glosor")
        self.geometry("640x560")
        self.minsize(480, 420)
        self.bg = "#f5f7fb"
        self.configure(background=self.bg)
        self.setup_style()

        header = tk.Frame(self, background=ACCENT)
        header.pack(fill="x")
        tk.Label(header, text="📚 Glosor", font=self.fonts["h1"], foreground="white",
                 background=ACCENT, padx=20, pady=10).pack(anchor="w")
        self.body = ttk.Frame(self)
        self.body.pack(fill="both", expand=True)

        self.screens = {
            "home": HomeScreen(self), "edit": EditScreen(self), "mode": ModeScreen(self),
            "quiz": QuizScreen(self), "summary": SummaryScreen(self),
        }
        self.current = None
        self.show("home")

    def setup_style(self):
        base = tkfont.nametofont("TkDefaultFont")
        base.configure(size=12)
        tkfont.nametofont("TkTextFont").configure(size=12)
        family = base.actual("family")
        self.fonts = {
            "normal": (family, 12),
            "big": (family, 16),
            "h1": (family, 20, "bold"),
            "h2": (family, 16, "bold"),
            "word": (family, 28, "bold"),
        }
        style = ttk.Style(self)
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure(".", background=self.bg)
        style.configure("TButton", padding=(12, 6))
        style.configure("Accent.TButton", background=ACCENT, foreground="white")
        style.map("Accent.TButton", background=[("disabled", "#9db6e6"), ("active", "#2559b8")])
        style.configure("Danger.TButton", foreground=BAD_COLOR)
        style.configure("H2.TLabel", font=self.fonts["h2"])
        style.configure("Big.TLabel", font=self.fonts["big"])
        style.configure("Word.TLabel", font=self.fonts["word"])
        style.configure("Hint.TLabel", foreground="#5b6475")
        style.configure("TCheckbutton", padding=2)

    def show(self, name, *args):
        if self.current is not None:
            self.current.pack_forget()
        self.current = self.screens[name]
        self.current.on_show(*args)
        self.current.pack(fill="both", expand=True)


if __name__ == "__main__":
    GlosorApp().mainloop()
