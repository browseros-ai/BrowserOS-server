/**
 * @license
 * Copyright 2025 BrowserOS
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function readPackageJson(): {version?: string} {
  const currentDir = import.meta.dirname;
  const packageJsonPath = path.join(currentDir, '..', '..', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return {};
  }
  try {
    const json = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    assert.strict(json['name'], 'browseros-mcp');
    return json;
  } catch {
    return {};
  }
}

export function readVersion(): string {
  return readPackageJson().version ?? 'unknown';
}
