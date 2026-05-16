@echo off
chcp 65001 >nul 2>&1
set /p msg="Commit message: "
git add -A
git commit -m "%msg%"
git push origin Nivki_RSP_1
git checkout main
git merge Nivki_RSP_1
git push origin main
git checkout Nivki_RSP_1
echo.
echo Done! Pushed to main.
pause
