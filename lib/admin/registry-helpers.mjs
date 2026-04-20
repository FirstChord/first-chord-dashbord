export function extractValue(line) {
  const firstQuote = line.indexOf("'");
  const lastQuote = line.lastIndexOf("'");

  if (firstQuote === -1 || lastQuote === -1 || lastQuote <= firstQuote) {
    return '';
  }

  return line.slice(firstQuote + 1, lastQuote);
}

export function parseRegistry(source) {
  const lines = source.split('\n');
  const entries = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const entryStart = trimmed.match(/^'([^']+)':\s*\{$/);
    if (entryStart) {
      current = { mmsId: entryStart[1] };
      continue;
    }

    if (!current) {
      continue;
    }

    if (/^},?\s*(\/\/.*)?$/.test(trimmed)) {
      entries.push(current);
      current = null;
      continue;
    }

    if (!trimmed.includes(':')) {
      continue;
    }

    const [rawKey] = trimmed.split(':');
    const key = rawKey.trim();
    current[key] = extractValue(trimmed);
  }

  return entries;
}

export function escapeRegistryValue(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

export function updateEntryBlock(block, updates) {
  let nextBlock = block;

  for (const [key, value] of Object.entries(updates)) {
    const escapedValue = escapeRegistryValue(value);
    const pattern = new RegExp(`(${key}:\\s*)'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'`);
    if (pattern.test(nextBlock)) {
      nextBlock = nextBlock.replace(pattern, `$1'${escapedValue}'`);
    }
  }

  return nextBlock;
}

