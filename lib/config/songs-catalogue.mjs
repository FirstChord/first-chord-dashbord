/**
 * Song Catalogue - canonical, hand-curated
 *
 * NOT generated. Edit this file directly (unlike the 5 generated config files).
 * Each entry is a reusable Song object; see docs/admin/STUDENT_PATHS_PLAN.md.
 *
 * Rules:
 * - Soundslice is referenced ONLY via the nested soundslice.scorehash.
 *   Never store raw Soundslice URLs; derive them via lib/songs/catalogue-helpers.mjs.
 * - Every slice listed here must have its secret URL enabled (status=3) so
 *   logged-out students can open it. Enable + verify with
 *   "FC Admin Tools/Soundslice/enable_secret_links.py" before adding an entry.
 * - No student names anywhere in this file. It ships in the client bundle.
 * - instruments / level / contentType values must come from the vocabularies below.
 *
 * Seeded 2026-07-12 from exports/rsl_acoustic_grades_links.csv (RSL Acoustic
 * Grades: Debut GCbQ7, Debut 2016 KCbQ7, Grade 1 7CbQ7), canonical versions only.
 * Piano seeded 2026-07-12 from Rock School Piano 2025 lists (Debut 4TbQ7,
 * Grade 1 NTbQ7, Grade 2 bTbQ7, Grade 3 fTbQ7) + RSL Classical Piano G1 (3sMQ7).
 * artist: 'RSL' is the needs-curation marker (syllabus original or unverified
 * attribution) — replace with the real artist during review, never guess.
 */

export const SONG_INSTRUMENTS = ['Guitar', 'Bass', 'Piano'];

