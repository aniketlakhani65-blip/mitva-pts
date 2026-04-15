@echo off
REM =============================================================================
REM Mitva PTS — one-click setup + run (Windows)
REM Double-click this file from inside the project folder.
REM =============================================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   Mitva PTS - Setup and Run
echo ============================================================
echo.

REM --- Check Node is installed -------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo Download it from https://nodejs.org and install the LTS version.
    pause
    exit /b 1
)

echo [1/4] Installing dependencies (this takes a few minutes the first time)...
call npm install
if errorlevel 1 goto :fail

REM --- Run migrations only if the DB file doesn't exist yet --------------------
if not exist "prisma\dev.db" (
    echo.
    echo [2/4] Creating the local SQLite database...
    call npx prisma migrate dev --name init
    if errorlevel 1 goto :fail

    echo.
    echo [3/4] Loading seed data (admin user, stages, sample orders)...
    call npm run db:seed
    if errorlevel 1 goto :fail
) else (
    echo.
    echo [2/4] Database already exists - skipping migrate.
    echo [3/4] Skipping seed (already loaded).
)

echo.
echo ============================================================
echo   [4/4] Starting the app on http://localhost:3000
echo.
echo   Log in with:
echo     Email:    admin@mitva.local
echo     Password: admin123
echo.
echo   Press Ctrl+C in this window to stop the server.
echo ============================================================
echo.

REM Open the browser after a short delay, in the background
start "" /b cmd /c "timeout /t 6 >nul && start http://localhost:3000"

call npm run dev
goto :eof

:fail
echo.
echo [ERROR] A step failed. Scroll up and look for the red error message.
echo Copy it and share it for help.
pause
exit /b 1
