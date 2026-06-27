@echo off
title ColorLab Server
echo ========================================
echo     ColorLab - Local Server + Tunnel
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Starting HTTP server on port 3000...
start "ColorLab-Server" /MIN cmd /c "npx serve C:\Users\Administrator\Projects\colorlab -l 3000 --no-clipboard"

echo [2/2] Creating HTTPS tunnel...
echo.
echo The tunnel URL will appear below.
echo Open it in Safari on iPhone, then:
echo   Tap Share ^> Add to Home Screen
echo.
echo Press Ctrl+C to stop.
echo ========================================

npx localtunnel --port 3000 --print-requests
