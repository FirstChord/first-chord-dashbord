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
  let expectedActionable = 0;
  let harmfulAutoArchives = 0;

  for (const message of messages) {
    const predicted = classify(message.text).category;
    const expected = message.label;
    const exact = predicted === expected;
    const sameFamily = exact || (ABSENCE_FAMILY.has(predicted) && ABSENCE_FAMILY.has(expected));
    // "Actionable" = anything that isn't noise; getting general-vs-specific
    // right is what keeps the inbox calm.
    const actionable = (predicted === 'general') === (expected === 'general');
    if (expected !== 'general') {
      expectedActionable += 1;
      if (predicted === 'general') harmfulAutoArchives += 1;
    }

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
    expectedActionable,
    harmfulAutoArchives,
    exactAccuracy: exactCorrect / total,
    familyAccuracy: familyCorrect / total,
    actionableAccuracy: actionableCorrect / total,
    harmfulAutoArchiveRate: harmfulAutoArchives / (expectedActionable || 1),
    perLabel,
    misses,
  };
}

export function scoreIncomingDateExtraction(messages = [], extract) {
  const cases = messages.filter((message) => message.expectedDates);
  const misses = [];
  let exactCorrect = 0;

  for (const message of cases) {
    const actual = extract(message.text, {
      referenceDate: new Date(`${message.referenceDate}T12:00:00.000Z`),
    });
    const expected = message.expectedDates;
    const exact = actual.startDate === expected.startDate
      && actual.returnDate === expected.returnDate;
    if (exact) {
      exactCorrect += 1;
    } else {
      misses.push({
        id: message.id,
        expected,
        actual: {
          startDate: actual.startDate || '',
          returnDate: actual.returnDate || '',
        },
      });
    }
  }

  return {
    total: cases.length,
    exactCorrect,
    exactAccuracy: exactCorrect / (cases.length || 1),
    misses,
  };
}

// The live proposal layer does not exist yet. This scorer lets a future model
// or deterministic baseline be measured against synthetic ambiguity cases
// without placing a provider call in CI. `propose` returns only its proposed
// abstention and ambiguity flags.
export function scoreIncomingProposalAbstention(cases = [], propose) {
  const misses = [];
  let abstentionCorrect = 0;
  let ambiguityFlagsCorrect = 0;

  for (const testCase of cases) {
    const actual = propose(testCase);
    const expected = testCase.expected || {};
    const actualFlags = new Set(actual?.ambiguityFlags || []);
    const expectedFlags = expected.ambiguityFlags || [];
    const abstentionMatches = Boolean(actual?.mustAbstain) === Boolean(expected.mustAbstain);
    const flagsMatch = expectedFlags.every((flag) => actualFlags.has(flag));

    if (abstentionMatches) abstentionCorrect += 1;
    if (flagsMatch) ambiguityFlagsCorrect += 1;
    if (!abstentionMatches || !flagsMatch) {
      misses.push({
        id: testCase.id,
        expected,
        actual: {
          mustAbstain: Boolean(actual?.mustAbstain),
          ambiguityFlags: [...actualFlags],
        },
      });
    }
  }

  return {
    total: cases.length,
    abstentionCorrect,
    ambiguityFlagsCorrect,
    abstentionAccuracy: abstentionCorrect / (cases.length || 1),
    ambiguityFlagsAccuracy: ambiguityFlagsCorrect / (cases.length || 1),
    misses,
  };
}
