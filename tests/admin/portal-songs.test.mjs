import test from 'node:test';
import assert from 'node:assert/strict';

import { joinAssignmentsToCatalogue } from '../../lib/songs/portal-songs.mjs';

const CATALOGUE = {
  fc_song_a: { title: 'Song A', artist: 'Artist A', level: 'Debut', studentNote: 'fun one', soundslice: { scorehash: 'aaaaa' } },
  fc_song_b: { title: 'Song B', artist: 'Artist B', level: 'Grade 1', soundslice: { scorehash: 'bbbbb' } },
};

test('joins assignments to catalogue in sort order', () => {
  const rows = [
    { songId: 'fc_song_b', status: 'assigned', sortOrder: '2' },
    { songId: 'fc_song_a', status: 'working', sortOrder: '1' },
  ];
  const songs = joinAssignmentsToCatalogue(rows, CATALOGUE);
  assert.deepEqual(songs.map((s) => s.songId), ['fc_song_a', 'fc_song_b']);
  assert.equal(songs[0].title, 'Song A');
  assert.equal(songs[0].studentNote, 'fun one');
  assert.equal(songs[0].status, 'working');
  assert.equal(songs[0].soundsliceUrl, 'https://www.soundslice.com/slices/aaaaa/');
  assert.equal(songs[1].studentNote, '');
});

test('drops parked assignments and songs that left the catalogue', () => {
  const rows = [
    { songId: 'fc_song_a', status: 'parked', sortOrder: '1' },
    { songId: 'fc_song_gone', status: 'assigned', sortOrder: '2' },
    { songId: 'fc_song_b', status: 'done', sortOrder: '3' },
  ];
  const songs = joinAssignmentsToCatalogue(rows, CATALOGUE);
  assert.deepEqual(songs.map((s) => s.songId), ['fc_song_b']);
});

test('empty input renders nothing', () => {
  assert.deepEqual(joinAssignmentsToCatalogue([], CATALOGUE), []);
  assert.deepEqual(joinAssignmentsToCatalogue(undefined, CATALOGUE), []);
});
