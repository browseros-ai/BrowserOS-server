
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type {McpServerConfig} from './exec';

export type ApprovalMode = 'never' | 'on-request' | 'on-failure' | 'untrusted';

export type SandboxMode =
  | 'read-only'
  | 'workspace-write'
  | 'danger-full-access';

export interface ThreadOptions {
  model?: string;
  sandboxMode?: SandboxMode;
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  mcpServers?: Record<string, McpServerConfig>;
}
