const TEST_FLAG_KEYS = [
  'isTestStudent',
  'is_test_student',
  'test_student',
  'Test Student',
  'Is Test Student',
];

export function normaliseTestStudentFlag(value) {
  if (value === true) {
    return true;
  }

  const text = `${value ?? ''}`.trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'test'].includes(text);
}

function readFlagFromObject(record = {}) {
  for (const key of TEST_FLAG_KEYS) {
    if (normaliseTestStudentFlag(record?.[key])) {
      return true;
    }
  }

  return false;
}

export function isTestStudentRecord(record = {}) {
  return Boolean(
    readFlagFromObject(record)
    || readFlagFromObject(record.raw)
    || readFlagFromObject(record.registry)
    || readFlagFromObject(record.registryEntry)
  );
}

export function buildTestStudentIdSet(students = [], registryEntries = []) {
  const ids = new Set();

  for (const entry of registryEntries) {
    if (entry?.mmsId && isTestStudentRecord(entry)) {
      ids.add(entry.mmsId);
    }
  }

  for (const student of students) {
    if (!student?.mmsId) {
      continue;
    }

    const registryEntry = registryEntries.find((entry) => entry.mmsId === student.mmsId) || null;
    if (isTestStudentRecord({ ...student, registry: registryEntry, registryEntry })) {
      ids.add(student.mmsId);
    }
  }

  return ids;
}

export function filterOperationalStudents(students = []) {
  return students.filter((student) => !isTestStudentRecord(student));
}
