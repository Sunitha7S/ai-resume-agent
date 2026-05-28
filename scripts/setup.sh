#!/bin/bash
set -e

echo "=== AI Resume Data Entry Agent - Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is required. Install from https://nodejs.org/ (v18+)"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js v18+ required. Current: $(node -v)"
    exit 1
fi

echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Generate icons
echo "Generating extension icons..."
node scripts/generate-icons.js

# Create .env from example if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "Created .env file from .env.example"
    echo "Please edit .env with your credentials:"
    echo "  - OPENAI_API_KEY: Your OpenAI API key"
    echo "  - DATASORT_USER_ID: Your DataSort user ID"
    echo "  - DATASORT_PASSWORD: Your DataSort password"
fi

# Create required directories
mkdir -p logs screenshots

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Usage:"
echo "  1. Edit .env with your credentials"
echo "  2. Run: npm start"
echo "  3. Or for continuous mode: npm run start:continuous"
echo ""
echo "Chrome Extension:"
echo "  1. Open chrome://extensions"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: src/chrome-extension/"
echo ""
