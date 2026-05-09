### Requirement: Logo title navigates to home page
AppLayout 顶部导航栏中的"途灵"品牌标题 SHALL 作为可点击元素，点击后导航用户至主页（`/home`）。

#### Scenario: User clicks logo from a sub-page
- **WHEN** 用户在非主页页面（如 `/chat`、`/spots`）点击顶部"途灵"标题
- **THEN** 页面导航至 `/home`，显示主页内容

#### Scenario: User clicks logo while already on home page
- **WHEN** 用户已在 `/home` 页面点击"途灵"标题
- **THEN** 页面保持不变，无重复导航或刷新

### Requirement: Logo displays pointer cursor
"途灵"标题区域 SHALL 显示 `pointer` 光标样式，向用户传达该元素可交互。

#### Scenario: User hovers over logo
- **WHEN** 用户将鼠标悬停在"途灵"标题上
- **THEN** 光标变为手型指针（pointer）

### Requirement: Logo visual style remains unchanged
导航功能的添加 SHALL NOT 改变"途灵"标题的视觉外观（字体大小、颜色、粗细、位置）。

#### Scenario: Logo appearance after adding link
- **WHEN** 页面加载后观察顶部"途灵"标题
- **THEN** 标题保持 20px 字体大小、#303133 颜色、无下划线装饰，与修改前视觉一致
