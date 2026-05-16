@echo off
rem This script lives in the repository, and git checkout/merge rewrite it in
rem the working tree mid-run, which corrupts cmd's line-by-line execution.
rem So it copies itself to an immutable temp location and runs from there.
if /i not "%~nx0"=="pushmain_run.bat" ( copy /y "%~f0" "%TEMP%\pushmain_run.bat" >nul & call "%TEMP%\pushmain_run.bat" "%~dp0" & exit /b )

rem ---- running from the temp copy; %1 is the repository directory ----
setlocal EnableExtensions
cd /d "%~1"
if errorlevel 1 (
    echo ERROR: cannot enter repository directory: %~1
    pause
    exit /b 1
)

rem Every git command uses "call": on this machine git is a .bat wrapper
rem (depot_tools); calling a .bat from a .bat without "call" never returns.
call git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: not a git repository: %cd%
    goto :fail
)

set "branch="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "branch=%%b"
if not defined branch (
    echo ERROR: could not detect the current branch.
    goto :fail
)
echo Current branch: %branch%

set "msg="
set /p "msg=Commit message: "
if not defined msg (
    echo CANCELLED: empty commit message - nothing was done.
    goto :fail
)

call git add -A
if errorlevel 1 (
    echo ERROR: git add failed.
    goto :fail
)

set "hasChanges="
call git diff --cached --quiet || set "hasChanges=1"
if not defined hasChanges (
    echo No staged changes - skipping commit.
    goto :afterCommit
)

call git commit -m "%msg%"
if errorlevel 1 (
    echo ERROR: git commit failed.
    goto :fail
)
echo Commit created.

:afterCommit
call git push origin "%branch%"
if errorlevel 1 (
    echo ERROR: failed to push branch %branch%.
    goto :fail
)
echo Branch %branch% pushed.

call git checkout main
if errorlevel 1 (
    echo ERROR: failed to checkout main.
    goto :fail
)

call git merge --no-edit "%branch%"
if errorlevel 1 (
    echo ERROR: merge failed - aborting merge.
    call git merge --abort
    call git checkout "%branch%"
    goto :fail
)

call git push origin main
if errorlevel 1 (
    echo ERROR: failed to push main.
    call git checkout "%branch%"
    goto :fail
)
echo main pushed.

call git checkout "%branch%"

echo.
echo Done! Committed and pushed (%branch% -^> main).
pause
exit /b 0

:fail
echo.
echo Aborted - see the error above.
pause
exit /b 1