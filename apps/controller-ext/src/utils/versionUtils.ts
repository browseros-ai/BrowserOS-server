/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Version comparison utility
export class VersionUtils {
  // Parse "137.0.7207.69" → [137, 0, 7207, 69]
  private static parseVersion(version: string): number[] {
    return version.split('.').map(n => parseInt(n, 10) || 0);
  }

  // Compare if versionA >= versionB
  static isVersionAtLeast(current: string, required: string): boolean {
    const currentParts = this.parseVersion(current);
    const requiredParts = this.parseVersion(required);

    for (
      let i = 0;
      i < Math.max(currentParts.length, requiredParts.length);
      i++
    ) {
      const curr = currentParts[i] || 0;
      const req = requiredParts[i] || 0;

      if (curr > req) return true;
      if (curr < req) return false;
    }
    return true; // Equal versions
  }
}
