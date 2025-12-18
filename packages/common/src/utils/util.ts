/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {version} from '../../../../package.json' with {type: 'json'};

export function readVersion(): string {
  return version;
}
