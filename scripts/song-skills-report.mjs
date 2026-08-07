// Where the song skill layer is thin, so gaps get filled on purpose.
//   node scripts/song-skills-report.mjs           → summary + the biggest gaps
//   node scripts/song-skills-report.mjs --gaps    → every song with no skills
//   node scripts/song-skills-report.mjs --json
//
// Skills are derived from the tags a song already has (lib/config/song-skills.mjs).
// A song with no skills is not broken — it just has nothing to say yet. Fill it
// by adding a real tag to the catalogue entry, or an explicit `skills` list.
import { buildSkillCoverage } from '../lib/songs/skills-helpers.mjs';
import { SONGS_CATALOGUE } from '../lib/config/songs-catalogue.mjs';

const coverage = buildSkillCoverage();
const showAllGaps = process.argv.includes('--gaps');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(coverage, null, 2));
  process.exit(0);
}

const pct = Math.round((coverage.withSkills / coverage.total) * 100);
console.log(`Songs with at least one skill: ${coverage.withSkills} of ${coverage.total} (${pct}%)\n`);

console.log('Most-taught skills');
for (const skill of coverage.skillUse.filter((s) => s.count).slice(0, 12)) {
  console.log(`  ${String(skill.count).padStart(3)}  ${skill.label} (${skill.area})`);
}

if (coverage.unusedSkills.length) {
  console.log(`\nSkills no song teaches yet: ${coverage.unusedSkills.join(', ')}`);
}

if (coverage.unclassifiedTags.length) {
  console.log('\nTags that are neither a skill nor filing — classify these in song-skills.mjs:');
  for (const { tag, count } of coverage.unclassifiedTags) {
    console.log(`  ${String(count).padStart(3)}  ${tag}`);
  }
}

// A tutor note usually says what a song teaches in plain English, which makes
// it the fastest way for a human to pick the right tag. Deliberately shown for
// a person to read rather than parsed: guessing skills from prose is how you
// get confident wrong data.
const gaps = coverage.songsWithoutSkills;
const shown = showAllGaps ? gaps : gaps.slice(0, 15);
console.log(`\nSongs with no skills yet: ${gaps.length}${showAllGaps ? '' : ` (showing ${shown.length}, --gaps for all)`}`);
for (const gap of shown) {
  const note = SONGS_CATALOGUE[gap.songId]?.tutorNote || '';
  const tags = gap.tags.length ? ` [${gap.tags.join(', ')}]` : '';
  console.log(`  ${gap.title}${tags}`);
  if (note) console.log(`      ${note}`);
}
