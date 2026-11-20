@echo off
echo ========================================================
echo   Real-Time Collaborative Code Editor - Startup
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/2] Checking Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running or not in PATH!
    echo Please make sure Docker Desktop is running.
    pause
    exit /b 1
)

echo [2/2] Starting server and client with Docker Compose...
docker compose up -d --build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   COLLABORATIVE CODE EDITOR IS RUNNING!
    echo ========================================================
    echo   Editor Web UI:     http://localhost:5173
    echo   Server API:        http://localhost:4000/api/health
    echo ========================================================
    echo.
    echo Opening Editor in browser...
    start http://localhost:5173
) else (
    echo.
    echo [ERROR] Startup failed.
)

pause
