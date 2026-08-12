/**
 * Session-start orientation: the facts about *right now* that no document can
 * hold without going stale.
 *
 * This exists because a stale branch is invisible until it costs you. A working
 * tree showing 25 changed files reads as urgent in-flight work; the fact that
 * actually explains it — the branch is 11 commits behind main — was recorded
 * nowhere, so the changes got treated as precious when they were superseded.
 * Drift from main is therefore printed first and loudest: it reframes every
 * other number below it.
 *
 * Everything here is derived from git and the filesystem, never from a file
 * someone has to remember to update. That is the whole point — CURRENT_HANDOVER
 * is then free to carry only what a command cannot work out.
 */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';

const MAIN_BRANCH = 'main';

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function gitOk(args) {
  try {
    execFileSync('git', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const BOLD = '[1m';
const DIM = '[2m';
const RED = '[31m';
const YELLOW = '[33m';
const GREEN = '[32m';
const RESET = '[0m';

const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (colour ? `${code}${text}${RESET}` : text);

function row(label, value) {
  return `  ${label.padEnd(13)}${value}`;
}

function relativeAge(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const warnings = [];

// --- branch ---------------------------------------------------------------
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], '(unknown)');

// --- drift from main: the headline ----------------------------------------
// Compared against origin/main rather than local main, because a local main can
// itself be behind and would report a comfortable zero while being wrong.
let driftLine;
const hasOriginMain = gitOk(['rev-parse', '--verify', `origin/${MAIN_BRANCH}`]);

if (!hasOriginMain) {
  driftLine = paint(DIM, 'no origin/main to compare against');
} else {
  const counts = git(['rev-list', '--left-right', '--count', `origin/${MAIN_BRANCH}...HEAD`]);
  const [behindRaw, aheadRaw] = counts.split(/\s+/);
  const behind = Number(behindRaw) || 0;
  const ahead = Number(aheadRaw) || 0;

  if (behind === 0 && ahead === 0) {
    driftLine = paint(GREEN, 'up to date with origin/main');
  } else {
    const parts = [];
    if (behind) parts.push(`${behind} behind`);
    if (ahead) parts.push(`${ahead} ahead`);
    const text = `${parts.join(', ')} origin/main`;
    driftLine = behind > 0 ? paint(RED, text) : paint(YELLOW, text);
    if (behind > 0) {
      warnings.push(
        `${behind} commits behind origin/main — uncommitted changes here may be superseded rather than new. Diff against origin/main before treating them as work in progress.`,
      );
    }
  }
}

// --- working tree ---------------------------------------------------------
const porcelain = git(['status', '--porcelain']);
const changed = porcelain ? porcelain.split('\n').filter(Boolean) : [];
const untracked = changed.filter((line) => line.startsWith('??')).length;
const tracked = changed.length - untracked;
const treeLine = changed.length === 0
  ? paint(GREEN, 'clean')
  : `${changed.length} file${changed.length === 1 ? '' : 's'}` +
    paint(DIM, ` (${tracked} tracked, ${untracked} untracked)`);

// --- code map -------------------------------------------------------------
// Cheap staleness signal: CI enforces this, so knowing now avoids a red run.
let codeMapLine;
try {
  execFileSync('node', ['scripts/code-map.mjs', 'check'], { stdio: 'ignore' });
  codeMapLine = paint(GREEN, 'current');
} catch {
  codeMapLine = paint(YELLOW, 'stale — run npm run generate-code-map');
  warnings.push('Code map is stale; CI runs code-map:check and will fail.');
}

// --- last commit on origin/main (what production is running) --------------
let deployLine = paint(DIM, 'unknown');
if (hasOriginMain) {
  const sha = git(['rev-parse', '--short', `origin/${MAIN_BRANCH}`]);
  const subject = git(['log', '-1', '--format=%s', `origin/${MAIN_BRANCH}`]);
  const when = relativeAge(git(['log', '-1', '--format=%cI', `origin/${MAIN_BRANCH}`]));
  const trimmed = subject.length > 48 ? `${subject.slice(0, 47)}…` : subject;
  deployLine = `${sha} ${paint(DIM, `${trimmed}${when ? ` · ${when}` : ''}`)}`;
}

// --- fetch freshness ------------------------------------------------------
// A drift number computed from a week-old fetch is worse than none, because it
// looks authoritative. Say how old the comparison is.
// Use the mtime of .git/FETCH_HEAD, not its commit date: the commit date is
// when someone authored the fetched commit, which says nothing about how long
// ago we last talked to the remote.
try {
  const gitDir = git(['rev-parse', '--git-dir'], '.git');
  const fetchedAt = statSync(path.join(gitDir, 'FETCH_HEAD')).mtimeMs;
  const hours = (Date.now() - fetchedAt) / 3600000;
  if (hours > 12) {
    warnings.push(
      `Last fetch was ${Math.round(hours)}h ago — run git fetch for an accurate comparison.`,
    );
  }
} catch {
  // Never fetched in this clone; the drift line already reads "no origin/main"
  // when that matters, so stay quiet rather than nagging about a fresh clone.
}

console.log('');
console.log(paint(BOLD, '  First Chord dashboard — current state'));
console.log('');
console.log(row('branch', branch === MAIN_BRANCH ? branch : paint(YELLOW, branch)));
console.log(row('vs origin', driftLine));
console.log(row('uncommitted', treeLine));
console.log(row('code map', codeMapLine));
console.log(row('on main', deployLine));
console.log('');

if (warnings.length) {
  for (const warning of warnings) console.log(`  ${paint(YELLOW, '!')} ${warning}`);
  console.log('');
}
