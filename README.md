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

## Desktop app

There is also a desktop version built with Tkinter. It shares the same word lists
as the web version. On Debian/Ubuntu Tkinter may need installing first:
`sudo apt install python3-tk`

```
.venv/bin/python glosor_tk.py
```

## Tests

```
.venv/bin/python -m unittest
```

## Windows installer

The GitHub Actions workflow "Build Windows app" (run it manually, or push a tag like `v1.0`)
builds `GlosorSetup.exe`. Download it from the run's artifacts and run it on the Windows
computer. It installs the desktop app for the current user (no admin password needed) and
adds a Start menu entry and an optional desktop icon. Word lists are kept in
`%APPDATA%\Glosor` and survive updates and uninstalling.

To build locally on Windows instead, run `build_windows.bat` (needs Python 3.11+ and,
for the installer, [Inno Setup 6](https://jrsoftware.org/isdl.php)).
