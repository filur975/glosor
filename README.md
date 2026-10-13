# Glosor

A small app for practising English vocabulary. The interface is in Swedish.

## Setup (once)

On Debian/Ubuntu the venv module may need installing first: `sudo apt install python3.11-venv`

```
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run

```
.venv/bin/python app.py
```

Open http://127.0.0.1:8000 in a browser. Word lists are stored in `data/lists.json`
(created on first run with an example list) and can be edited in the app.

## Tests

```
.venv/bin/python -m unittest
```
