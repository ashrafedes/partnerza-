@echo off
title Partnerza Servers - Auto Restart
color 0A

echo ==========================================
echo       Partnerza Webapp Launcher
echo ==========================================
echo.
echo This will keep both servers running
echo Press Ctrl+C in each window to stop
echo.

:: Create logs directory if not exists
if not exist logs mkdir logs

echo Starting Backend Server...
start "Backend Server" cmd /k "cd /d c:\My projects\Partnerza\backend && node index.js"

timeout /t 2 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d c:\My projects\Partnerza\frontend && npm run dev"

echo.
echo ==========================================
echo       Servers are starting...
echo ==========================================
echo.
echo Frontend: http://localhost:3001
echo Backend:  http://localhost:5000
echo.
echo Windows opened:
echo - Backend Server window
echo - Frontend Server window
echo.
echo Both servers will keep running
echo Close this window anytime - servers stay running
echo.
echo To restart servers:
echo 1. Close both server windows
echo 2. Run this file again
echo.

timeout /t 5 /nobreak > nul

exit
