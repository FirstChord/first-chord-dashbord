// Scoring for the incoming-message classifier against a labelled fixture.
// Shared by the eval test (which pins accuracy floors) and the report script
// (scripts/eval-incoming-classifier.mjs). Pure.

// All absence categories put the message in front of the same reviewer with
// the same convert path, so a within-family miss is a wording nuance rather
// than a workflow error — scored separately from exact accuracy.
export const ABSENCE_FAMILY = new Set(['one_off_absence', 'extended_absence', 'summer_break', 'absence_pause']);

export function scoreIncomingClassifier(messages = [], classify) {
  const perLabel = {};
  const misses = [];
  let exactCorrect = 0;
  let familyCorrect = 0;
  let actionableCorrect = 0;

  for (const message of messages) {
    const predicted = classify(message.text).category;
    const expected = message.label;
    const exact = predicted === expected;
    const sameFamily = exact || (ABSENCE_FAMILY.has(predicted) && ABSENCE_FAMILY.has(expected));
    // "Actionable" = anything that isn't noise; getting general-vs-specific
    // right is what keeps the inbox calm.
    const actionable = (predicted === 'general') === (expected === 'general');

    perLabel[expected] = perLabel[expected] || { total: 0, correct: 0 };
    perLabel[expected].total += 1;
    if (exact) {
      perLabel[expected].correct += 1;
      exactCorrect += 1;
    } else {
      misses.push({ id: message.id, expected, predicted, sameFamily, text: message.text });
    }
    if (sameFamily) familyCorrect += 1;
    if (actionable) actionableCorrect += 1;
  }

  const total = messages.length || 1;
  return {
    total: messages.length,
    exactCorrect,
    familyCorrect,
    actionableCorrect,
    exactAccuracy: exactCorrect / total,
    familyAccuracy: familyCorrect / total,
    actionableAccuracy: actionableCorrect / total,
    perLabel,
    misses,
  };
}
