# Glosor

A small desktop app for practising English vocabulary. The interface is in Swedish.
It uses only the Python standard library (Tkinter), so there is nothing to `pip install`.

## Run

Needs Python 3.11+ with Tkinter. On Debian/Ubuntu Tkinter may need installing first:
`sudo apt install python3-tk`

```
python3 glosor_tk.py
```

Word lists are stored in `data/lists.json` (created on first run with an example list)
and can be edited in the app.

## Web app (phones, tablets, any computer)

`web/` holds the same app as an installable web app (PWA) that also works offline.
It is plain HTML/CSS/JavaScript with no build step.

Try it locally:

```
cd web && python3 -m http.server 8000
```

then open http://localhost:8000.

The workflow "Publish web app" publishes `web/` to GitHub Pages on every push to `master` that
changes it. Turn it on once under Settings → Pages → Source: "GitHub Actions". The app is then at
`https://<user>.github.io/glosor/`. To install it, open that address and choose
"Lägg till på hemskärmen" (Safari: Share button) or "Installera" (Chrome/Edge).

The word lists everyone gets are in `web/glosor.json`. Edit that file and push: the app fetches it
each time it starts, so everyone gets the new words, and each device keeps its own progress
on them. These shared lists can't be edited in the app.

People can also add their own lists with "Ny lista" or "Importera listor". These are kept in the
browser on that device until they are deleted. "Exportera listor" saves them to a file, to
move them to another device. The file has the same format as the desktop app's `lists.json`.

## Tests

```
python3 -m unittest
node --test web/test/    # web app
```

## Windows installer

The GitHub Actions workflow "Build Windows app" (run it manually, or push a tag like `v1.0`)
builds `GlosorSetup.exe`. Download it from the run's artifacts and run it on the Windows
computer. It installs Glosor for the current user (no admin password needed) and adds a
Start menu entry and an optional desktop icon. Word lists are kept in `%APPDATA%\Glosor`
and survive updates and uninstalling.

To build locally on Windows instead, run `build_windows.bat` (needs Python 3.11+ and,
for the installer, [Inno Setup 6](https://jrsoftware.org/isdl.php)).
