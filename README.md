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

## Tests

```
python3 -m unittest
```

## Windows installer

The GitHub Actions workflow "Build Windows app" (run it manually, or push a tag like `v1.0`)
builds `GlosorSetup.exe`. Download it from the run's artifacts and run it on the Windows
computer. It installs Glosor for the current user (no admin password needed) and adds a
Start menu entry and an optional desktop icon. Word lists are kept in `%APPDATA%\Glosor`
and survive updates and uninstalling.

To build locally on Windows instead, run `build_windows.bat` (needs Python 3.11+ and,
for the installer, [Inno Setup 6](https://jrsoftware.org/isdl.php)).
