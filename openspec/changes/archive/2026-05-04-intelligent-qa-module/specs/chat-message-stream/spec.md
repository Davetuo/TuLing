## ADDED Requirements

### Requirement: 用户可以发送文本消息并接收AI流式回复
The system SHALL 允许已登录用户发送文本消息，并通过Server-Sent Events流式接收AI生成的回复。

#### Scenario: 成功完成消息交互
- **WHEN** 用户输入旅行问题，点击发送或按回车键
- **THEN** 用户消息以气泡形式展示，系统校验输入合法性和内容安全，后端通过Provider Adapter调用LLM，前端通过SSE流逐步渲染AI回复

#### Scenario: 提交空内容
- **WHEN** 用户在输入为空或仅含空白字符时点击发送
- **THEN** 系统阻止提交，不创建任何消息

#### Scenario: 内容安全违规
- **WHEN** 用户提交的内容未通过内容安全检查
- **THEN** 系统返回错误提示"内容包含不适合处理的信息，请修改后重试"，不持久化该消息

#### Scenario: AI回复超时
- **WHEN** AI请求超过15秒仍未回复
- **THEN** 系统展示"AI 响应超时，请稍后重试"，保留用户已输入内容，允许重试

#### Scenario: 用户在流式输出中途停止生成
- **WHEN** 用户在AI流式输出期间点击"停止生成"
- **THEN** 前端通过AbortController中止fetch请求，保留已接收的部分AI回复，展示"已停止生成"标识

#### Scenario: AI回复持久化到数据库
- **WHEN** AI流式输出成功完成
- **THEN** 用户消息和完整的AI回复均持久化到chat_messages表，包含role、content和metadata（token数量、模型、耗时）

### Requirement: AI回复内容应当结构化且信息丰富
The AI reply content SHALL 满足质量要求：语言清晰、格式结构化、旅行建议具备可执行步骤，涉及时效信息时附带标准免责声明。

#### Scenario: AI提供路线建议
- **WHEN** 用户询问行程安排
- **THEN** AI回复包含逐日分解、交通建议、时间预估，并对时间/价格相关信息标注"建议出行前再次确认"

#### Scenario: 用户提供的信息不足
- **WHEN** 用户问题缺少关键信息（目的地、天数、预算、同行人群）
- **THEN** AI优先追问关键条件，而非直接做出假设

### Requirement: 聊天消息按会话持久化
The system SHALL 将每条消息与会话ID、角色（user/assistant）、内容和创建时间戳一起持久化。

#### Scenario: 页面刷新
- **WHEN** 用户在活跃会话中刷新页面
- **THEN** 该会话中的所有历史消息从数据库加载，按时间顺序展示

#### Scenario: 同一会话中发送多条消息
- **WHEN** 用户在同一会话中发送多条问题
- **THEN** 所有消息归入同一会话ID，之前的对话上下文（最近10轮对话）包含在后续LLM请求中
