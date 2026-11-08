@echo off
cd /d "%~dp0"
title Naiwa University - Student Info System

set "PY=python"
where python >nul 2>nul
if errorlevel 1 set "PY=py"

echo ================================================
echo   Naiwa University - Student Info System
echo   Site:  http://127.0.0.1:8000/
echo   Admin: http://127.0.0.1:8000/admin.html
echo   Close this window to stop the server.
echo ================================================
echo.

if not defined MYSQL_PASSWORD (
  set /p MYSQL_PASSWORD=MySQL password (Enter = skip MySQL, use SQLite): 
)
if not defined NAIWA_ADMIN_PASSWORD (
  set /p NAIWA_ADMIN_PASSWORD=Admin password (Enter = set it on first admin visit): 
)

"%PY%" -c "import flask" >nul 2>nul
if errorlevel 1 (
  echo Installing dependencies ...
  "%PY%" -m pip install -r requirements.txt
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:8000/'"

"%PY%" backend\app.py

echo.
echo Server stopped.
pause
