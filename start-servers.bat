@echo off
echo Restarting Partnerza Servers...
echo.

echo Stopping any process using port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Stopping any Node processes from previous runs...
taskkill /F /IM node.exe >nul 2>&1

timeout /t 2 >nul

echo.
echo Starting Backend Server...
cd /d "c:\My projects\Partnerza\backend"
start "Backend Server" cmd /k "node index.js"

echo.
echo Starting Frontend Server...
cd /d "c:\My projects\Partnerza\frontend"
start "Frontend Server" cmd /k "npm run dev"

echo.
echo Servers restarted successfully.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3001
echo.
pause