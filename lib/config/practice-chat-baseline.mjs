/**
 * @fileoverview How long a lesson note took **before** Practice Chat, and what
 * transcription costs.
 *
 * Both exist to turn a duration into a claim. "The ritual takes 92 seconds" is
 * a fact about the tool; "it saves two and a half minutes a lesson, which is
 * eight hours a week across the school" is a fact about the school, and only
 * the second one is worth anything to anybody. The difference between them is
 * the baseline below.
 *
 * **The baseline is hand-measured and cannot be recovered later.** Once the
 * ritual is habitual there is no clean way back to how long the old way took,
 * so it is collected once, by stopwatch, and pasted in here. An empty list is
 * honest and stays honest: every time-saved figure reports "no baseline
 * recorded" rather than assuming one.
 */

/**
 * Hand-timed manual lesson notes, in seconds.
 *
 * ## How to collect these
 *
 * Write ~10 lesson notes the way you did before Practice Chat — straight into
 * MyMusicStaff — and time each one from opening the note field to the note
 * being finished and sent. Include the whole job: thinking what to write,
 * typing it, checking it, sending it. Stop the clock when a parent could read
 * it, because that is the point Practice Chat is also measured to.
 *
 * Three things that would quietly ruin the number:
 *
 * - **Don't time your best ten.** A note written while you still remember the
 *   lesson perfectly is not the average note. Take them as they come, including
 *   the one at the end of a long day.
 * - **Don't time notes you already drafted in Practice Chat.** That is not a
 *   baseline, it is the ritual with extra steps.
 * - **Don't round.** Ten honest times with a spread beats ten tidy ones.
 *
 * Then paste the seconds here, oldest first, and record when and by whom in
 * BASELINE_NOTE. Ten is plenty; five is enough to be worth having.
 *
 * @type {number[]}
 */
export const MANUAL_NOTE_SECONDS = [];

// Who measured the baseline, when, and anything that would change how it reads
// (a tutor much faster than average, an unusually chatty week). Shown alongside
// every derived figure so nobody quotes the saving without its provenance.
export const BASELINE_NOTE = '';

/**
 * What transcription costs, per minute of audio sent, in USD.
 *
 * Keyed on the model actually recorded against each session, so a trial that
 * switches models re-prices itself instead of silently reporting the old rate.
 *
 * **Only whisper-1 has a clean per-minute price.** The gpt-4o transcribe models
 * are token-priced ($2.50/M audio input tokens), and converting that to minutes
 * needs a tokens-per-second figure this repo does not have. Rather than invent
 * a conversion and print a confident wrong number, unpriced models return no
 * cost at all — the same "blank is meaningful" rule the note lanes use. If a
 * trial runs on one of them, measure the real spend from the OpenAI dashboard
 * over a known set of sessions and add the rate here.
 */
export const ASR_COST_PER_MINUTE_USD = {
  'whisper-1': 0.006,
};

/**
 * Median seconds for a manually written note, or null when none were measured.
 *
 * Median rather than mean: one note interrupted by a phone call would drag a
 * mean well past anything typical, and with ten samples there is no room for
 * that to average out.
 */
export function medianManualNoteSeconds(samples = MANUAL_NOTE_SECONDS) {
  const values = (Array.isArray(samples) ? samples : [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : Math.round((values[middle - 1] + values[middle]) / 2);
}
