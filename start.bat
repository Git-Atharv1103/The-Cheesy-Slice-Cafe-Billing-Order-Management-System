@echo off
echo Starting The Cheesy Slice Cafe Billing System...
echo.

start "Backend - The Cheesy Slice" cmd /k "cd /d %~dp0backend && node src/server.js"
timeout /t 3 /nobreak > nul
start "Frontend - The Cheesy Slice" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend running at: http://localhost:3001
echo Frontend running at: http://localhost:5173
echo.
echo Default login: admin / admin123
pause

