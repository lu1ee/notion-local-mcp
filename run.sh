#!/bin/bash
# NVM node를 사용하여 MCP 서버 실행 (네이티브 모듈 호환성 보장)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/dist/index.js"
