@echo off
cd /d "%~dp0"
title Initialize MySQL Database

set "PY=python"
where python >nul 2>nul
if errorlevel 1 set "PY=py"

echo ================================================
echo   Create database "naiwa" and import 515 records
echo   You will be asked for the MySQL password.
echo ================================================
echo.

"%PY%" tools\init_db.py --ask-password

echo.
pause
