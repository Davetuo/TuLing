#!/usr/bin/env bash
# 途灵 - 公共工具函数
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PIDS_DIR="$SCRIPT_DIR/.pids"

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

check_node() {
  if ! command -v node &> /dev/null; then
    error "未检测到 Node.js，请安装 Node.js >= 20 (https://nodejs.org)"
  fi
  local major
  major=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ "${major:-0}" -lt 20 ]; then
    error "Node.js 版本过低 (当前: $(node -v))，请升级到 >= 20"
  fi
  info "Node.js $(node -v) ✓"
}

CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-}"
CONTAINER_RUNTIME_NAME=""
COMPOSE_CMD=()

detect_container_runtime() {
  local requested="${CONTAINER_RUNTIME:-}"
  local candidates=()
  if [ -n "$requested" ]; then
    case "$requested" in
      docker|podman) candidates=("$requested") ;;
      *) error "CONTAINER_RUNTIME 仅支持 docker 或 podman (当前: $requested)" ;;
    esac
  else
    candidates=(docker podman)
  fi

  local runtime
  for runtime in "${candidates[@]}"; do
    if ! command -v "$runtime" &> /dev/null; then
      [ -n "$requested" ] && error "未检测到 $runtime，请先安装 $runtime"
      continue
    fi
    if ! "$runtime" info &> /dev/null; then
      [ -n "$requested" ] && error "$runtime 未运行，请启动对应服务"
      continue
    fi
    if "$runtime" compose version &> /dev/null; then
      CONTAINER_RUNTIME="$runtime"
      COMPOSE_CMD=("$runtime" compose)
    elif command -v "${runtime}-compose" &> /dev/null; then
      CONTAINER_RUNTIME="$runtime"
      COMPOSE_CMD=("${runtime}-compose")
    else
      [ -n "$requested" ] && error "未检测到 $runtime compose，请安装 Compose 插件或 ${runtime}-compose"
      continue
    fi
    case "$runtime" in
      docker) CONTAINER_RUNTIME_NAME="Docker" ;;
      podman)
        CONTAINER_RUNTIME_NAME="Podman"
        export PODMAN_COMPOSE_WARNING_LOGS="${PODMAN_COMPOSE_WARNING_LOGS:-false}"
        ;;
    esac

    return 0
  done

  error "未检测到可用的 Docker 或 Podman，请安装并启动 Docker Desktop / Podman"
}

check_container_runtime() {
  detect_container_runtime
  info "$CONTAINER_RUNTIME_NAME 已就绪 ✓"
}

check_docker() {
  check_container_runtime
}

compose() {
  if [ ${#COMPOSE_CMD[@]} -eq 0 ]; then
    detect_container_runtime
  fi
  "${COMPOSE_CMD[@]}" "$@"
}


check_port() {
  local port=$1
  if command -v ss &> /dev/null; then
    ss -tlnp "sport = :$port" 2>/dev/null | grep -q ":$port " && return 0
  elif command -v netstat &> /dev/null; then
    netstat -tlnp 2>/dev/null | grep -q ":$port " && return 0
  elif command -v lsof &> /dev/null; then
    lsof -i ":$port" -sTCP:LISTEN &> /dev/null && return 0
  else
    (echo >/dev/tcp/localhost/"$port") 2>/dev/null && return 0
  fi
  return 1
}

wait_for_port() {
  local port=${1:-}
  local timeout=${2:-30}
  local elapsed=0
  local retried=0
  info "等待端口 $port 就绪..."
  while ! check_port "$port"; do
    sleep 0.5
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$((timeout * 2))" ]; then
      if [ "$retried" -eq 0 ] && compose ps --format "{{.Service}}" 2>/dev/null | grep -q .; then
        warn "端口 $port 等待超时，尝试重启 ${CONTAINER_RUNTIME_NAME:-容器运行时} 容器..."
        compose restart 2>/dev/null || true

        retried=1
        elapsed=0
        sleep 2
      else
        error "端口 $port 等待超时 ($timeout 秒)"
      fi
    fi
  done
  success "端口 $port 已就绪"
}

confirm() {
  local msg=${1:-"确认执行此操作？"}
  local response
  read -r -p "$(echo -e "${YELLOW}[?]${NC} $msg [y/N] ")" response
  case "$response" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

get_public_ip() {
  local ip=""
  ip=$(curl -s --connect-timeout 3 https://ifconfig.me/ip 2>/dev/null) || true
  if [ -z "$ip" ]; then
    ip=$(curl -s --connect-timeout 3 https://api.ipify.org 2>/dev/null) || true
  fi
  if [ -z "$ip" ]; then
    ip=$(curl -s --connect-timeout 3 https://ip.sb 2>/dev/null) || true
  fi
  echo "$ip"
}

stop_app_processes() {
  local stopped=0
  if [ -f "$PIDS_DIR/server.pid" ]; then
    local spid
    spid=$(cat "$PIDS_DIR/server.pid")
    if kill -0 "$spid" 2>/dev/null; then
      # Kill the entire process group to catch nest --watch and its children
      kill -- -"$spid" 2>/dev/null || kill -9 -- -"$spid" 2>/dev/null || kill -9 "$spid" 2>/dev/null || true
      info "后端进程已停止 (PID: $spid)"
      stopped=1
    fi
    rm -f "$PIDS_DIR/server.pid"
  fi
  if [ -f "$PIDS_DIR/client.pid" ]; then
    local cpid
    cpid=$(cat "$PIDS_DIR/client.pid")
    if kill -0 "$cpid" 2>/dev/null; then
      kill -- -"$cpid" 2>/dev/null || kill -9 -- -"$cpid" 2>/dev/null || kill -9 "$cpid" 2>/dev/null || true
      info "前端进程已停止 (PID: $cpid)"
      stopped=1
    fi
    rm -f "$PIDS_DIR/client.pid"
  fi
  # Fallback: kill by port (with process group)
  for port in 3000 5173; do
    local ppid
    ppid=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$ppid" ]; then
      kill -9 $ppid 2>/dev/null || true
      stopped=1
    fi
  done
  # Last-resort fallback: pkill by pattern
  pkill -f "nest start" 2>/dev/null && stopped=1 || true
  pkill -f "vite" 2>/dev/null && stopped=1 || true
  if [ "$stopped" -eq 0 ]; then
    info "没有运行中的应用进程"
  fi
}

cd "$PROJECT_ROOT" || error "无法进入项目根目录"
