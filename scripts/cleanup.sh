#!/usr/bin/env bash
# 途灵 - 一键清理脚本（不可逆，删除数据）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
warn "========================================="
warn "  ⚠ 途灵 - 一键清理（不可逆操作）"
warn "========================================="
echo ""
warn "此操作将执行以下清理："
warn "  1. 停止所有运行中的服务进程"
warn "  2. 删除 Docker/Podman 容器及数据卷（数据库数据将丢失）"
warn "  3. 删除 node_modules/ 目录"
warn "  4. 删除 dist/ 构建产物"
echo ""

confirm "确定要继续清理吗？" || {
  info "已取消清理操作"
  exit 0
}

echo ""
info "========================================="
info "  途灵 - 一键清理"
info "========================================="
echo ""

# ── 停止应用进程 ──
info "停止应用进程..."
stop_app_processes

# ── 停止并删除容器及数据卷 ──
info "删除容器及数据卷..."
compose down -v
success "容器及数据卷已删除"


# ── 删除依赖和构建产物 ──
info "清理 node_modules/ ..."
rm -rf "$PROJECT_ROOT/server/node_modules" 2>/dev/null || true
rm -rf "$PROJECT_ROOT/client/node_modules" 2>/dev/null || true
success "node_modules/ 已删除"

info "清理构建产物..."
rm -rf "$PROJECT_ROOT/server/dist"
rm -f "$PROJECT_ROOT/server/*.tsbuildinfo"
rm -f "$PROJECT_ROOT/client/*.tsbuildinfo"
success "构建产物已删除"

# ── 清理 PID 文件 ──
rm -rf "$PIDS_DIR"

echo ""
success "========================================="
success "  清理完成！环境已恢复至初始状态"
success "========================================="
echo ""
info "重新部署: bash scripts/setup.sh && bash scripts/start.sh"
echo ""
