/**
 * Path Templates - canonical, hand-curated
 *
 * NOT generated. Edit this file directly (same convention as songs-catalogue.mjs).
 *
 * A path template is a reusable ordered sequence of catalogue songs. "Assign
 * path" instantiates it into per-student Song_Assignments rows (path_id +
 * step_label + appended sort_order); after that the student's copy is fully
 * personal — tutors reorder, park, or add songs without touching the template.
 *
 * Rules:
 * - Every step must be a songId that exists in songs-catalogue.mjs (test-enforced).
 * - Editing a template NEVER changes already-instantiated assignments.
 * - Orderings below are a provisional FC pilot — Tom's curation confirms them.
 */

export const PATH_TEMPLATES = {
  fc_path_guitar_debut: {
    name: 'Guitar Debut',
    instrument: 'Guitar',
    level: 'Debut',
    steps: [
      'fc_song_ho_hey',
      'fc_song_stand_by_me',
      'fc_song_knockin_on_heavens_door',
      'fc_song_no_woman_no_cry',
      'fc_song_brown_eyed_girl',
      'fc_song_yellow',
    ],
  },

  fc_path_guitar_grade_1: {
    name: 'Guitar Grade 1',
    instrument: 'Guitar',
    level: 'Grade 1',
    steps: [
      'fc_song_seven_nation_army',
      'fc_song_come_as_you_are',
      'fc_song_redemption_song',
      'fc_song_perfect',
      'fc_song_hallelujah',
      'fc_song_titanium',
    ],
  },
};
