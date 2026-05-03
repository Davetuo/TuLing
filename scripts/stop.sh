#!/usr/bin/env bash
# 途灵 - 一键停止脚本（保留数据）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
info "========================================="
info "  途灵 - 一键停止"
info "========================================="
echo ""

# ── 停止应用进程 ──
info "停止应用进程..."
stop_app_processes

# ── 停止 Docker 容器（保留数据卷） ──
info "停止 Docker 容器（保留数据）..."
docker compose down
success "Docker 容器已停止"

echo ""
success "========================================="
success "  所有服务已停止（数据已保留）"
success "========================================="
echo ""
info "运行 bash scripts/start.sh 重新启动"
echo ""
