#!/bin/bash
set -e

echo "🚀 Setting up gVisor for Dafny API..."
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${RED}❌ Error: gVisor only runs on Linux${NC}"
    exit 1
fi

echo "Installing gVisor (runsc)..."

# Detect architecture
ARCH=$(uname -m)
case "${ARCH}" in
  x86_64) ARCH_ALT="x86_64";;
  aarch64) ARCH_ALT="aarch64";;
  *) echo -e "${RED}❌ Unsupported architecture: ${ARCH}${NC}"; exit 1;;
esac

# Install runsc
if ! command -v runsc &> /dev/null; then
    (
      set -e
      ARCH=$(uname -m)
      URL=https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}
      wget ${URL}/runsc ${URL}/runsc.sha512 \
        ${URL}/containerd-shim-runsc-v1 ${URL}/containerd-shim-runsc-v1.sha512
      sha512sum -c runsc.sha512 \
        -c containerd-shim-runsc-v1.sha512
      rm -f *.sha512
      chmod a+rx runsc containerd-shim-runsc-v1
      sudo mv runsc containerd-shim-runsc-v1 /usr/local/bin
    )
    echo -e "${GREEN}✓ gVisor installed${NC}"
else
    echo -e "${GREEN}✓ gVisor already installed${NC}"
fi

echo ""
echo "Configuring Docker to use gVisor runtime..."

# Configure Docker daemon
DOCKER_CONFIG="/etc/docker/daemon.json"
if [ ! -f "$DOCKER_CONFIG" ]; then
    sudo mkdir -p /etc/docker
    echo '{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc"
    }
  }
}' | sudo tee "$DOCKER_CONFIG" > /dev/null
else
    # Check if runsc runtime is already configured
    if ! grep -q '"runsc"' "$DOCKER_CONFIG"; then
        echo -e "${YELLOW}⚠ Please add gVisor runtime to $DOCKER_CONFIG manually:${NC}"
        echo '{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc"
    }
  }
}'
    fi
fi

echo ""
echo "Testing gVisor runtime..."
if docker run --rm --runtime=runsc hello-world > /dev/null 2>&1; then
    echo -e "${GREEN}✓ gVisor runtime working${NC}"
else
    echo -e "${RED}❌ gVisor runtime test failed${NC}"
    echo "Please ensure Docker is configured correctly and restart the Docker daemon."
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
