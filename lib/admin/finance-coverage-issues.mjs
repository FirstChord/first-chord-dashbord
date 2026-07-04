import { classifyIssue } from './issues-helpers.mjs';
import { buildIssueId } from './issue-queue-helpers.mjs';
import { FLAG_LABELS } from './finance-coverage.mjs';

export const FINANCE_COVERAGE_ISSUE_TYPE = 'FINANCE DATA GAP';
export const FINANCE_COVERAGE_ISSUE_SOURCE = 'finance_coverage';

// Only the flags that zero a student out of the finance estimate become issues:
// noRevenuePrice / noTutor mean the student's revenue or tutor cost silently
// drops to nothing. noDuration / noSchedule / lowConfidence only degrade
// confidence — the student still prices — so they'd be noise as cards. And
// tutorsNotInPayTable stays informational: genuinely hourly tutors live there.
const ISSUE_WORTHY_FLAGS = new Set(['noRevenuePrice', 'noTutor']);

// Turns buildFinanceCoverage() gaps into Issue Queue records. The source rides
// the system-cleared path: fixing the student data removes the flag, the issue
// stops being emitted, and the queue marks it ready to clear.
export function buildFinanceCoverageIssues(coverage = {}, { testStudentIds = new Set() } = {}) {
  const issues = [];

  for (const row of coverage?.flagged || []) {
    const mmsId = `${row.mmsId || ''}`.trim();
    if (!mmsId || testStudentIds.has(mmsId)) continue;

    const gapFlags = (row.flags || []).filter((flag) => ISSUE_WORTHY_FLAGS.has(flag));
    if (!gapFlags.length) continue;

    const type = FINANCE_COVERAGE_ISSUE_TYPE;
    const source = FINANCE_COVERAGE_ISSUE_SOURCE;
    // contextKey is the student id alone, so a changing flag mix updates the
    // existing card rather than spawning a new one per flag combination.
    const contextKey = mmsId;
    const issueId = buildIssueId({ source, issueType: type, mmsId, contextKey });
    const classification = classifyIssue(type);
    const labels = gapFlags.map((flag) => FLAG_LABELS[flag] || flag);

    issues.push({
      id: issueId,
      issueId,
      source,
      contextKey,
      type,
      mmsId,
      studentName: `${row.name || ''}`.trim() || mmsId,
      detail: `Finance estimate can't price this student: ${labels.join(', ')}.`,
      generatedDate: '',
      severity: classification.severity,
      systemsAffected: classification.systemsAffected,
      summary: classification.summary,
      recommendedAction: classification.recommendedAction,
      actionLabel: classification.actionLabel,
      messageable: classification.messageable,
      // Coverage rows are built from the active sheet roster, so a sheet row
      // always exists for a flagged student.
      hasSheetRow: true,
      hasRegistryEntry: false,
      sheetTutor: `${row.tutor || ''}`.trim(),
      registryTutor: '',
      instrument: '',
      email: '',
      financeCoverage: {
        flags: [...(row.flags || [])],
        flagLabels: [...(row.flagLabels || [])],
        lessonKind: row.lessonKind || '',
        confidence: row.confidence || '',
      },
      active: true,
      adminStudentPath: `/admin/students/${mmsId}`,
    });
  }

  return issues;
}
