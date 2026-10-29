@echo off
title SPECTRA - Crypto Tracing Lab
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Telechargez-le sur https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Premiere installation des dependances...
  call npm install
)
echo Demarrage de SPECTRA sur http://localhost:5173
start "" http://localhost:5173
call npm run dev
