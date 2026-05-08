## ADDED Requirements

### Requirement: Vite 开发服务器绑定所有网络接口
Vite 开发服务器 MUST 绑定 `0.0.0.0` 而非仅 localhost，使同一局域网内的其他设备可通过主机 IP 访问前端页面。

#### Scenario: 局域网设备访问前端
- **WHEN** 开发者在主机上执行 `npm run dev` 启动 Vite
- **THEN** 同局域网内的其他设备可通过 `http://<主机IP>:5173` 访问前端页面

#### Scenario: 本地开发不受影响
- **WHEN** 开发者在主机上访问 `http://localhost:5173`
- **THEN** 开发体验与之前完全一致（HMR 正常工作）

### Requirement: CORS 来源可通过环境变量配置
后端 MUST 从 `CORS_ORIGINS` 环境变量读取允许的跨域来源列表（逗号分隔），而非硬编码。默认值包含 `http://localhost:5173`。

#### Scenario: 默认本地开发
- **WHEN** `CORS_ORIGINS` 未设置
- **THEN** 后端仅允许 `http://localhost:5173` 跨域请求

#### Scenario: 自定义多来源
- **WHEN** `CORS_ORIGINS=http://localhost:5173,http://192.168.1.100:5173`
- **THEN** 后端同时允许两个来源的跨域请求，且 `credentials: true` 仍有效

### Requirement: 生产模式静态文件托管
NestJS 在生产模式下 MUST 自动托管前端构建产物（`client/dist/`），使得整个应用通过单端口（3000）对外提供 Web 服务。

#### Scenario: 生产模式访问前端
- **WHEN** 服务以生产模式启动（`NODE_ENV=production`）
- **THEN** 访问 `http://<host>:3000` 直接展示前端页面，无需额外启动 Vite 开发服务器

#### Scenario: API 路由优先于静态文件
- **WHEN** 请求路径以 `/api/` 开头
- **THEN** 请求由 NestJS 路由处理而非静态文件服务

### Requirement: 启动脚本输出网络访问地址
启动脚本 MUST 在服务启动完成后打印主机的局域网 IP 地址，方便用户在其他设备输入访问 URL。

#### Scenario: 开发模式脚本输出
- **WHEN** 执行 `start.sh` / `start.ps1` / `start.bat`
- **THEN** 控制台输出格式 `Network: http://<局域网IP>:5173`

#### Scenario: 生产模式脚本输出
- **WHEN** 执行 `start-prod.sh` / `start-prod.ps1` / `start-prod.bat`
- **THEN** 控制台输出格式 `Network: http://<局域网IP>:3000`

### Requirement: 生产模式启动脚本
项目 MUST 提供生产模式一键启动脚本，自动完成前端构建和后端生产启动。

#### Scenario: 一键生产启动
- **WHEN** 执行生产启动脚本
- **THEN** 脚本自动执行 `cd client && npm run build`，然后启动 NestJS 生产模式，服务可从 `http://<host>:3000` 访问
