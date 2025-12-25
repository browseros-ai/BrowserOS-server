/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized port configuration.
 * All port values in the monorepo should reference this file.
 */

export const PORT_OFFSETS = {
  CDP: 22,
  HTTP_MCP: 23,
  EXTENSION: 100,
} as const

function createPorts(base: number) {
  return {
    cdp: base + PORT_OFFSETS.CDP,
    httpMcp: base + PORT_OFFSETS.HTTP_MCP,
    extension: base + PORT_OFFSETS.EXTENSION,
  } as const
}

/** Production/development ports (base 9200) */
export const DEFAULT_PORTS = createPorts(9200)

/** Test ports - separate range to avoid conflicts with dev server (base 19200) */
export const TEST_PORTS = createPorts(19200)

export type Ports = ReturnType<typeof createPorts>
