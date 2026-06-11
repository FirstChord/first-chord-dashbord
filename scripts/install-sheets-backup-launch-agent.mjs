import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const label = 'com.firstchord.sheets-backup';
const launchAgentsDir = path.join(homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(launchAgentsDir, `${label}.plist`);
const backupLogDir = path.join(repoRoot, 'backups', 'sheets');
const intervalSeconds = 14 * 24 * 60 * 60;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveNpmPath() {
  return execFileSync('/bin/zsh', ['-lc', 'command -v npm'], { encoding: 'utf8' }).trim();
}

const npmPath = resolveNpmPath();
await mkdir(launchAgentsDir, { recursive: true });
await mkdir(backupLogDir, { recursive: true });

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(npmPath)}</string>
    <string>run</string>
    <string>backup:sheets</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(repoRoot)}</string>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(backupLogDir, 'launchd.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(backupLogDir, 'launchd.err.log'))}</string>
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
console.log(`Schedule: every 14 days`);
console.log(`Plist: ${plistPath}`);
console.log(`Logs: ${backupLogDir}/launchd.out.log and launchd.err.log`);
