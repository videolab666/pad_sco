@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem NOTE: every git command is invoked via "call" because on this machine
rem git resolves to a .bat wrapper (depot_tools); calling a .bat from a .bat
rem without "call" transfers control and never returns.

rem Make sure this is actually a git repository
call git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: not a git repository: %cd%
    goto :fail
)

rem Detect the current branch
set "branch="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "branch=%%b"
if not defined branch (
    echo ERROR: could not detect the current branch.
    goto :fail
)
echo Current branch: %branch%

rem Require a non-empty commit message
set "msg="
set /p "msg=Commit message: "
if not defined msg (
    echo CANCELLED: empty commit message - nothing was done.
    goto :fail
)

rem Stage all changes
call git add -A
if errorlevel 1 (
    echo ERROR: git add failed.
    goto :fail
)

rem Commit only when there is something staged
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
rem Push the working branch
call git push origin "%branch%"
if errorlevel 1 (
    echo ERROR: failed to push branch %branch%.
    goto :fail
)
echo Branch %branch% pushed.

rem Merge the working branch into main and push main
call git checkout main
if errorlevel 1 (
    echo ERROR: failed to checkout main.
    goto :fail
)

call git merge "%branch%"
if errorlevel 1 (
    echo ERROR: merge conflict - aborting merge.
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

rem Return to the working branch
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