export const SONG_LEVELS = ['Beginner', 'Debut', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'];

export const SONG_CONTENT_TYPES = ['song', 'exercise', 'scale', 'theory'];

export const SONGS_CATALOGUE = {
  // --- Debut Acoustic ---

  fc_song_ho_hey: {
    title: 'Ho Hey',
    artist: 'The Lumineers',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'strumming', 'singalong'],
    tutorNote: 'Two-chord verse, great first strumming song.',
    studentNote: 'A campfire favourite you can play really quickly.',
    soundslice: { scorehash: 'Kynfc', sourceListId: 'GCbQ7' },
  },

  fc_song_stand_by_me: {
    title: 'Stand By Me',
    artist: 'Ben E. King',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'classic progression', 'steady rhythm'],
    tutorNote: 'The 50s progression (I vi IV V). Good for even down-strums and chord changes in time.',
    studentNote: 'One of the most famous chord progressions ever. Learn this and you can play hundreds of songs.',
    soundslice: { scorehash: '9ynfc', sourceListId: 'GCbQ7' },
  },

  fc_song_aint_no_sunshine: {
    title: "Ain't No Sunshine",
    artist: 'Bill Withers',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['minor chords', 'groove', 'dynamics'],
    tutorNote: 'Am-based groove. Good introduction to minor tonality and playing quietly.',
    studentNote: 'A moody soul classic with a groove that feels great to play.',
    soundslice: { scorehash: 'Qvqfc', sourceListId: 'GCbQ7' },
  },

  fc_song_eleanor_rigby: {
    title: 'Eleanor Rigby',
    artist: 'The Beatles',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['minor chords', 'strumming', 'storytelling song'],
    tutorNote: 'Mostly Em and C. Space to work on strumming patterns once the changes are safe.',
    studentNote: 'A Beatles classic that only needs a couple of chords.',
    soundslice: { scorehash: 'Bvqfc', sourceListId: 'GCbQ7' },
  },

  fc_song_im_yours: {
    title: "I'm Yours",
    artist: 'Jason Mraz',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'strumming', 'singalong'],
    tutorNote: 'Four-chord loop. Ideal for keeping a relaxed strum going while singing.',
    studentNote: 'A feel-good song built on four chords that repeat the whole way through.',
    soundslice: { scorehash: '8vqfc', sourceListId: 'GCbQ7' },
  },

  fc_song_knockin_on_heavens_door: {
    title: "Knockin' on Heaven's Door",
    artist: 'Bob Dylan',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'strumming', 'classic progression'],
    tutorNote: 'G, D, Am, C. The classic first full song; loads of room for strumming development.',
    studentNote: 'Probably the most-taught first song in the world, for good reason.',
    soundslice: { scorehash: 'qvqfc', sourceListId: 'GCbQ7' },
  },

  fc_song_no_woman_no_cry: {
    title: 'No Woman No Cry',
    artist: 'Bob Marley & The Wailers',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'reggae feel', 'exam piece'],
    tutorNote: 'RSL Debut 2016 book piece. Nice for off-beat feel awareness even with simple strums.',
    studentNote: 'A reggae classic with a laid-back feel.',
    soundslice: { scorehash: 'JpWMc', sourceListId: 'KCbQ7' },
  },

  fc_song_brown_eyed_girl: {
    title: 'Brown Eyed Girl',
    artist: 'Van Morrison',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'strumming', 'exam piece'],
    tutorNote: 'RSL Debut 2016 book piece. Bright major-key strummer; the riff can come later.',
    studentNote: 'A sunny singalong that always gets people joining in.',
    soundslice: { scorehash: 'lpWMc', sourceListId: 'KCbQ7' },
  },

  fc_song_yellow: {
    title: 'Yellow',
    artist: 'Coldplay',
    instruments: ['Guitar'],
    level: 'Debut',
    contentType: 'song',
    tags: ['open chords', 'strumming', 'exam piece'],
    tutorNote: 'RSL Debut 2016 book piece. Slow harmonic rhythm, good for clean chord tone.',
    studentNote: 'A gentle anthem with plenty of space to make each chord ring out.',
    soundslice: { scorehash: 'kpWMc', sourceListId: 'KCbQ7' },
  },

  // --- Grade 1 Acoustic ---

  fc_song_seven_nation_army: {
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
    instruments: ['Guitar'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['riff-based', 'single notes', 'theory: eighth notes'],
    tutorNote: 'The riff everyone asks for. Good single-note timing before mixing in chords.',
    studentNote: 'That riff you have definitely heard at every football match.',
    soundslice: { scorehash: 'Yvmfc', sourceListId: '7CbQ7' },
  },

  fc_song_perfect: {
    title: 'Perfect',
    artist: 'Ed Sheeran',
    instruments: ['Guitar'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['open chords', 'picking pattern', 'singalong'],
    tutorNote: 'Standard four chords; the 6/8 feel and picking pattern are the Grade 1 challenge.',
    studentNote: 'A modern classic that sounds impressive once the picking pattern clicks.',
    soundslice: { scorehash: 'NMfzc', sourceListId: '7CbQ7' },
  },

  fc_song_hallelujah: {
    title: 'Hallelujah',
    artist: 'Leonard Cohen',
    instruments: ['Guitar'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['open chords', 'arpeggio', 'theory: 6/8 time'],
    tutorNote: 'Great for 6/8 feel and broken-chord playing. Works picked or strummed.',
    studentNote: 'A beautiful song that teaches you to make chords flow into each other.',
    soundslice: { scorehash: 'r3bfc', sourceListId: '7CbQ7' },
  },

  fc_song_titanium: {
    title: 'Titanium',
    artist: 'David Guetta ft. Sia',
    instruments: ['Guitar'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['open chords', 'dynamics', 'pop'],
    tutorNote: 'Pop form with a big dynamic lift into the chorus; good for controlling strum intensity.',
    studentNote: 'A pop anthem where you get to build from quiet verses to a huge chorus.',
    soundslice: { scorehash: 'G3bfc', sourceListId: '7CbQ7' },
  },

  fc_song_redemption_song: {
    title: 'Redemption Song',
    artist: 'Bob Marley',
    instruments: ['Guitar'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['open chords', 'riff-based', 'storytelling song'],
    tutorNote: 'The intro riff plus solid open-chord work. A whole performance on one guitar.',
    studentNote: 'One guitar, one voice, one of the greatest songs ever written.',
    soundslice: { scorehash: 'n3bfc', sourceListId: '7CbQ7' },
  },

  fc_song_come_as_you_are: {
    title: 'Come as You Are',
    artist: 'Nirvana',
    instruments: ['Guitar'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['riff-based', 'single notes', 'rock'],
    tutorNote: 'Iconic single-note riff; watch the string crossing. Chords can layer in later.',
    studentNote: 'A grunge classic with a riff that winds up and down like a wave.',
    soundslice: { scorehash: 'q1Jfc', sourceListId: '7CbQ7' },
  },

  // --- Rock School Piano 2025 — Debut ---
  fc_song_home_to_philadelphia: {
    title: 'Home To Philadelphia',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 's7w1c', sourceListId: '4TbQ7' },
  },

  fc_song_vanishing_footprints: {
    title: 'Vanishing Footprints',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'l7w1c', sourceListId: '4TbQ7' },
  },

  fc_song_danny: {
    title: 'Danny',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'N7w1c', sourceListId: '4TbQ7' },
  },

  fc_song_down_in_the_river_to_pray: {
    title: 'Down In the River To Pray',
    artist: 'Traditional',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'xdw1c', sourceListId: '4TbQ7' },
  },

  fc_song_heathens: {
    title: 'Heathens',
    artist: 'Twenty One Pilots',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'BqV1c', sourceListId: '4TbQ7' },
  },

  fc_song_espresso: {
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Zyg8c', sourceListId: '4TbQ7' },
  },

  fc_song_one_call_away: {
    title: 'One Call Away',
    artist: 'Charlie Puth',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '-yg8c', sourceListId: '4TbQ7' },
  },

  fc_song_what_was_i_made_for: {
    title: 'What Was I Made For',
    artist: 'Billie Eilish',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '6yg8c', sourceListId: '4TbQ7' },
  },

  fc_song_short_fuse: {
    title: 'Short Fuse',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'vyg8c', sourceListId: '4TbQ7' },
  },

  fc_song_midnight_song: {
    title: 'Midnight Song',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Nwg8c', sourceListId: '4TbQ7' },
  },

  fc_song_game_of_thrones_theme: {
    title: 'Game Of Thrones Theme',
    artist: 'Ramin Djawadi',
    instruments: ['Piano'],
    level: 'Debut',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Jwg8c', sourceListId: '4TbQ7' },
  },

  // --- Rock School Piano 2025 — Grade 1 ---
  fc_song_minuet_in_f_k_2: {
    title: 'Minuet In F (K.2)',
    artist: 'W. A. Mozart',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Gkl1c', sourceListId: 'NTbQ7' },
  },

  fc_song_step_by_step: {
    title: 'Step By Step',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Jkl1c', sourceListId: 'NTbQ7' },
  },

  fc_song_circus_waltz: {
    title: 'Circus Waltz',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Dkl1c', sourceListId: 'NTbQ7' },
  },

  fc_song_wasting_my_young_years: {
    title: 'Wasting My Young Years',
    artist: 'London Grammar',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'sDl1c', sourceListId: 'NTbQ7' },
  },

  fc_song_deep_river: {
    title: 'Deep River',
    artist: 'Traditional',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '3Dl1c', sourceListId: 'NTbQ7' },
  },

  fc_song_this_is_who_i_am: {
    title: 'This Is Who I Am',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'wDl1c', sourceListId: 'NTbQ7' },
  },

  fc_song_million_reasons: {
    title: 'Million Reasons',
    artist: 'Lady Gaga',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Cr88c', sourceListId: 'NTbQ7' },
  },

  fc_song_my_immortal: {
    title: 'My Immortal',
    artist: 'Evanescence',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'qr88c', sourceListId: 'NTbQ7' },
  },

  fc_song_quasi_adagio: {
    title: 'Quasi Adagio',
    artist: 'Béla Bartók',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Tr88c', sourceListId: 'NTbQ7' },
  },

  fc_song_steady_as_a_rock: {
    title: 'Steady As A Rock',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Pr88c', sourceListId: 'NTbQ7' },
  },

  fc_song_ignite: {
    title: 'Ignite',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'gr88c', sourceListId: 'NTbQ7' },
  },

  // --- Rock School Piano 2025 — Grade 2 ---
  fc_song_le_noche_en_havana: {
    title: 'Le Noche En Havana',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'DyT1c', sourceListId: 'bTbQ7' },
  },

  fc_song_cinnamon_roll: {
    title: 'Cinnamon Roll',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'S4T1c', sourceListId: 'bTbQ7' },
  },

  fc_song_are_you_satisfied: {
    title: 'Are You Satisfied?',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'K4T1c', sourceListId: 'bTbQ7' },
  },

  fc_song_blinded_by_your_grace_part_2: {
    title: 'Blinded By Your Grace (Part 2)',
    artist: 'Stormzy',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 's4T1c', sourceListId: 'bTbQ7' },
  },

  fc_song_star_wars_theme: {
    title: 'Star Wars Theme',
    artist: 'John Williams',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'R4T1c', sourceListId: 'bTbQ7' },
  },

  fc_song_skedaddle: {
    title: 'Skedaddle',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'M4T1c', sourceListId: 'bTbQ7' },
  },

  fc_song_pink_pony_club: {
    title: 'Pink Pony Club',
    artist: 'Chappell Roan',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Vlg8c', sourceListId: 'bTbQ7' },
  },

  fc_song_strange_and_beautiful_i_ll_put_a_spell_on_you: {
    title: 'Strange And Beautiful (I\'ll Put A Spell On You)',
    artist: 'Aqualung',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '3lg8c', sourceListId: 'bTbQ7' },
  },

  fc_song_summertime: {
    title: 'Summertime',
    artist: 'George Gershwin',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Tlg8c', sourceListId: 'bTbQ7' },
  },

  fc_song_the_moth: {
    title: 'The Moth',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '8lg8c', sourceListId: 'bTbQ7' },
  },

  fc_song_flowers: {
    title: 'Flowers',
    artist: 'Miley Cyrus',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Llg8c', sourceListId: 'bTbQ7' },
  },

  fc_song_elevator_shoes: {
    title: 'Elevator Shoes',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 2',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '5lg8c', sourceListId: 'bTbQ7' },
  },

  // --- Rock School Piano 2025 — Grade 3 ---
  fc_song_get_going: {
    title: 'Get Going',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'YYT1c', sourceListId: 'fTbQ7' },
  },

  fc_song_contemplation: {
    title: 'Contemplation',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'mwT1c', sourceListId: 'fTbQ7' },
  },

  fc_song_sweetest_bard: {
    title: 'Sweetest Bard',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'FwT1c', sourceListId: 'fTbQ7' },
  },

  fc_song_piano_joint_this_kind_of_love: {
    title: 'Piano Joint (This Kind Of Love)',
    artist: 'Michael Kiwanuka',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'xwT1c', sourceListId: 'fTbQ7' },
  },

  fc_song_romanze_from_sonata_in_g: {
    title: 'Romanze from Sonata in G',
    artist: 'Beethoven (attrib.)',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'WwT1c', sourceListId: 'fTbQ7' },
  },

  fc_song_arcadia: {
    title: 'Arcadia',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'XwT1c', sourceListId: 'fTbQ7' },
  },

  fc_song_oscar_winning_tears: {
    title: 'Oscar Winning Tears',
    artist: 'RAYE',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '5L98c', sourceListId: 'fTbQ7' },
  },

  fc_song_wade_in_the_water: {
    title: 'Wade In The Water',
    artist: 'Traditional',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Zj98c', sourceListId: 'fTbQ7' },
  },

  fc_song_the_lady_of_raynham_hall_from_ghostly_piano_tales: {
    title: 'The Lady Of Raynham Hall (From Ghostly Piano Tales)',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'vj98c', sourceListId: 'fTbQ7' },
  },

  fc_song_lose_control: {
    title: 'Lose Control',
    artist: 'Teddy Swims',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Xzg8c', sourceListId: 'fTbQ7' },
  },

  fc_song_bad_habits: {
    title: 'Bad Habits',
    artist: 'Ed Sheeran',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: 'Zzg8c', sourceListId: 'fTbQ7' },
  },

  fc_song_camden_square: {
    title: 'Camden Square',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 3',
    contentType: 'song',
    tags: ['exam piece', '2025 syllabus'],
    soundslice: { scorehash: '5zg8c', sourceListId: 'fTbQ7' },
  },

  // --- RSL Classical Piano — Grade 1 ---
  fc_song_jupiter: {
    title: 'Jupiter',
    artist: 'Gustav Holst',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'QRR1c', sourceListId: '3sMQ7' },
  },

  fc_song_all_is_found: {
    title: 'All Is Found',
    artist: 'Kristen Anderson-Lopez & Robert Lopez',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'wRR1c', sourceListId: '3sMQ7' },
  },

  fc_song_le_douz_de_decembre: {
    title: 'Le Douz De Decembre',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: '6Br8c', sourceListId: '3sMQ7' },
  },

  fc_song_jasmine_flower_song: {
    title: 'Jasmine Flower Song',
    artist: 'Traditional',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'yZr8c', sourceListId: '3sMQ7' },
  },

  fc_song_the_cuckoo: {
    title: 'The Cuckoo',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'J-Jdc', sourceListId: '3sMQ7' },
  },

  fc_song_soldatenmarsch_soldiers_march_op_68_no_2: {
    title: '‘Soldatenmarsch’ (Soldiers’ March), Op. 68, No. 2',
    artist: 'Robert Schumann',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'F-Jdc', sourceListId: '3sMQ7' },
  },

  fc_song_cat_and_mouse: {
    title: 'Cat And Mouse',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'DQJdc', sourceListId: '3sMQ7' },
  },

  fc_song_minuet_in_g: {
    title: 'Minuet in G',
    artist: 'Petzold (attrib. Bach)',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'wQJdc', sourceListId: '3sMQ7' },
  },

  fc_song_boogie_woogie_bear: {
    title: 'Boogie Woogie Bear',
    artist: 'RSL',
    instruments: ['Piano'],
    level: 'Grade 1',
    contentType: 'song',
    tags: ['exam piece', 'classical'],
    soundslice: { scorehash: 'vQJdc', sourceListId: '3sMQ7' },
  },
};

export default SONGS_CATALOGUE;
