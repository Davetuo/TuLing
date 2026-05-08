#!/usr/bin/env bash
# 途灵 - 一键启动脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# ── 清理函数 ──
cleanup() {
  echo ""
  info "正在停止所有服务..."
  stop_app_processes
  success "所有服务已停止"
  exit 0
}
trap cleanup INT TERM

echo ""
info "========================================="
info "  途灵 - 一键启动"
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

# ── 释放被占用的端口 ──
for port in 3000 5173; do
  PORT_PID=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$PORT_PID" ]; then
    warn "端口 $port 已被占用 (PID: $PORT_PID)，正在终止..."
    kill -9 $PORT_PID 2>/dev/null || true
    sleep 1
  fi
done

# ── 启动后端 ──
info "启动后端服务 (NestJS) 端口 3000..."
cd "$PROJECT_ROOT/server"
# Run in a new process group so we can kill the entire tree on stop
setsid npm run start:dev &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDS_DIR/server.pid"
success "后端已启动 (PID: $SERVER_PID)"

# ── 启动前端 ──
info "启动前端服务 (Vite) 端口 5173..."
cd "$PROJECT_ROOT/client"
setsid npm run dev &
CLIENT_PID=$!
echo "$CLIENT_PID" > "$PIDS_DIR/client.pid"
success "前端已启动 (PID: $CLIENT_PID)"

echo ""
success "========================================="
success "  所有服务已启动"
success "========================================="
echo ""
info "后端 API:  http://localhost:3000"
info "前端页面:  http://localhost:5173"

# ── 获取局域网 IP ──
LAN_IP=""
if command -v hostname &> /dev/null; then
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || true
fi
if [ -z "$LAN_IP" ] && command -v ipconfig &> /dev/null; then
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null) || true
fi
if [ -n "$LAN_IP" ]; then
  info "局域网访问:"
  info "  前端:     http://${LAN_IP}:5173"
  info "  后端 API: http://${LAN_IP}:3000"
fi

PUBLIC_IP=$(get_public_ip)
if [ -n "$PUBLIC_IP" ]; then
  info "公网访问: http://${PUBLIC_IP}:3000"
  warn "请确保路由器已配置端口转发 (3000 -> ${LAN_IP:-<主机IP>}:3000)"
fi

info "按 Ctrl+C 停止所有服务"
echo ""

# ── 等待进程退出 ──
wait
