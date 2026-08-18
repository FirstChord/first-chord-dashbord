import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCodeIndex,
  buildImpactReport,
  CODE_MAP_RELATIVE_PATH,
  CODE_MAP_SEARCH_SCOPE,
  renderCodeMap,
  searchCodeIndex,
  searchFileBodies,
  searchOutsideCodeIndex,
  validateAgentWorkflowMap,
  validateHelperPurity,
  validateModuleOverviewCoverage,
} from './code-map-core.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.log(`Usage:
  npm run generate-code-map
  npm run code-map:check
  npm run code-map:find -- "search terms" [--body] [--json]
  npm run code-map:impact -- [path ...] [--json]

With no paths, code-map:impact uses the current git worktree diff.
code-map:find searches symbol/path metadata. When that finds nothing it falls back
to a ripgrep body-text scan; --body forces that scan even on a metadata hit.`);
}

function changedFiles() {
  const runGit = (args) => {
    try {
      const output = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
      return output ? output.split('\n').map((entry) => entry.trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  };
  return [...new Set([
    ...runGit(['diff', '--name-only', 'HEAD']),
    ...runGit(['ls-files', '--others', '--exclude-standard']),
  ])].sort();
}

function compactList(items, limit = 12) {
  if (!items.length) return 'none found';
  const visible = items.slice(0, limit);
  const suffix = items.length > limit ? ` (+${items.length - limit} more)` : '';
  return `${visible.join(', ')}${suffix}`;
}

function matchedExports(record, query) {
  const terms = `${query}`.toLowerCase().split(/[^a-z0-9_$*-]+/u).filter(Boolean);
  const matched = record.exports.filter((entry) => terms.some((term) => entry.name.toLowerCase().includes(term)));
  return matched.length ? matched : record.exports;
}

function serialiseFindResult({ record, score, reasons = [] }, query) {
  const exports = matchedExports(record, query);
  return {
    path: record.path,
    score,
    reasons,
    moduleOverview: record.moduleOverview,
    exports: exports.slice(0, 20),
    omittedExportCount: Math.max(0, exports.length - 20),
    directTests: record.directTests,
    directConsumers: record.directConsumers,
  };
}

function printFindRecord({ record, reasons = [] }, query, position) {
  const exports = matchedExports(record, query).map((entry) => `${entry.name} (${record.path}:${entry.line})`);
  console.log(`\n${position}. ${record.path}${reasons.length ? ` [${reasons.join(', ')}]` : ''}`);
  if (record.moduleOverview.text) console.log(`   module overview: ${record.moduleOverview.text}`);
  console.log(`   exports: ${compactList(exports)}`);
  console.log(`   direct tests: ${compactList(record.directTests)}`);
  console.log(`   direct production consumers: ${compactList(record.directConsumers)}`);
}

function printFindResults(query, results, outsideScopeMatches, bodySearch, forcedBody) {
  console.log(`Primary code map matches for "${query}" (${results.length})`);
  console.log('Primary scope: lib/admin, lib/songs, and Next route files.');
  console.log('Symbol/path metadata only at this layer — file bodies are not indexed.');
  console.log('A ripgrep body-text scan runs automatically when the metadata layers miss (--body forces it).');
  console.log('Static source evidence only; inspect current code before changing behavior.');
  if (!results.length) {
    console.log('\nNo primary-scope match. This does not mean the code does not exist.');
  }
  results.forEach((result, position) => printFindRecord(result, query, position + 1));

  if (outsideScopeMatches.length) {
    console.log(`\nOutside primary map scope — path/export matches (${outsideScopeMatches.length})`);
    console.log('These files participate in the wider import graph but are not rows in the browsable grid.');
    outsideScopeMatches.forEach((result, position) => printFindRecord(result, query, position + 1));
  } else if (!results.length) {
    console.log('\nNo path/export match was found in the wider app, components, lib, scripts, or tests graph.');
  }

  printBodySearchResults(bodySearch, { forced: forcedBody });
}

function printBodySearchResults(bodySearch, { forced }) {
  if (!bodySearch) return;
  const heading = forced ? 'Body-text matches (ripgrep, forced by --body)' : 'Body-text fallback (ripgrep)';
  if (!bodySearch.available) {
    console.log(`\n${heading}: ripgrep is not installed, so file bodies were not scanned.`);
    if (bodySearch.command) console.log(`   run manually: ${bodySearch.command}`);
    return;
  }
  console.log(`\n${heading} — ${bodySearch.results.length} file${bodySearch.results.length === 1 ? '' : 's'}${bodySearch.truncated ? ` (+${bodySearch.truncated} more not shown)` : ''}`);
  console.log(`Searched terms: ${bodySearch.terms.join(', ')}. Ranked by distinct terms matched, then match count.`);
  console.log('Text occurrences only — a hit is not evidence that the file owns the behavior.');
  console.log(`Reproduce or widen: ${bodySearch.command}`);
  if (!bodySearch.results.length) {
    console.log('   no file body in app, components, lib, scripts, or tests contains these terms.');
    return;
  }
  for (const entry of bodySearch.results) {
    console.log(`   ${entry.path} (${entry.matches} match${entry.matches === 1 ? '' : 'es'}, ${entry.termsMatched}/${bodySearch.terms.length} terms)`);
  }
}

function pathDistanceList(items) {
  return items.map((entry) => `${entry.path} (distance ${entry.distance})`);
}

function printImpactReports(reports) {
  console.log(`Code impact report (${reports.length} target${reports.length === 1 ? '' : 's'})`);
  console.log('Conservative static imports only; dynamic/runtime consumers may not appear.');
  for (const report of reports) {
    console.log(`\n${report.target}`);
    if (!report.exists) {
      console.log('  file does not exist in the current worktree');
      continue;
    }
    if (!report.indexed) console.log('  not part of the generated map scope; graph evidence follows where available');
    if (report.source?.moduleOverview.text) console.log(`  module overview: ${report.source.moduleOverview.text}`);
    console.log(`  direct production consumers: ${compactList(report.directConsumers)}`);
    console.log(`  related tests: ${compactList(pathDistanceList(report.relatedTests), 20)}`);
    console.log(`  app entrypoints: ${compactList(pathDistanceList(report.entrypoints), 20)}`);
    console.log(`  scripts: ${compactList(pathDistanceList(report.scripts), 12)}`);
  }
}

const [command = '', ...rawArgs] = process.argv.slice(2);
if (!command || ['help', '--help', '-h'].includes(command)) {
  usage();
  process.exit(command ? 0 : 1);
}

const json = rawArgs.includes('--json');
const forcedBody = rawArgs.includes('--body');
const args = rawArgs.filter((argument) => !['--json', '--body'].includes(argument));
const index = buildCodeIndex({ repoRoot });
const rendered = renderCodeMap(index);
const outputPath = path.join(repoRoot, CODE_MAP_RELATIVE_PATH);

if (command === 'generate') {
  fs.writeFileSync(outputPath, rendered);
  console.log(`Generated ${CODE_MAP_RELATIVE_PATH} (${index.records.length} modules, fingerprint ${index.fingerprint}).`);
} else if (command === 'check') {
  const errors = [];
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== rendered) {
    errors.push(`${CODE_MAP_RELATIVE_PATH} is stale; run npm run generate-code-map`);
  }
  errors.push(...validateModuleOverviewCoverage(index));
  errors.push(...validateHelperPurity(index));
  errors.push(...validateAgentWorkflowMap({
    repoRoot,
    source: fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8'),
  }));
  for (const record of index.graphRecords) {
    if (record.unsupportedExportLines.length) {
      errors.push(`${record.path}: unsupported export syntax on line${record.unsupportedExportLines.length === 1 ? '' : 's'} ${record.unsupportedExportLines.join(', ')}`);
    }
  }
  if (errors.length) {
    console.error(`Code map check failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.error(`- ${error}`);
    if (errors.some((error) => error.includes('@fileoverview'))) {
      console.error('\nAdd a one-line `/** @fileoverview ... */` at the top of each module above.');
      console.error('It is what `code-map:find` searches, so an undescribed module is unfindable by concept.');
    }
    process.exit(1);
  }
  console.log(`Code map and AGENTS Workflow Map are current (${index.records.length} modules, fingerprint ${index.fingerprint}).`);
  console.log(`Module overview coverage: ${index.records.length}/${index.records.length}.`);
  console.log('Helper purity: every lib/**/*-helpers.mjs is free of I/O.');
} else if (command === 'find') {
  const query = args.join(' ').trim();
  if (!query) {
    console.error('code-map:find requires search terms');
    process.exit(1);
  }
  const results = searchCodeIndex(index, query);
  const outsideScopeMatches = searchOutsideCodeIndex(index, query);
  const bodySearch = (forcedBody || !results.length)
    ? searchFileBodies({ repoRoot, query })
    : null;
  if (json) {
    console.log(JSON.stringify({
      query,
      scope: CODE_MAP_SEARCH_SCOPE,
      results: results.map((result) => serialiseFindResult(result, query)),
      outsideScopeMatches: outsideScopeMatches.map((result) => serialiseFindResult(result, query)),
      bodySearch,
    }, null, 2));
  } else {
    printFindResults(query, results, outsideScopeMatches, bodySearch, forcedBody);
  }
  if (!results.length && !outsideScopeMatches.length && !bodySearch?.results.length) process.exitCode = 2;
} else if (command === 'impact') {
  const targets = args.length ? args : changedFiles();
  if (!targets.length) {
    console.log('No changed or requested files to inspect.');
    process.exit(0);
  }
  const reports = buildImpactReport(index, targets);
  if (json) {
    console.log(JSON.stringify({ reports }, null, 2));
  } else {
    printImpactReports(reports);
  }
} else {
  console.error(`Unknown code-map command: ${command}`);
  usage();
  process.exit(1);
}
