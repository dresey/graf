@echo off
echo Starting static file server on http://localhost:8080
echo Open http://localhost:8080 in your browser
echo.
echo Press Ctrl+C to stop
echo.

REM Simple HTTP server using Python (usually pre-installed on Windows 10+)
python -m http.server 8080 2>nul
if errorlevel 1 (
    echo Python not found. Trying Node.js http-server...
    npx --yes http-server -p 8080 -c-1
)
