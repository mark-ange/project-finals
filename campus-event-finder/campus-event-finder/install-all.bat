@echo off
setlocal

set ROOT=%~dp0
if not defined BACKEND_DIR set BACKEND_DIR=%ROOT%..\campus-event-finder-backend

if not exist "%BACKEND_DIR%\package.json" (
  echo Backend folder not found: %BACKEND_DIR%
  echo Set BACKEND_DIR to the backend path, then re-run.
  exit /b 1
)

echo Installing backend dependencies...
pushd "%BACKEND_DIR%"
npm install
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo Installing frontend dependencies...
pushd "%ROOT%"
npm install
if errorlevel 1 (
  popd
  exit /b 1
)
popd

echo Done.
