#!/bin/bash

set -e  # Exit on error

echo "🚀 BrowserOS Agent Server - Setup"
echo "=================================="
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed."
    echo "📦 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash

    echo ""
    echo "✅ Bun installed! Please reload your shell:"
    echo "   exec \$SHELL"
    echo ""
    echo "Then run ./setup.sh again"
    exit 0
else
    echo "✅ Bun is already installed ($(bun --version))"
fi

# Check if Node.js is installed (needed for npx to spawn MCP servers)
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js is not installed."
    echo "   Node.js is required to run MCP servers via npx"
    echo "   Install from: https://nodejs.org (v18+)"
    echo ""
    read -p "Continue without Node.js? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Node.js is installed ($(node --version))"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
bun install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Add your ANTHROPIC_API_KEY to .env"
    echo "   1. Get your key from: https://console.anthropic.com/settings/keys"
    echo "   2. Edit .env file and replace the ANTHROPIC_API_KEY value"
else
    echo "✅ .env file already exists"
fi

# Create dist directory for builds
mkdir -p dist

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "   1. Add your API key to .env:"
echo "      ANTHROPIC_API_KEY=sk-ant-api03-xxxxx"
echo ""
echo "   2. Test your API key:"
echo "      bun run test:api"
echo ""
echo "   3. Start the development server:"
echo "      bun run dev"
echo ""
echo "   4. (Optional) Test browser automation:"
echo "      bun run test:browser"
echo ""
echo "   5. (Optional) Build standalone binary:"
echo "      bun run build"
echo ""
echo "📚 Documentation: docs/README.md"
echo "🐛 Troubleshooting: README.md#troubleshooting"
echo ""
