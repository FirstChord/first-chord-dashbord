#!/usr/bin/env node

/**
 * Enhanced Migration Script: Extract tutor assignments from comments
 *
 * This reads the existing soundslice-mappings.js file which has clear
 * tutor sections and assigns tutors to each student.
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Enhanced migration with tutor detection...\n');

/**
 * Extract tutor-to-students mapping from soundslice file
 */
function extractTutorMappings() {
  const content = fs.readFileSync(
    path.join(__dirname, '..', 'lib/soundslice-mappings.js'),
    'utf8'
  );

  const tutorMap = {};
  let currentTutor = null;

  const lines = content.split('\n');

  for (const line of lines) {
    // Match tutor section comments: // Kenny's students
    const tutorMatch = line.match(/\/\/\s*([A-Z][a-zé]+)'s students/);
    if (tutorMatch) {
      currentTutor = tutorMatch[1];
      continue;
    }

    // Match student entries: 'sdt_XXXXXX': 'url', // Name
    const studentMatch = line.match(/'(sdt_\w+)':/);
    if (studentMatch && currentTutor) {
      const studentId = studentMatch[1];
      tutorMap[studentId] = currentTutor;
    }
  }

  return tutorMap;
}

/**
 * Main execution
 */
function main() {
  try {
    console.log('📂 Reading existing student registry...');

    const registryPath = path.join(__dirname, '..', 'lib/config/students-registry.js');
    const registryContent = fs.readFileSync(registryPath, 'utf8');

    console.log('🔍 Detecting tutor assignments from soundslice file...');
    const tutorMap = extractTutorMappings();

    console.log(`✓ Found tutor assignments for ${Object.keys(tutorMap).length} students\n`);

    // Show tutor distribution
    const tutorCounts = {};
    Object.values(tutorMap).forEach(tutor => {
      tutorCounts[tutor] = (tutorCounts[tutor] || 0) + 1;
    });

    console.log('📊 Students per tutor:');
    Object.entries(tutorCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([tutor, count]) => {
        console.log(`   ${tutor}: ${count} students`);
      });

    console.log('\n💾 Updating registry with tutor assignments...');

    // Parse the registry and add tutors
    let updatedContent = registryContent;

    Object.entries(tutorMap).forEach(([studentId, tutor]) => {
      // Find the student entry and add tutor line after friendlyUrl
      const studentPattern = new RegExp(
        `('${studentId}':\\s*\\{[\\s\\S]*?friendlyUrl:\\s*'[^']*',)`,
        'g'
      );

      updatedContent = updatedContent.replace(studentPattern, (match) => {
        // Check if tutor already exists
        if (match.includes(`tutor:`)) {
          return match;
        }
        return `${match}\n    tutor: '${tutor}',`;
      });
    });

    fs.writeFileSync(registryPath, updatedContent, 'utf8');

    console.log('✅ Registry updated with tutor assignments!\n');
    console.log(`📄 Updated: lib/config/students-registry.js`);
    console.log(`📊 Added tutors for ${Object.keys(tutorMap).length} students\n`);

  } catch (error) {
    console.error('❌ Enhancement failed:', error.message);
    process.exit(1);
  }
}

main();
