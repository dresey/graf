@echo off
setlocal enabledelayedexpansion

echo Loading environment from .env...
for /f "usebackq tokens=*" %%a in (".env") do (
  set "line=%%a"
  if not "!line:~0,1!"=="#" (
    if not "!line!"=="" (
      for /f "tokens=1,* delims==" %%b in ("%%a") do (
        set "%%b=%%c"
      )
    )
  )
)

echo.
echo ========================================
echo Starting PUBLIC server with Tailscale Funnel
echo ========================================
echo.
echo 1. Resetting Tailscale Funnel...
"C:\Program Files\Tailscale\tailscale.exe" funnel reset

echo.
echo 2. Starting Tailscale Funnel on port 3000...
start "Tailscale Funnel" cmd /c ""C:\Program Files\Tailscale\tailscale.exe" funnel 3000"

timeout /t 3 /nobreak >nul

echo.
echo 3. Starting API server on port 3000...
echo.
echo Public URL: https://dresee.tail7ee3bb.ts.net
echo Token for team: %TEAM_PASSWORD%
echo.
echo Press Ctrl+C to stop the server (Funnel will continue running)
echo.

node server.js

echo.
echo Server stopped.
echo Tailscale Funnel is still running.
echo To stop it: "C:\Program Files\Tailscale\tailscale.exe" funnel reset
