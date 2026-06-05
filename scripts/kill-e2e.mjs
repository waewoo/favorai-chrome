import { execFileSync } from 'node:child_process';

function killOnWindows() {
  const script = [
    "$processes = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -match '^(chrome|chromium|msedge)\\.exe$') -and ($_.CommandLine -match 'load-extension')",
    '};',
    "$processes | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('Killed PID {0}' -f $_.ProcessId) }",
  ].join(' ');

  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
  } catch {
    // No matching process is a normal outcome.
  }
}

function killOnUnix() {
  try {
    execFileSync('pkill', ['-f', 'load-extension'], { stdio: 'ignore' });
  } catch {
    // `pkill` exits non-zero when nothing matches, which is fine.
  }
}

if (process.platform === 'win32') {
  killOnWindows();
} else {
  killOnUnix();
}

console.log('E2E cleanup done.');
