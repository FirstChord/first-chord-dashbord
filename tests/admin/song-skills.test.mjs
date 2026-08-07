import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSkillCoverage,
  skillIdsForSong,
  skillLabelsForSong,
  skillsForSong,
} from '../../lib/songs/skills-helpers.mjs';
import { SONGS_CATALOGUE } from '../../lib/config/songs-catalogue.mjs';
import {
  NON_SKILL_TAGS,
  SKILL_AREAS,
  SONG_SKILLS,
  TAG_SKILLS,
} from '../../lib/config/song-skills.mjs';

test('skills come from the tags a song already has', () => {
  assert.deepEqual(
    skillIdsForSong({ tags: ['open chords', 'strumming'] }).sort(),
    ['open_chords', 'strumming'],
  );
});

test('one tag may imply more than one skill', () => {
  assert.deepEqual(
    skillIdsForSong({ tags: ['muted strumming'] }).sort(),
    ['muting', 'strumming'],
  );
});

test('filing tags contribute no skills', () => {
  assert.deepEqual(skillIdsForSong({ tags: ['exam piece', '2025 syllabus', 'classical'] }), []);
});

test('an explicit skills list overrides the tags', () => {
  assert.deepEqual(
    skillIdsForSong({ tags: ['strumming'], skills: ['syncopation'] }),
    ['syncopation'],
  );
});

test('an unknown skill id is dropped rather than invented', () => {
  assert.deepEqual(skillIdsForSong({ skills: ['syncopation', 'not_a_real_skill'] }), ['syncopation']);
});

test('a scale entry teaches scales without needing a tag', () => {
  assert.deepEqual(skillIdsForSong({ contentType: 'scale', tags: ['technical'] }), ['scales']);
});

test('an exercise gets no skill guessed for it', () => {
  // `exercise` covers riffs, chords and technique alike, so there is nothing
  // safe to infer. This is the guard against manufacturing confident data.
  assert.deepEqual(skillIdsForSong({ contentType: 'exercise', tags: ['technical'] }), []);
});

test('duplicate tags collapse to one skill', () => {
  assert.deepEqual(skillIdsForSong({ tags: ['arpeggios', 'arpeggio', 'broken chords'] }), ['arpeggios']);
});

test('a song with nothing to say returns nothing rather than an empty group', () => {
  assert.deepEqual(skillsForSong({ tags: [] }), []);
  assert.deepEqual(skillLabelsForSong({}), []);
});

test('skills group by area in the declared order', () => {
  const groups = skillsForSong({ tags: ['dynamics', 'strumming', 'syncopation'] });
  assert.deepEqual(groups.map((group) => group.area), ['technique', 'rhythm', 'expression']);
  assert.deepEqual(groups[0].skills, [{ id: 'strumming', label: 'Strumming' }]);
});

test('labels come back sorted so cards read consistently', () => {
  assert.deepEqual(
    skillLabelsForSong({ tags: ['strumming', 'dynamics', 'capo'] }),
    ['Capo', 'Dynamics', 'Strumming'],
  );
});

// --- vocabulary integrity ------------------------------------------------

test('every skill belongs to a declared area', () => {
  for (const [id, skill] of Object.entries(SONG_SKILLS)) {
    assert.ok(SKILL_AREAS[skill.area], `${id} has unknown area "${skill.area}"`);
    assert.ok(skill.label, `${id} has no label`);
  }
});

test('every tag mapping points at a real skill', () => {
  for (const [tag, ids] of Object.entries(TAG_SKILLS)) {
    for (const id of ids) {
      assert.ok(SONG_SKILLS[id], `tag "${tag}" maps to unknown skill "${id}"`);
    }
  }
});

test('no tag is both a skill and filing', () => {
  for (const tag of Object.keys(TAG_SKILLS)) {
    assert.equal(NON_SKILL_TAGS.has(tag), false, `"${tag}" is classified twice`);
  }
});

test('every catalogue tag is classified as either a skill or filing', () => {
  // The point of the split is that "not yet classified" is visible. If this
  // fails, a new tag arrived with the last batch of songs and needs a home in
  // song-skills.mjs — see `node scripts/song-skills-report.mjs`.
  const { unclassifiedTags } = buildSkillCoverage();
  assert.deepEqual(
    unclassifiedTags.map((entry) => entry.tag),
    [],
    'unclassified catalogue tags found',
  );
});

test('the real catalogue produces skills for a meaningful share of songs', () => {
  const coverage = buildSkillCoverage(SONGS_CATALOGUE);
  assert.equal(coverage.total, Object.keys(SONGS_CATALOGUE).length);
  assert.ok(
    coverage.withSkills >= 120,
    `expected at least 120 songs with skills, got ${coverage.withSkills}`,
  );
});
