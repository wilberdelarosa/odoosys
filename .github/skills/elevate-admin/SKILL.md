---
name: elevate-admin
description: "Use when a Windows task needs temporary administrator privileges, UAC elevation, RunAs, service installation, PostgreSQL service setup, firewall changes, or privileged local installer steps. Covers checking admin state, launching an elevated PowerShell with the exact working directory, asking the user to accept UAC, and resuming validation after the elevated step finishes."
---

# Elevate Admin

Use this skill when a task on Windows needs administrator privileges for a limited step, especially when installing services or system-level dependencies.

## When To Use

- Installing PostgreSQL as a Windows service
- Running installers that need administrator privileges
- Registering services, scheduled tasks, firewall rules, or machine-wide dependencies
- Any task where the normal shell returns access denied or an admin check is false

## Core Rule

The agent cannot self-elevate silently. The user must approve the Windows UAC prompt.

## Standard Flow

1. Check whether the current shell is elevated.

```powershell
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

2. If already elevated, run the privileged command directly.

3. If not elevated, launch a new PowerShell with `RunAs` and an absolute working directory.

```powershell
Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-Command','Set-Location "C:\path\to\project"; <COMMAND_HERE>'
```

4. Tell the user to accept the UAC prompt.

5. After the elevated step finishes, continue validation from the normal session.

## Important Details

- Always use an absolute project path in the elevated command.
- Do not assume the elevated shell starts in the project folder. It often starts in `C:\Windows\System32`.
- Do not run `./script.ps1` from `System32`; first `Set-Location` to the real workspace or use an absolute script path.
- Prefer one focused elevated step, then return to the normal shell for testing and follow-up.

## Recommended Pattern For Scripted Installs

```powershell
Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-Command','Set-Location "C:\Users\user\project\windows-native"; & ".\install-native.ps1" -InstallPostgres'
```

For paths with spaces or multi-step installs, prefer a `.cmd` wrapper in the target folder and elevate that wrapper. This avoids quoting problems and keeps the elevated process in the correct working directory.

```bat
@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0complete-native-elevated.ps1"
echo Exit code: %ERRORLEVEL%
pause
```

```powershell
Start-Process -FilePath "C:\path with spaces\project\windows-native\run-complete-native-elevated.cmd" -Verb RunAs
```

For long elevated flows, write progress to a status JSON plus normal log and transcript so the non-elevated agent can resume diagnosis without guessing.

```powershell
Start-Transcript -Path .\runtime\logs\elevated-setup-transcript.log -Append
@{ state='running'; step='install-postgres'; updatedAt=(Get-Date).ToString('s') } |
	ConvertTo-Json | Set-Content .\runtime\elevated-setup-status.json -Encoding ASCII
```

When launching child scripts with `Start-Process`, quote script paths explicitly if the workspace path has spaces.

```powershell
Start-Process -FilePath 'powershell.exe' -ArgumentList @(
	'-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $scriptPath)
)
```

PowerShell 5.1 can treat native stderr as `NativeCommandError` when `$ErrorActionPreference = 'Stop'`. For long-running supervisors, route native processes through `cmd /c` with `2>&1` instead of wrapping them in a catching PowerShell block.

```powershell
$commandLine = '"{0}" "{1}" -c "{2}" >> "{3}" 2>&1' -f $pythonExe, $odooBin, $configPath, $logPath
cmd.exe /c $commandLine
```

For PostgreSQL, do not trust `psql.exe` alone. A partial Windows install may expose `bin\psql.exe` but miss server libraries or the service. Validate the service and server files such as `bin\initdb.exe`, `bin\pg_ctl.exe`, and `lib\dict_snowball.dll`. If the install is partial, install or repair PostgreSQL into a known complete prefix and then register/start the service.

## After Elevation

Run a narrow verification immediately after the privileged step, for example:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\test-native.ps1 -StaticOnly
```

## Expected User Interaction

The user approves UAC only for the temporary elevated window. The rest of the workflow can remain in the standard session.
