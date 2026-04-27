#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dashboardRoot = path.join(__dirname, '..');
const brainTutorsSource = path.join(dashboardRoot, '..', 'first-chord-brain', 'generate_fc_ids.py');
const outputPath = path.join(dashboardRoot, 'lib', 'admin', 'tutors-data.js');

function parseTutorsFromBrain(source) {
  const text = fs.readFileSync(source, 'utf8');
  const tutorsBlockMatch = text.match(/TUTORS\s*=\s*\[([\s\S]*?)\]\n\n#/);

  if (!tutorsBlockMatch) {
    throw new Error('Could not locate TUTORS block in first-chord-brain/generate_fc_ids.py');
  }

  const tutors = [];
  const tutorPattern = /\{\s*"short_name":\s*"([^"]+)",\s*"full_name":\s*"([^"]+)",\s*"mms_teacher_id":\s*"([^"]+)",\s*"instruments":\s*\[([^\]]*)\]\s*\}/g;
  let match;

  while ((match = tutorPattern.exec(tutorsBlockMatch[1])) !== null) {
    const [, shortName, fullName, teacherId, instrumentsText] = match;
    const instruments = [...instrumentsText.matchAll(/"([^"]+)"/g)].map((instrumentMatch) => instrumentMatch[1]);

    tutors.push({
      shortName,
      fullName,
      teacherId,
      instruments,
    });
  }

  if (tutors.length === 0) {
    throw new Error('No tutors were parsed from the Brain TUTORS list');
  }

  return tutors.sort((a, b) => a.shortName.localeCompare(b.shortName, 'en'));
}

function buildOutput(tutors) {
  const rows = tutors.map((tutor) => {
    const instruments = tutor.instruments.map((instrument) => `'${instrument}'`).join(', ');
    return `  '${tutor.shortName}': {\n    fullName: '${tutor.fullName}',\n    teacherId: '${tutor.teacherId}',\n    instruments: [${instruments}],\n  },`;
  });

  return `// GENERATED — do not edit directly. Run: npm run sync-admin-tutors to regenerate.\n// Source: ../first-chord-brain/generate_fc_ids.py TUTORS list\n\nexport const ADMIN_TUTORS = {\n${rows.join('\n')}\n};\n`;
}

const tutors = parseTutorsFromBrain(brainTutorsSource);
fs.writeFileSync(outputPath, buildOutput(tutors), 'utf8');
console.log(`Synced ${tutors.length} tutors into lib/admin/tutors-data.js`);
