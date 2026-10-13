@echo off
rem Build Glosor.exe, GlosorApp.exe and (if Inno Setup 6 is installed) GlosorSetup.exe.
rem Run this on a Windows computer with Python 3.11+ installed.
python -m venv .venv || exit /b 1
call .venv\Scripts\activate.bat
pip install -r requirements.txt pyinstaller || exit /b 1
pyinstaller --onefile --name Glosor --add-data "static;static" app.py || exit /b 1
pyinstaller --onefile --windowed --name GlosorApp glosor_tk.py || exit /b 1
echo.
echo Done: dist\Glosor.exe (web version) and dist\GlosorApp.exe (desktop app)
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ISCC%" (
    "%ISCC%" installer.iss || exit /b 1
    echo Installer: dist\GlosorSetup.exe
) else (
    echo Install Inno Setup 6 from https://jrsoftware.org to also build dist\GlosorSetup.exe
)
