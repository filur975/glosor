"""Glosor – a small vocabulary trainer with a Swedish interface."""
import json
import os
import re
import shutil
import tempfile
import threading
import uuid

from flask import Flask, abort, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "lists.json")

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "static"), static_url_path="/static")
_lock = threading.Lock()

EXAMPLE_DATA = {
    "lists": [
        {
            "id": "exempel",
            "name": "Exempellista: Djur",
            "words": [
                {"sv": "hund", "en": "dog", "correct": 0, "wrong": 0},
                {"sv": "katt", "en": "cat", "correct": 0, "wrong": 0},
                {"sv": "häst", "en": "horse", "correct": 0, "wrong": 0},
                {"sv": "fisk", "en": "fish", "correct": 0, "wrong": 0},
                {"sv": "fågel", "en": "bird", "correct": 0, "wrong": 0},
                {"sv": "ko", "en": "cow", "correct": 0, "wrong": 0},
            ],
        }
    ]
}


def load_data():
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or not isinstance(data.get("lists"), list):
            raise ValueError("bad structure")
        return data
    except FileNotFoundError:
        pass
    except (ValueError, OSError):
        # Corrupt file: keep a backup and start fresh.
        try:
            shutil.copy(DATA_FILE, DATA_FILE + ".bak")
        except OSError:
            pass
    data = json.loads(json.dumps(EXAMPLE_DATA))
    save_data(data)
    return data


def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(DATA_FILE), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)


def clean_words(raw, existing=None):
    """Validate a word list from the client; keep counters of unchanged words."""
    if not isinstance(raw, list):
        abort(400, "words must be a list")
    old = {(w["sv"], w["en"]): w for w in (existing or [])}
    words = []
    for item in raw:
        if not isinstance(item, dict):
            abort(400, "bad word")
        sv = str(item.get("sv", "")).strip()
        en = str(item.get("en", "")).strip()
        if not sv or not en:
            continue
        prev = old.get((sv, en), {})
        words.append({"sv": sv, "en": en,
                      "correct": int(prev.get("correct", 0)),
                      "wrong": int(prev.get("wrong", 0))})
    return words


def clean_name(raw):
    name = str(raw or "").strip()[:80]
    if not name:
        abort(400, "name required")
    return name


def find_list(data, list_id):
    for lst in data["lists"]:
        if lst["id"] == list_id:
            return lst
    abort(404)


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/lists")
def get_lists():
    with _lock:
        return jsonify(load_data()["lists"])


@app.post("/api/lists")
def create_list():
    body = request.get_json(silent=True) or {}
    with _lock:
        data = load_data()
        lst = {"id": uuid.uuid4().hex[:12], "name": clean_name(body.get("name")),
               "words": clean_words(body.get("words", []))}
        data["lists"].append(lst)
        save_data(data)
        return jsonify(lst), 201


@app.put("/api/lists/<list_id>")
def update_list(list_id):
    body = request.get_json(silent=True) or {}
    with _lock:
        data = load_data()
        lst = find_list(data, list_id)
        lst["name"] = clean_name(body.get("name"))
        lst["words"] = clean_words(body.get("words", []), lst["words"])
        save_data(data)
        return jsonify(lst)


@app.delete("/api/lists/<list_id>")
def delete_list(list_id):
    with _lock:
        data = load_data()
        find_list(data, list_id)
        data["lists"] = [l for l in data["lists"] if l["id"] != list_id]
        save_data(data)
        return "", 204


@app.post("/api/lists/<list_id>/result")
def record_result(list_id):
    """Record a first-attempt result for one word."""
    body = request.get_json(silent=True) or {}
    sv, en = body.get("sv"), body.get("en")
    correct = body.get("correct")
    if not isinstance(correct, bool):
        abort(400)
    with _lock:
        data = load_data()
        lst = find_list(data, list_id)
        for w in lst["words"]:
            if w["sv"] == sv and w["en"] == en:
                w["correct" if correct else "wrong"] += 1
                save_data(data)
                return jsonify(w)
    abort(404)


if __name__ == "__main__":
    load_data()  # create example data on first run
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 8000)))
