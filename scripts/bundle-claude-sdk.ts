#!/usr/bin/env bun

import { $ } from 'bun'
import fs from 'node:fs'
import path from 'node:path'

const SDK_DIR = 'node_modules/@anthropic-ai/claude-agent-sdk'
const OUTPUT_FILE = 'packages/agent/src/agent/embedded-claude-sdk.tar.gz'

console.log('📦 Bundling Claude SDK...')

if (!fs.existsSync(SDK_DIR)) {
  console.error('❌ SDK not found at', SDK_DIR)
  console.error('Run: bun install @anthropic-ai/claude-agent-sdk')
  process.exit(1)
}

const outputDir = path.dirname(OUTPUT_FILE)
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

await $`tar -czf ${OUTPUT_FILE} -C node_modules/@anthropic-ai claude-agent-sdk`

const stat = fs.statSync(OUTPUT_FILE)
const sizeMB = (stat.size / 1024 / 1024).toFixed(2)

console.log(`✅ Bundled Claude SDK to ${OUTPUT_FILE} (${sizeMB} MB)`)
