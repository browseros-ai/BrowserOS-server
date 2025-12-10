#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Build script for BrowserOS server binaries
 *
 * Usage:
 *   bun scripts/build_server.ts --mode=prod [--target=darwin-arm64]
 *   bun scripts/build_server.ts --mode=dev [--target=all]
 *
 * Modes:
 *   prod - Clean environment build using only .env.prod
 *   dev  - Normal build using shell environment + .env.dev
 *
 * Targets:
 *   linux-x64, linux-arm64, windows-x64, darwin-arm64, darwin-x64, all
 */

import {spawn} from 'node:child_process';
import {readFileSync, mkdirSync} from 'node:fs';
import {resolve, join} from 'node:path';

import {parse} from 'dotenv';

interface BuildTarget {
  name: string;
  bunTarget: string;
  outfile: string;
}

const TARGETS: Record<string, BuildTarget> = {
  'linux-x64': {
    name: 'Linux x64',
    bunTarget: 'bun-linux-x64-baseline',
    outfile: 'dist/server/browseros-server-linux-x64',
  },
  'linux-arm64': {
    name: 'Linux ARM64',
    bunTarget: 'bun-linux-arm64',
    outfile: 'dist/server/browseros-server-linux-arm64',
  },
  'windows-x64': {
    name: 'Windows x64',
    bunTarget: 'bun-windows-x64-baseline',
    outfile: 'dist/server/browseros-server-windows-x64.exe',
  },
  'darwin-arm64': {
    name: 'macOS ARM64',
    bunTarget: 'bun-darwin-arm64',
    outfile: 'dist/server/browseros-server-darwin-arm64',
  },
  'darwin-x64': {
    name: 'macOS x64',
    bunTarget: 'bun-darwin-x64',
    outfile: 'dist/server/browseros-server-darwin-x64',
  },
};

const MINIMAL_SYSTEM_VARS = ['PATH'];

function parseArgs(): {mode: 'prod' | 'dev'; targets: string[]} {
  const args = process.argv.slice(2);
  let mode: 'prod' | 'dev' = 'prod';
  let targetArg = 'all';

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const modeValue = arg.split('=')[1];
      if (modeValue !== 'prod' && modeValue !== 'dev') {
        console.error(`Invalid mode: ${modeValue}. Must be 'prod' or 'dev'`);
        process.exit(1);
      }
      mode = modeValue;
    } else if (arg.startsWith('--target=')) {
      targetArg = arg.split('=')[1];
    }
  }

  const targets =
    targetArg === 'all'
      ? Object.keys(TARGETS)
      : targetArg.split(',').map(t => t.trim());

  for (const target of targets) {
    if (!TARGETS[target]) {
      console.error(`Invalid target: ${target}`);
      console.error(
        `Available targets: ${Object.keys(TARGETS).join(', ')}, all`,
      );
      process.exit(1);
    }
  }

  return {mode, targets};
}

function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = parse(content);
    return parsed;
  } catch (error) {
    console.error(`Failed to load ${path}:`, error);
    process.exit(1);
  }
}

function createCleanEnv(
  envVars: Record<string, string>,
): Record<string, string> {
  const cleanEnv: Record<string, string> = {};

  for (const varName of MINIMAL_SYSTEM_VARS) {
    const value = process.env[varName];
    if (value) {
      cleanEnv[varName] = value;
    }
  }

  Object.assign(cleanEnv, envVars);

  return cleanEnv;
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
    });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

async function buildTarget(
  target: BuildTarget,
  mode: 'prod' | 'dev',
  envVars: Record<string, string>,
): Promise<void> {
  console.log(`\n📦 Building ${target.name}...`);

  const args = [
    'build',
    '--compile',
    'packages/server/src/index.ts',
    '--outfile',
    target.outfile,
    '--minify',
    '--sourcemap',
    `--target=${target.bunTarget}`,
    '--env',
    'inline',
    '--external=*?binary',
  ];

  const buildEnv =
    mode === 'prod' ? createCleanEnv(envVars) : {...process.env, ...envVars};

  try {
    await runCommand('bun', args, buildEnv);
    console.log(`✅ ${target.name} built successfully`);

    if (target.outfile.endsWith('.exe')) {
      console.log(`🔧 Patching Windows executable...`);
      await runCommand(
        'bun',
        ['scripts/patch-windows-exe.ts', target.outfile],
        process.env,
      );
    }
  } catch (error) {
    console.error(`❌ Failed to build ${target.name}:`, error);
    throw error;
  }
}

async function main() {
  const {mode, targets} = parseArgs();
  const rootDir = resolve(import.meta.dir, '..');
  process.chdir(rootDir);

  console.log(`🚀 Building BrowserOS server binaries`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Targets: ${targets.join(', ')}`);

  const envFile = mode === 'prod' ? '.env.prod' : '.env.dev';
  const envPath = join(rootDir, envFile);

  console.log(`\n📄 Loading environment from ${envFile}...`);
  const envVars = loadEnvFile(envPath);
  console.log(`   Loaded ${Object.keys(envVars).length} variables`);

  if (mode === 'prod') {
    console.log(
      `\n🔒 Production mode: Using CLEAN environment (only ${envFile} + minimal system vars)`,
    );
    console.log(`   System vars: ${MINIMAL_SYSTEM_VARS.join(', ')}`);
  } else {
    console.log(`\n🔓 Development mode: Using shell environment + ${envFile}`);
  }

  mkdirSync('dist/server', {recursive: true});

  for (const targetKey of targets) {
    const target = TARGETS[targetKey];
    await buildTarget(target, mode, envVars);
  }

  console.log(`\n✨ All builds completed successfully!`);
  console.log(`\n📦 Output files:`);
  for (const targetKey of targets) {
    console.log(`   ${TARGETS[targetKey].outfile}`);
  }
}

main().catch(error => {
  console.error('\n💥 Build failed:', error);
  process.exit(1);
});
