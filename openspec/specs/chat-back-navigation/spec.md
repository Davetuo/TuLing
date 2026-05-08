## ADDED Requirements

### Requirement: 聊天头部展示返回按钮
系统 SHALL 在聊天头部区域最左侧位置展示一个返回首页按钮，位于其他头部元素（侧边栏切换、标题）之前。

#### Scenario: 页面加载时返回按钮可见
- **WHEN** 用户导航至聊天页面
- **THEN** 聊天头部左上角区域 SHALL 展示一个带左箭头图标的返回按钮

#### Scenario: 无论侧边栏状态返回按钮均可见
- **WHEN** 侧边栏处于收起或展开状态
- **THEN** 返回按钮 SHALL 保持可见且可点击

### Requirement: 返回按钮导航至首页
系统 SHALL 在用户点击返回按钮时导航至首页。

#### Scenario: 点击返回按钮导航至首页
- **WHEN** 用户点击返回按钮
- **THEN** 应用 SHALL 导航至首页路由（`/home`）
- **AND** 浏览器历史记录 SHALL 允许前进导航回到聊天页面

#### Scenario: 活跃会话中点击返回按钮
- **WHEN** 用户有活跃的聊天会话并点击返回按钮
- **THEN** 应用 SHALL 导航至首页且不丢失数据
- **AND** 当用户返回聊天时会话 SHALL 仍可访问

### Requirement: 返回按钮提供悬停提示
系统 SHALL 在用户悬停在返回按钮上时展示"返回首页"工具提示。

#### Scenario: 悬停时显示提示
- **WHEN** 用户悬停在返回按钮上
- **THEN** SHALL 出现"返回首页"文本的工具提示

### Requirement: 返回按钮在移动端可用
系统 SHALL 确保返回按钮在移动视口下具有足够的触摸目标尺寸且保持可用。

#### Scenario: 移动端触摸目标
- **WHEN** 视口宽度小于 768px
- **THEN** 返回按钮的触摸区域 SHALL 不小于 44x44 像素
