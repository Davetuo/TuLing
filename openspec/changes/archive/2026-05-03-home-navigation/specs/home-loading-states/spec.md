## ADDED Requirements

### Requirement: Home page skeleton loading
首页初始化加载时 SHALL 展示骨架屏，而非空白页面或全局 spinner。

#### Scenario: Skeleton renders on initial load
- **WHEN** 用户首次进入首页且页面资源正在加载
- **THEN** 展示与功能卡片布局一致的骨架占位块（至少 5 个卡片骨架）

#### Scenario: Skeleton replaced after load
- **WHEN** 首页数据加载完成
- **THEN** 骨架屏被替换为真实功能卡片和快捷入口区

### Requirement: Network error alert
首页在网络异常时 SHALL 展示错误提示，并提供重试入口。

#### Scenario: Network offline on page load
- **WHEN** 用户在离线状态下访问首页
- **THEN** 顶部展示"网络连接异常，请检查网络"提示条

#### Scenario: Network recovers
- **WHEN** 网络从离线恢复为在线
- **THEN** 自动隐藏网络异常提示，重新加载数据

### Requirement: Empty state for each section
首页各数据区块在无数据时 SHALL 展示空状态引导，而非空白区域。

#### Scenario: No recent trips data
- **WHEN** 快捷入口区"最近行程"无数据
- **THEN** 展示"暂无行程"空状态插画和"开始规划"引导按钮

#### Scenario: No recent conversations data
- **WHEN** 快捷入口区"最近对话"无数据
- **THEN** 展示"暂无对话"空状态插画和"开始提问"引导按钮

### Requirement: Loading state for shortcuts
快捷入口区数据加载期间 SHALL 在对应区域内展示加载动画，不阻塞页面其他交互。

#### Scenario: Shortcuts loading
- **WHEN** 快捷入口区正在请求后端数据
- **THEN** 该区域展示局部加载动画（如 `<el-skeleton>` 行或 loading spinner），功能卡片区仍可点击跳转
