#!/usr/bin/env bash
# 途灵 - 一键部署脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo ""
info "========================================="
info "  途灵 - 一键部署"
info "========================================="
echo ""

check_node
check_docker

# ── 后端依赖 ──
info "安装后端依赖..."
cd "$PROJECT_ROOT/server"
npm install
success "后端依赖安装完成"

# ── 前端依赖 ──
info "安装前端依赖..."
cd "$PROJECT_ROOT/client"
npm install
success "前端依赖安装完成"

# ── 环境变量 ──
cd "$PROJECT_ROOT"
if [ ! -f server/.env ]; then
  info "生成 server/.env 配置文件..."
  cp server/.env.example server/.env
  warn "已生成 server/.env，请根据需要修改 JWT 密钥和 SMTP 配置"
else
  info "server/.env 已存在，跳过"
fi

# ── 启动 Docker 容器 ──
info "启动 Docker 容器（PostgreSQL + Redis）..."
cd "$PROJECT_ROOT"
if ! docker compose ps --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
  docker compose up -d
else
  info "Docker 容器已在运行"
fi

info "等待 PostgreSQL 就绪（端口 5432）..."
wait_for_port 5432
success "PostgreSQL 就绪"

# ── 数据库初始化 ──
info "初始化数据库..."
cd "$PROJECT_ROOT/server"
# Retry prisma generate up to 3 times (Windows file lock workaround)
for i in 1 2 3; do
  if npx prisma generate; then break; fi
  if [ "$i" -eq 3 ]; then error "Prisma generate 失败（已重试 $i 次）"; fi
  warn "Prisma generate 失败，重试 ($i/3)..."
  sleep 3
done
npx prisma migrate dev
success "数据库初始化完成"

# ── 完成 ──
echo ""
success "========================================="
success "  部署完成！"
success "========================================="
echo ""
info "运行 bash scripts/start.sh 启动所有服务"
echo ""
