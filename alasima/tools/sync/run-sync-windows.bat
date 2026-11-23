@echo off
rem Keeps the app in step with the sales system. Fill in sparat_sync.ini first (copy sparat_sync.example.ini).
cd /d "%~dp0"
python sparat_sync.py --watch
pause
