@echo off
REM =============================================================================
REM Mitva PTS — stop the running server
REM Kills anything listening on port 3000.
REM =============================================================================

echo Stopping Mitva PTS...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing process %%a on port 3000
    taskkill /PID %%a /F >nul 2>nul
)

REM Also kill any stray node processes spawned by npm run dev
taskkill /IM node.exe /F >nul 2>nul

echo Done.
timeout /t 2 >nul
