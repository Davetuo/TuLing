## ADDED Requirements

### Requirement: 用户可以为当前对话生成结构化总结
The system SHALL 在对话上下文足够时，允许用户请求AI生成当前对话的结构化总结。

#### Scenario: 成功生成总结
- **WHEN** 用户点击"智能总结"且对话内容充足（至少4条消息）
- **THEN** 系统以总结型Prompt调用LLM，流式返回结构化总结，包含以下部分：行程摘要、Day-by-Day路线、交通与时间安排、必带物品、预算估算、风险提醒、待确认事项

#### Scenario: 对话内容不足
- **WHEN** 用户点击"智能总结"且对话消息少于4条
- **THEN** 系统展示"当前对话内容较少，暂无法生成总结"

#### Scenario: 总结生成失败
- **WHEN** 总结生成失败（LLM错误、超时）
- **THEN** 系统展示"智能总结生成失败，请稍后重试"，用户可重试

### Requirement: 总结支持复制
The system SHALL 允许用户复制生成的总结文本。

#### Scenario: 用户复制总结
- **WHEN** 用户点击生成总结的"复制"按钮
- **THEN** 完整总结文本复制到剪贴板，展示"已复制到剪贴板"成功提示

### Requirement: 总结持久化到会话元数据
The system SHALL 将生成的总结存储到会话元数据中，供后续查看。

#### Scenario: 再次进入时展示总结
- **WHEN** 用户返回已有总结的会话
- **THEN** 已有总结被展示并标记为先前已生成

### Requirement: 总结生成支持流式展示
The system SHALL 通过流式方式逐步展示总结内容，与常规AI回复一致。

#### Scenario: 总结逐步流式展示
- **WHEN** 总结生成进行中
- **THEN** 总结文本通过SSE流式逐步出现，用户可在生成完成前看到部分结果
