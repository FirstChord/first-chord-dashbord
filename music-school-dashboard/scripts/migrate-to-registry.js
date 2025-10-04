#!/usr/bin/env node

/**
 * Migration Script: Convert 5 Config Files → Single Student Registry
 *
 * This script reads the existing 5 config files and creates a unified
 * students-registry.js file with all student data in one place.
 *
 * Run: node scripts/migrate-to-registry.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Starting migration to student registry...\n');

/**
 * Read and parse a config file
 */
function readConfigFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Extract student URL mappings
 */
function extractUrlMappings() {
  const content = readConfigFile('lib/student-url-mappings.js');
  const mappingsMatch = content.match(/export const STUDENT_URL_MAPPINGS = \{([\s\S]*?)\};/);

  if (!mappingsMatch) {
    throw new Error('Could not extract STUDENT_URL_MAPPINGS');
  }

  const mappingsText = mappingsMatch[1];
  const entries = {};

  // Match: 'friendlyUrl': 'sdt_XXXXXX', // Name
  const regex = /'([^']+)':\s*'(sdt_\w+)',?\s*(?:\/\/\s*(.+))?/g;
  let match;

  while ((match = regex.exec(mappingsText)) !== null) {
    const [, friendlyUrl, studentId, comment] = match;
    entries[studentId] = {
      friendlyUrl,
      fullName: comment ? comment.trim() : '',
    };
  }

  return entries;
}

/**
 * Extract security whitelist
 */
function extractWhitelist() {
  const content = readConfigFile('lib/student-helpers.js');
  const whitelistMatch = content.match(/const VALID_STUDENT_IDS = \[([\s\S]*?)\];/);

  if (!whitelistMatch) {
    throw new Error('Could not extract VALID_STUDENT_IDS');
  }

  const whitelistText = whitelistMatch[1];
  const ids = whitelistText.match(/'sdt_\w+'/g);

  return ids ? ids.map(id => id.replace(/'/g, '')) : [];
}

/**
 * Extract Soundslice mappings
 */
function extractSoundslice() {
  const content = readConfigFile('lib/soundslice-mappings.js');
  const mappingsMatch = content.match(/const SOUNDSLICE_MAPPINGS = \{([\s\S]*?)\};/);

  if (!mappingsMatch) {
    throw new Error('Could not extract SOUNDSLICE_MAPPINGS');
  }

  const mappingsText = mappingsMatch[1];
  const entries = {};

  // Match: 'sdt_XXXXXX': 'https://...', // Name
  const regex = /'(sdt_\w+)':\s*'([^']+)',?/g;
  let match;

  while ((match = regex.exec(mappingsText)) !== null) {
    const [, studentId, url] = match;
    entries[studentId] = url;
  }

  return entries;
}

/**
 * Extract Theta credentials
 */
function extractTheta() {
  const content = readConfigFile('lib/config/theta-credentials.js');
  const credentialsMatch = content.match(/export const thetaCredentials = \{([\s\S]*?)\};/);

  if (!credentialsMatch) {
    throw new Error('Could not extract thetaCredentials');
  }

  const credentialsText = credentialsMatch[1];
  const entries = {};

  // Match: 'sdt_XXXXXX': 'usernamefc', // Name
  const regex = /'(sdt_\w+)':\s*'([^']+)',?/g;
  let match;

  while ((match = regex.exec(credentialsText)) !== null) {
    const [, studentId, username] = match;
    entries[studentId] = username;
  }

  return entries;
}

/**
 * Extract instrument overrides
 */
function extractInstruments() {
  const content = readConfigFile('lib/config/instruments.js');
  const instrumentsMatch = content.match(/export const instrumentOverrides = \{([\s\S]*?)\};/);

  if (!instrumentsMatch) {
    throw new Error('Could not extract instrumentOverrides');
  }

  const instrumentsText = instrumentsMatch[1];
  const entries = {};

  // Match: 'sdt_XXXXXX': 'Piano', // Name
  const regex = /'(sdt_\w+)':\s*'([^']+)',?/g;
  let match;

  while ((match = regex.exec(instrumentsText)) !== null) {
    const [, studentId, instrument] = match;
    entries[studentId] = instrument;
  }

  return entries;
}

/**
 * Detect tutor sections from files
 */
