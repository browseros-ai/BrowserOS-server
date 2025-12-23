/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface OAuthMcpServer {
  name: string // Exact name to pass to Klavis API
  description: string
}

/**
 * Curated list of popular OAuth MCP servers supported via Klavis
 */
export const OAUTH_MCP_SERVERS: OAuthMcpServer[] = [
  { name: 'Gmail', description: 'Send, read, and search emails' },
  { name: 'Google Calendar', description: 'Create events, manage calendars' },
  { name: 'Google Docs', description: 'Create and edit documents' },
  { name: 'Google Drive', description: 'Upload, download, and manage files' },
  { name: 'Google Sheets', description: 'Create and edit spreadsheets' },
  { name: 'Slack', description: 'Post messages, manage channels' },
  { name: 'LinkedIn', description: 'Post updates, manage connections' },
  { name: 'Notion', description: 'Create pages, manage databases' },
  { name: 'Airtable', description: 'Manage bases, tables, and records' },
  { name: 'Confluence', description: 'Create and manage documentation' },
  { name: 'GitHub', description: 'Manage repos, issues, pull requests' },
  { name: 'GitLab', description: 'Manage repos, issues, merge requests' },
  { name: 'Linear', description: 'Create issues, manage cycles' },
  { name: 'Jira', description: 'Create issues, manage sprints' },
  { name: 'Figma', description: 'Access and manage design files' },
  { name: 'Canva', description: 'Create and manage designs' },
  { name: 'Salesforce', description: 'Manage leads, contacts, opportunities' },
]
