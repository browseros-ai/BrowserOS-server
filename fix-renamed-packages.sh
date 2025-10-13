#!/bin/bash

# Script to update all package references after renaming
# core -> common
# mcp-server -> mcp
# agent-server -> agent

echo "📦 Updating package references after rename..."

# Update all TypeScript and JavaScript files
echo "🔄 Updating imports from @browseros/core to @browseros/common..."
find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" \) | while read file; do
  sed -i '' "s/@browseros\/core/@browseros\/common/g" "$file"
done

echo "🔄 Updating imports from @browseros/mcp-server to @browseros/mcp..."
find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" \) | while read file; do
  sed -i '' "s/@browseros\/mcp-server/@browseros\/mcp/g" "$file"
done

echo "🔄 Updating imports from @browseros/agent-server to @browseros/agent..."
find packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" \) | while read file; do
  sed -i '' "s/@browseros\/agent-server/@browseros\/agent/g" "$file"
done

# Update TypeScript configs
echo "🔄 Updating tsconfig references..."
find packages -name "tsconfig.json" | while read file; do
  sed -i '' "s/\"..\/core\"/\"..\/common\"/g" "$file"
  sed -i '' "s/\"..\/mcp-server\"/\"..\/mcp\"/g" "$file"
  sed -i '' "s/\"..\/agent-server\"/\"..\/agent\"/g" "$file"
done

# Update root package.json test scripts
echo "🔄 Updating root package.json test scripts..."
sed -i '' "s/test:core/test:common/g" package.json
sed -i '' "s/--filter @browseros\/core/--filter @browseros\/common/g" package.json
sed -i '' "s/test:mcp-server/test:mcp/g" package.json
sed -i '' "s/--filter @browseros\/mcp-server/--filter @browseros\/mcp/g" package.json
sed -i '' "s/test:agent-server/test:agent/g" package.json
sed -i '' "s/--filter @browseros\/agent-server/--filter @browseros\/agent/g" package.json

echo "✅ Package references updated!"
echo "🧹 Cleaning cache..."
rm -f .eslintcache
rm -rf packages/*/dist
rm -f packages/*/tsconfig.tsbuildinfo

echo "📦 Installing dependencies..."
bun install

echo "🎉 Done! Now run 'bun test:all' to verify everything works."