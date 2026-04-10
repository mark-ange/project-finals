@echo off
setlocal

set ROOT=%~dp0
if not defined BACKEND_DIR set BACKEND_DIR=%ROOT%..\campus-event-finder-backend

if not exist "%BACKEND_DIR%\package.json" (
  echo Backend folder not found: %BACKEND_DIR%
  echo Set BACKEND_DIR to the backend path, then re-run.
  exit /b 1
)

if not exist "%BACKEND_DIR%\.env" (
  echo Creating default backend .env...
  (
    echo PORT=5000
    echo DB_HOST=127.0.0.1
    echo DB_PORT=3306
    echo DB_USER=root
    echo DB_PASSWORD=
    echo DB_NAME=campus_event_finder
  ) > "%BACKEND_DIR%\.env"
)

start "Backend" cmd /k "cd /d \"%BACKEND_DIR%\" && npm start"
start "Frontend" cmd /k "cd /d \"%ROOT%\" && npm start"
