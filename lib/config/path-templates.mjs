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
 * - Orderings below are the FC pilot orderings, in use as-is (Tom away until
 *   ~2026-08-03; revisit with him only if the pilot orderings feel wrong).
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

  // Bass has no Debut path: that shelf holds a single orphan song (see
  // docs/reference/song-catalogue-coverage.md), so Grade 1 is the entry point. Ordering:
  // straight eighths → space/sustain → passing runs → locked riff → stamina.
  fc_path_bass_grade_1: {
    name: 'Bass Grade 1',
    instrument: 'Bass',
    level: 'Grade 1',
    steps: [
      'fc_song_bass_psycho_killer',
      'fc_song_bass_sittin_on_the_dock_of_the_bay',
      'fc_song_bass_crazy',
      'fc_song_bass_ain_t_too_proud_to_beg',
      'fc_song_bass_family_affair',
      'fc_song_bass_she_sells_sanctuary',
    ],
  },

  // Chord playing first, riffs second, drive last. RSL originals stay off the
  // path (covers keep beginners motivated); they remain on the shelf to assign.
  fc_path_electric_debut: {
    name: 'Electric Guitar Debut',
    instrument: 'Electric Guitar',
    level: 'Debut',
    steps: [
      'fc_song_elec_stand_by_me',
      'fc_song_elec_hello',
      'fc_song_elec_hey_joe',
      'fc_song_elec_another_brick_in_the_wall',
      'fc_song_elec_hoochie_coochie_man',
      'fc_song_elec_fortunate_son',
    ],
  },

  // Approachable and famous first, hands-together ballad skills in the middle,
  // quiet control late, showpiece to finish. RSL originals off the path as above.
  fc_path_piano_debut: {
    name: 'Piano Debut',
    instrument: 'Piano',
    level: 'Debut',
    steps: [
      'fc_song_danny',
      'fc_song_heathens',
      'fc_song_one_call_away',
      'fc_song_espresso',
      'fc_song_what_was_i_made_for',
      'fc_song_game_of_thrones_theme',
    ],
  },
};
