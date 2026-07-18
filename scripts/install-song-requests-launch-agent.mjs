// Installs the weekly Song_Requests noticing agent (Mondays 09:03 local; if
// the Mac is asleep, launchd fires it on next wake). Mirrors
// install-sheets-backup-launch-agent.mjs.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const label = 'com.firstchord.song-requests-check';
const launchAgentsDir = path.join(homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(launchAgentsDir, `${label}.plist`);
const logDir = path.join(homedir(), 'Library', 'Logs', 'firstchord');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveNodePath() {
  return execFileSync('/bin/zsh', ['-lc', 'command -v node'], { encoding: 'utf8' }).trim();
}

const nodePath = resolveNodePath();
await mkdir(launchAgentsDir, { recursive: true });
await mkdir(logDir, { recursive: true });

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(nodePath)}</string>
    <string>${escapeXml(path.join(repoRoot, 'scripts', 'check-song-requests.mjs'))}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(repoRoot)}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>3</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(logDir, 'song-requests-check.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(logDir, 'song-requests-check.err.log'))}</string>
</dict>
</plist>
`;

await writeFile(plistPath, plist, 'utf8');

const uid = process.getuid?.();
if (typeof uid !== 'number') {
  throw new Error('Could not determine current user id for launchctl.');
}

try {
  execFileSync('launchctl', ['bootout', `gui/${uid}`, plistPath], { stdio: 'ignore' });
} catch {
  // It is fine if the agent was not loaded yet.
}

execFileSync('launchctl', ['bootstrap', `gui/${uid}`, plistPath], { stdio: 'inherit' });
execFileSync('launchctl', ['enable', `gui/${uid}/${label}`], { stdio: 'inherit' });

console.log(`Installed ${label}`);
console.log('Schedule: Mondays 09:03 (fires on next wake if the Mac was asleep)');
console.log(`Plist: ${plistPath}`);
console.log(`Logs: ${path.join(logDir, 'song-requests-check.out.log')} / .err.log`);
