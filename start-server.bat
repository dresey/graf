@echo off
setlocal EnableDelayedExpansion

echo Loading environment from .env...

REM Read .env file and set environment variables
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    REM Skip comments and empty lines
    if not "!line:~0,1!"=="#" if not "!line!"=="" (
        set "%%a=%%b"
    )
)

REM Check if password is set
if not defined TEAM_PASSWORD (
    echo ERROR: TEAM_PASSWORD not found in .env file
    exit /b 1
)

echo Starting server on port %PORT%...
echo.
echo Token for team: %TEAM_PASSWORD%
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js