function detectTutorSections() {
  const content = readConfigFile('lib/soundslice-mappings.js');
  const tutorSections = [];

  // Match comments like: // Kenny's students
  const regex = /\/\/\s*([A-Z][a-z]+)'s students/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    tutorSections.push(match[1]);
  }

  return tutorSections;
}

/**
 * Parse full name into first and last name
 */
function parseFullName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  return { firstName, lastName };
}

/**
 * Build the complete student registry
 */
function buildRegistry() {
  console.log('📂 Reading existing config files...');

  const urlMappings = extractUrlMappings();
  const whitelist = extractWhitelist();
  const soundslice = extractSoundslice();
  const theta = extractTheta();
  const instruments = extractInstruments();

  console.log(`✓ Found ${Object.keys(urlMappings).length} students in URL mappings`);
  console.log(`✓ Found ${whitelist.length} students in whitelist`);
  console.log(`✓ Found ${Object.keys(soundslice).length} Soundslice entries`);
  console.log(`✓ Found ${Object.keys(theta).length} Theta entries`);
  console.log(`✓ Found ${Object.keys(instruments).length} instrument entries\n`);

  console.log('🔨 Building student registry...');

  const registry = {};

  // Build registry from all whitelisted students
  whitelist.forEach(studentId => {
    const urlData = urlMappings[studentId];
    const { firstName, lastName } = parseFullName(urlData?.fullName || '');

    registry[studentId] = {
      firstName: firstName || 'Unknown',
      lastName: lastName || '',
      friendlyUrl: urlData?.friendlyUrl || '',
      tutor: '', // Will need manual assignment or smart detection
      instrument: instruments[studentId] || null,
      soundsliceUrl: soundslice[studentId] || null,
      thetaUsername: theta[studentId] || null,
    };
  });

  console.log(`✓ Built registry with ${Object.keys(registry).length} students\n`);

  return registry;
}

/**
 * Generate the registry file content
 */
function generateRegistryFile(registry) {
  let output = `/**
 * Student Registry - Single Source of Truth
 *
 * This file contains ALL student data in one place.
 * Use \`npm run generate-configs\` to auto-generate the 5 config files from this registry.
 *
 * Last generated: ${new Date().toISOString().split('T')[0]}
 * Total students: ${Object.keys(registry).length}
 */

export const STUDENTS_REGISTRY = {\n`;

  // Sort by student ID for consistency
  const sortedIds = Object.keys(registry).sort();

  sortedIds.forEach((studentId, index) => {
    const student = registry[studentId];
    const { firstName, lastName, friendlyUrl, tutor, instrument, soundsliceUrl, thetaUsername } = student;

    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    output += `  '${studentId}': {\n`;
    output += `    firstName: '${firstName}',\n`;
    if (lastName) {
      output += `    lastName: '${lastName}',\n`;
    }
    output += `    friendlyUrl: '${friendlyUrl}',\n`;
    if (tutor) {
      output += `    tutor: '${tutor}',\n`;
    }
    if (instrument) {
      output += `    instrument: '${instrument}',\n`;
    }
    if (soundsliceUrl) {
      output += `    soundsliceUrl: '${soundsliceUrl}',\n`;
    }
    if (thetaUsername) {
      output += `    thetaUsername: '${thetaUsername}',\n`;
    }
    output += `  }, // ${fullName}\n`;

    if (index < sortedIds.length - 1) {
      output += '\n';
    }
  });

  output += `};\n`;

  return output;
}

/**
 * Main execution
 */
function main() {
  try {
    const registry = buildRegistry();
    const fileContent = generateRegistryFile(registry);

    const outputPath = path.join(__dirname, '..', 'lib', 'config', 'students-registry.js');

    console.log('💾 Writing registry file...');
    fs.writeFileSync(outputPath, fileContent, 'utf8');

    console.log(`✅ Migration complete!\n`);
    console.log(`📄 Created: lib/config/students-registry.js`);
    console.log(`📊 Total students: ${Object.keys(registry).length}\n`);
    console.log(`⚠️  Note: Tutor assignments need to be added manually or via tutor detection.`);
    console.log(`    Review the generated file and add tutor names where needed.\n`);
    console.log(`Next steps:`);
    console.log(`1. Review lib/config/students-registry.js`);
    console.log(`2. Add missing tutor assignments`);
    console.log(`3. Run: node scripts/generate-configs.js (when ready)`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
