@echo off
rem Build Glosor.exe. Run this on a Windows computer with Python 3.11+ installed.
python -m venv .venv || exit /b 1
call .venv\Scripts\activate.bat
pip install -r requirements.txt pyinstaller || exit /b 1
pyinstaller --onefile --name Glosor --add-data "static;static" app.py || exit /b 1
echo.
echo Done: dist\Glosor.exe
