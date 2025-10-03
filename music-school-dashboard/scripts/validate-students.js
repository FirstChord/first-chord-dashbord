#!/usr/bin/env node

/**
 * Music School Dashboard - Student Data Validation Script
 *
 * This script validates the consistency and quality of student configuration data
 * across all 5 config files plus dashboard configuration.
 *
 * Run: npm run validate
 *
 * Exit codes:
 * - 0: All checks passed (warnings OK)
 * - 1: Errors found (must fix before deploying)
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper functions for colored output
const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`),
};

// Counters for summary
const stats = {
  errors: [],
  warnings: [],
  checks: 0,
};

/**
 * Extract exports from a JavaScript file
 */
function extractExportsFromFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Extract exported objects using regex
    const result = {};

    // Match: export const NAME = { ... }
    const constExportMatch = content.match(/export\s+const\s+(\w+)\s*=\s*(\{[\s\S]*?\n\});/);
    if (constExportMatch) {
      const varName = constExportMatch[1];
      const objContent = constExportMatch[2];
      try {
        result[varName] = eval(`(${objContent})`);
      } catch (e) {
        // If eval fails, try to parse manually
      }
    }

    // Match: const NAME = { ... }; export default NAME;
    const defaultExportMatch = content.match(/const\s+(\w+)\s*=\s*(\{[\s\S]*?\n\});[\s\S]*?export\s+default\s+\1/);
    if (defaultExportMatch) {
      const objContent = defaultExportMatch[2];
      try {
        result.default = eval(`(${objContent})`);
      } catch (e) {
        // If eval fails, try to parse manually
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract student IDs from a config object
 */
function extractStudentIds(configObj) {
  if (Array.isArray(configObj)) {
    return configObj;
  }
  return Object.keys(configObj).filter(key => key.startsWith('sdt_'));
}

/**
 * Extract friendly URLs from student-url-mappings
 */
function extractFriendlyUrls(mappings) {
  return Object.keys(mappings);
}

/**
 * Load all configuration files
 */
function loadAllConfigs() {
  log.section('📂 Loading Configuration Files...');

  const configs = {
    urlMappings: null,
    helpers: null,
    soundslice: null,
    theta: null,
    instruments: null,
  };

  // Load student-url-mappings.js
  const urlMappingsModule = extractExportsFromFile('lib/student-url-mappings.js');
  if (urlMappingsModule) {
    configs.urlMappings = urlMappingsModule.STUDENT_URL_MAPPINGS || urlMappingsModule.default;
    if (configs.urlMappings) {
      log.success(`Loaded student-url-mappings.js: ${Object.keys(configs.urlMappings).length} entries`);
    }
  }

  // Load student-helpers.js
  // Extract VALID_STUDENT_IDS from the file manually
  const helpersContent = fs.readFileSync(path.join(__dirname, '..', 'lib/student-helpers.js'), 'utf8');
  const validIdsMatch = helpersContent.match(/const VALID_STUDENT_IDS = \[([\s\S]*?)\];/);
  if (validIdsMatch) {
    const idsString = validIdsMatch[1];
    const matches = idsString.match(/'sdt_\w+'/g);
    if (matches) {
      configs.helpers = matches.map(id => id.replace(/'/g, ''));
      log.success(`Loaded student-helpers.js: ${configs.helpers.length} whitelisted IDs`);
    }
  }

  // Load soundslice-mappings.js
  const soundsliceModule = extractExportsFromFile('lib/soundslice-mappings.js');
  if (soundsliceModule) {
    configs.soundslice = soundsliceModule.default || soundsliceModule.SOUNDSLICE_MAPPINGS;
    if (configs.soundslice) {
      log.success(`Loaded soundslice-mappings.js: ${Object.keys(configs.soundslice).length} entries`);
    }
  }

  // Load theta-credentials.js
  const thetaModule = extractExportsFromFile('lib/config/theta-credentials.js');
  if (thetaModule) {
    configs.theta = thetaModule.thetaCredentials || thetaModule.default;
    if (configs.theta) {
      log.success(`Loaded theta-credentials.js: ${Object.keys(configs.theta).length} entries`);
    }
  }

  // Load instruments.js
  const instrumentsModule = extractExportsFromFile('lib/config/instruments.js');
  if (instrumentsModule) {
    configs.instruments = instrumentsModule.instrumentOverrides || instrumentsModule.default;
    if (configs.instruments) {
      log.success(`Loaded instruments.js: ${Object.keys(configs.instruments).length} entries`);
    }
  }

  return configs;
}

/**
 * Check for duplicate values in an array
 */
function findDuplicates(arr, label) {
  const seen = new Map();
  const duplicates = [];

  arr.forEach(item => {
    if (seen.has(item)) {
      seen.set(item, seen.get(item) + 1);
      if (seen.get(item) === 2) {
        duplicates.push(item);
      }
    } else {
      seen.set(item, 1);
    }
  });

  return duplicates;
}

/**
 * Validate student ID format
 */
function isValidStudentId(id) {
  return /^sdt_[A-Za-z0-9]{6}$/.test(id);
}

/**
 * Validate friendly URL format
 */
function isValidFriendlyUrl(url) {
  return /^[a-z]+(-[a-z])?$/.test(url);
}

/**
 * Validate Soundslice URL format
 */
function isValidSoundsliceUrl(url) {
  return /^https:\/\/www\.soundslice\.com\/courses\/\d+\/$/.test(url);
}

/**
 * Validate Theta credentials format
 */
function isValidThetaCredential(cred) {
  // Allow both 'namefc' and 'namefirstchord' formats
  return /^[a-z\s&]+(fc|firstchord)$/i.test(cred);
}

/**
 * Validate instrument value
 */
function isValidInstrument(instrument) {
  const validInstruments = [
    'Piano', 'Guitar', 'Voice', 'Bass', 'Drums',
    'Piano / Guitar', 'Piano / Voice', 'Guitar / Voice'
  ];
  return validInstruments.includes(instrument);
}

/**
 * Run all validation checks
 */
function runValidations(configs) {
  log.section('🔍 Running Validation Checks...');

  const { urlMappings, helpers, soundslice, theta, instruments } = configs;

  if (!urlMappings || !helpers) {
    stats.errors.push('Critical config files missing - cannot continue validation');
    return;
  }

  // Extract data for comparison
  const friendlyUrls = extractFriendlyUrls(urlMappings);
  const mappingStudentIds = Object.values(urlMappings);
  const whitelistedIds = helpers;
  const soundsliceIds = soundslice ? Object.keys(soundslice) : [];
  const thetaIds = theta ? Object.keys(theta) : [];
  const instrumentIds = instruments ? Object.keys(instruments) : [];

  // Check 1: Duplicate friendly URLs
  stats.checks++;
  const duplicateUrls = findDuplicates(friendlyUrls, 'friendly URLs');
  if (duplicateUrls.length > 0) {
    stats.errors.push(`Duplicate friendly URLs found: ${duplicateUrls.join(', ')}`);
    duplicateUrls.forEach(url => {
      log.error(`Duplicate URL: '${url}' - must be unique`);
    });
  } else {
    log.success('No duplicate friendly URLs');
  }

  // Check 2: Duplicate student IDs in mappings
  stats.checks++;
  const duplicateIds = findDuplicates(mappingStudentIds, 'student IDs in mappings');
  if (duplicateIds.length > 0) {
    stats.errors.push(`Duplicate student IDs in URL mappings: ${duplicateIds.join(', ')}`);
    duplicateIds.forEach(id => {
      log.error(`Duplicate student ID: '${id}' - maps to multiple URLs`);
    });
  } else {
    log.success('No duplicate student IDs in URL mappings');
  }

  // Check 3: All mapped students are whitelisted
  stats.checks++;
  const notWhitelisted = mappingStudentIds.filter(id => !whitelistedIds.includes(id));
  if (notWhitelisted.length > 0) {
    stats.errors.push(`${notWhitelisted.length} students in URL mappings but not in security whitelist`);
    log.error(`Students not in whitelist (${notWhitelisted.length}):`);
    notWhitelisted.slice(0, 5).forEach(id => {
      const url = Object.keys(urlMappings).find(key => urlMappings[key] === id);
      console.log(`  - ${id} (${url})`);
    });
    if (notWhitelisted.length > 5) {
      console.log(`  ... and ${notWhitelisted.length - 5} more`);
    }
  } else {
    log.success('All mapped students are in security whitelist');
  }

  // Check 4: All whitelisted students have URL mappings
  stats.checks++;
  const notMapped = whitelistedIds.filter(id => !mappingStudentIds.includes(id));
  if (notMapped.length > 0) {
    stats.warnings.push(`${notMapped.length} students in whitelist but not in URL mappings`);
    log.warning(`Students whitelisted but not mapped (${notMapped.length}):`);
    notMapped.slice(0, 5).forEach(id => {
      console.log(`  - ${id}`);
    });
    if (notMapped.length > 5) {
      console.log(`  ... and ${notMapped.length - 5} more`);
    }
  } else {
    log.success('All whitelisted students have URL mappings');
  }

  // Check 5: Student ID format validation
  stats.checks++;
  const invalidIds = mappingStudentIds.filter(id => !isValidStudentId(id));
  if (invalidIds.length > 0) {
    stats.errors.push(`${invalidIds.length} invalid student ID formats`);
    log.error(`Invalid student ID format (should be sdt_XXXXXX):`);
    invalidIds.forEach(id => {
      console.log(`  - ${id}`);
    });
  } else {
    log.success('All student IDs have valid format');
  }

  // Check 6: Friendly URL format validation
  stats.checks++;
  const invalidUrls = friendlyUrls.filter(url => !isValidFriendlyUrl(url));
  if (invalidUrls.length > 0) {
    stats.warnings.push(`${invalidUrls.length} friendly URLs don't follow naming convention`);
    log.warning(`Friendly URLs with non-standard format (${invalidUrls.length}):`);
    invalidUrls.slice(0, 10).forEach(url => {
      console.log(`  - '${url}'`);
    });
    if (invalidUrls.length > 10) {
      console.log(`  ... and ${invalidUrls.length - 10} more`);
    }
  } else {
    log.success('All friendly URLs follow naming convention');
  }

  // Check 7: Soundslice coverage
  if (soundslice) {
    stats.checks++;
    const missingSoundslice = mappingStudentIds.filter(id => !soundsliceIds.includes(id));
    if (missingSoundslice.length > 0) {
      stats.warnings.push(`${missingSoundslice.length} students missing Soundslice courses`);
      log.warning(`Students without Soundslice: ${missingSoundslice.length} (this may be intentional)`);
    } else {
      log.success('All students have Soundslice courses configured');
    }

    // Check Soundslice URL formats
    stats.checks++;
    const invalidSoundsliceUrls = [];
    Object.entries(soundslice).forEach(([id, url]) => {
      if (!isValidSoundsliceUrl(url)) {
        invalidSoundsliceUrls.push({ id, url });
      }
    });
    if (invalidSoundsliceUrls.length > 0) {
      stats.errors.push(`${invalidSoundsliceUrls.length} invalid Soundslice URL formats`);
      log.error(`Invalid Soundslice URLs:`);
      invalidSoundsliceUrls.slice(0, 5).forEach(({ id, url }) => {
        console.log(`  - ${id}: ${url}`);
      });
      if (invalidSoundsliceUrls.length > 5) {
        console.log(`  ... and ${invalidSoundsliceUrls.length - 5} more`);
      }
    } else {
      log.success('All Soundslice URLs have valid format');
    }
  }

  // Check 8: Theta credentials coverage
  if (theta) {
    stats.checks++;
    const missingTheta = mappingStudentIds.filter(id => !thetaIds.includes(id));
    if (missingTheta.length > 0) {
      stats.warnings.push(`${missingTheta.length} students missing Theta credentials`);
      log.warning(`Students without Theta Music: ${missingTheta.length} (this may be intentional)`);
    } else {
      log.success('All students have Theta Music credentials');
    }

    // Check Theta credential formats
    stats.checks++;
    const invalidTheta = [];
    Object.entries(theta).forEach(([id, cred]) => {
      if (!isValidThetaCredential(cred)) {
        invalidTheta.push({ id, cred });
      }
    });
    if (invalidTheta.length > 0) {
      stats.errors.push(`${invalidTheta.length} invalid Theta credential formats`);
      log.error(`Invalid Theta credentials:`);
      invalidTheta.slice(0, 5).forEach(({ id, cred }) => {
        console.log(`  - ${id}: ${cred}`);
      });
      if (invalidTheta.length > 5) {
        console.log(`  ... and ${invalidTheta.length - 5} more`);
      }
    } else {
      log.success('All Theta credentials have valid format');
    }
  }

  // Check 9: Instrument overrides
  if (instruments) {
    stats.checks++;
    const missingInstruments = mappingStudentIds.filter(id => !instrumentIds.includes(id));
    if (missingInstruments.length > 0) {
      stats.warnings.push(`${missingInstruments.length} students missing instrument overrides`);
      log.warning(`Students without instrument overrides: ${missingInstruments.length} (will use MMS data)`);
    } else {
      log.success('All students have instrument overrides');
    }

    // Check instrument values
    stats.checks++;
    const invalidInstruments = [];
    Object.entries(instruments).forEach(([id, instrument]) => {
      if (!isValidInstrument(instrument)) {
        invalidInstruments.push({ id, instrument });
      }
    });
    if (invalidInstruments.length > 0) {
      stats.warnings.push(`${invalidInstruments.length} non-standard instrument values`);
      log.warning(`Non-standard instruments:`);
      invalidInstruments.slice(0, 5).forEach(({ id, instrument }) => {
        console.log(`  - ${id}: ${instrument}`);
      });
      if (invalidInstruments.length > 5) {
        console.log(`  ... and ${invalidInstruments.length - 5} more`);
      }
    } else {
      log.success('All instruments use standard values');
    }
  }

  // Check 10: Orphaned entries in secondary files
  stats.checks++;
  let orphanedCount = 0;

  if (soundslice) {
    const orphanedSoundslice = soundsliceIds.filter(id => !mappingStudentIds.includes(id));
    if (orphanedSoundslice.length > 0) {
      stats.warnings.push(`${orphanedSoundslice.length} Soundslice entries for non-existent students`);
      log.warning(`Orphaned Soundslice entries: ${orphanedSoundslice.length}`);
      orphanedCount += orphanedSoundslice.length;
    }
  }

  if (theta) {
    const orphanedTheta = thetaIds.filter(id => !mappingStudentIds.includes(id));
    if (orphanedTheta.length > 0) {
      stats.warnings.push(`${orphanedTheta.length} Theta entries for non-existent students`);
      log.warning(`Orphaned Theta entries: ${orphanedTheta.length}`);
      orphanedCount += orphanedTheta.length;
    }
  }

  if (instruments) {
    const orphanedInstruments = instrumentIds.filter(id => !mappingStudentIds.includes(id));
    if (orphanedInstruments.length > 0) {
      stats.warnings.push(`${orphanedInstruments.length} instrument entries for non-existent students`);
      log.warning(`Orphaned instrument entries: ${orphanedInstruments.length}`);
      orphanedCount += orphanedInstruments.length;
    }
  }

  if (orphanedCount === 0) {
    log.success('No orphaned entries in secondary config files');
  }
}

/**
 * Print summary
 */
function printSummary() {
  log.header('━'.repeat(60));
  log.section('📊 Validation Summary');

  console.log(`\nTotal checks run: ${colors.bright}${stats.checks}${colors.reset}`);
  console.log(`Errors found: ${stats.errors.length > 0 ? colors.red : colors.green}${stats.errors.length}${colors.reset}`);
  console.log(`Warnings found: ${stats.warnings.length > 0 ? colors.yellow : colors.green}${stats.warnings.length}${colors.reset}`);

  if (stats.errors.length === 0 && stats.warnings.length === 0) {
    log.header('\n🎉 All validation checks passed!');
    console.log('Your configuration is clean and ready to deploy.\n');
    return 0;
  }

  if (stats.errors.length > 0) {
    log.header(`\n❌ ${stats.errors.length} Error(s) Found - Must Fix Before Deploying:`);
    stats.errors.forEach((error, i) => {
      console.log(`${colors.red}${i + 1}.${colors.reset} ${error}`);
    });
  }

  if (stats.warnings.length > 0) {
    log.header(`\n⚠️  ${stats.warnings.length} Warning(s) - Review Recommended:`);
    stats.warnings.forEach((warning, i) => {
      console.log(`${colors.yellow}${i + 1}.${colors.reset} ${warning}`);
    });
    console.log(`\n${colors.yellow}ℹ${colors.reset} Warnings are informational and won't block deployment.`);
  }

  console.log();

  return stats.errors.length > 0 ? 1 : 0;
}

/**
 * Main execution
 */
function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Music School Dashboard - Configuration Validator         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const configs = loadAllConfigs();

  if (!configs.urlMappings || !configs.helpers) {
    log.error('Failed to load critical configuration files');
    log.info('Cannot continue validation without URL mappings and security whitelist');
    process.exit(1);
  }

  runValidations(configs);

  const exitCode = printSummary();
  process.exit(exitCode);
}

// Run the validator
main();
