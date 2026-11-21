@echo off
title DeepAI Code RTL & Persian Patch Installer
cd /d "%~dp0\.."
echo ========================================================
echo       DeepAI Code Persian ^& RTL Enhancer Installer
echo ========================================================
echo.
node src\patcher.js patch
echo.
pause
