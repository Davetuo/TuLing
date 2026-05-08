#!/usr/bin/env bash
# 途灵 - 一键生产启动脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

cleanup() {
  echo ""
  info "正在停止服务..."
  if [ -f "$PIDS_DIR/server-prod.pid" ]; then
    local spid
    spid=$(cat "$PIDS_DIR/server-prod.pid")
    kill "$spid" 2>/dev/null || true
    rm -f "$PIDS_DIR/server-prod.pid"
  fi
  success "服务已停止"
  exit 0
}
trap cleanup INT TERM

echo ""
info "========================================="
info "  途灵 - 生产模式启动"
info "========================================="
echo ""

check_node
check_container_runtime

# ── 容器 ──
CONTAINERS_RUNNING=$(compose ps --format '{{.Status}}' 2>/dev/null | grep -c 'Up' || echo 0)
if [ "$CONTAINERS_RUNNING" -eq 0 ]; then
  info "启动 ${CONTAINER_RUNTIME_NAME} 容器 (PostgreSQL + Redis)..."
  compose up -d
else
  info "${CONTAINER_RUNTIME_NAME} 容器已在运行"
fi


# ── 等待基础设施就绪 ──
wait_for_port 5432 30
wait_for_port 6379 30

# ── 数据库迁移 ──
info "执行数据库迁移 (Prisma)..."
cd "$PROJECT_ROOT/server"
npx prisma generate
npx prisma migrate deploy
success "数据库迁移完成"

# ── 构建后端 ──
info "构建后端 (NestJS)..."
cd "$PROJECT_ROOT/server"
npm run build
success "后端构建完成"

# ── 构建前端 ──
info "构建前端 (Vite)..."
cd "$PROJECT_ROOT/client"
npm run build
success "前端构建完成"

# ── 释放端口 ──
PORT_PID=$(lsof -ti:3000 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
  warn "端口 3000 已被占用 (PID: $PORT_PID)，正在终止..."
  kill -9 $PORT_PID 2>/dev/null || true
  sleep 1
fi

# ── 启动生产服务 ──
info "启动生产服务 (NestJS + 静态文件)..."
cd "$PROJECT_ROOT/server"
NODE_ENV=production npm run start:prod &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDS_DIR/server-prod.pid"

sleep 2
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  error "服务启动失败，请检查日志"
fi

success "生产服务已启动 (PID: $SERVER_PID)"

echo ""
success "========================================="
success "  生产服务已启动"
success "========================================="
echo ""
info "本地访问: http://localhost:3000"

# ── 获取局域网 IP ──
LAN_IP=""
if command -v hostname &> /dev/null; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
fi
if [ -z "$LAN_IP" ] && command -v ipconfig &> /dev/null; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null) || true
fi
if [ -n "$LAN_IP" ]; then
  info "局域网访问: http://${LAN_IP}:3000"
fi

PUBLIC_IP=$(get_public_ip)
if [ -n "$PUBLIC_IP" ]; then
  info "公网访问: http://${PUBLIC_IP}:3000"
  warn "请确保路由器已配置端口转发 (3000 -> ${LAN_IP:-<主机IP>}:3000)"
fi

info "按 Ctrl+C 停止服务"
echo ""

wait
