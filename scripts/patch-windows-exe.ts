import * as fs from 'fs';
import rcedit from 'rcedit';

const exePath = process.argv[2];

if (!exePath) {
  console.error('Usage: bun scripts/patch-windows-exe.ts <path-to-exe>');
  process.exit(1);
}

if (!fs.existsSync(exePath)) {
  console.error(`Error: File not found: ${exePath}`);
  process.exit(1);
}

console.log(`Patching Windows executable: ${exePath}`);

try {
  await rcedit(exePath, {
    'product-name': 'BrowserOS sidecar',
    'file-description': 'BrowserOS sidecar',
    'company-name': 'BrowserOS',
    'legal-copyright': 'Copyright (C) 2025 BrowserOS',
    'internal-name': 'browseros-server',
    'original-filename': exePath.split('/').pop() || 'browseros-server.exe',
  });
  console.log('✓ Successfully patched Windows executable metadata');
} catch (error: any) {
  if (error?.message?.includes('wine')) {
    console.log('⚠ Skipping Windows exe patching (Wine not available)');
    console.log('  The executable will work but show "Bun" in Windows Firewall');
    console.log('  To enable patching: brew install --cask wine-stable');
    process.exit(0);
  }
  console.error('Failed to patch Windows executable:', error);
  process.exit(1);
}
