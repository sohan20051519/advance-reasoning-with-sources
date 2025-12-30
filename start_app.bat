@echo off
echo Starting Autonomous Research Agent...

echo Starting Backend Server (Port 8000)...
start "Backend Server" cmd /k "python server.py"

echo Starting Frontend (Port 5173)...
cd frontend
start "Frontend Client" cmd /k "npm run dev"

echo Done! The app should open in your browser at http://localhost:5173
pause
