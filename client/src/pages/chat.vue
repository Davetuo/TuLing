<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, ChatDotRound, Position, CopyDocument, ArrowLeft } from '@element-plus/icons-vue'
import { getSessions, getSession, createSession, sendMessage, generateSummary, getRecommendations } from '@/shared/api/chat'
import type { ChatSession, ChatMessage, Recommendation } from '@/shared/types/chat'
import { apiClient } from '@/shared/api/client'

// ── Router ──

const router = useRouter()

// ── State ──

const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const isLoadingSessions = ref(false)
const isLoadingMessages = ref(false)
const isStreaming = ref(false)
const streamAbort = ref<(() => void) | null>(null)
const streamingContent = ref('')
const inputText = ref('')
const recommendations = ref<Recommendation[]>([])
const showSummary = ref(false)
const summaryContent = ref('')
const isGeneratingSummary = ref(false)
const sidebarCollapsed = ref(false)

// ── Computed ──

const hasActiveSession = computed(() => currentSessionId.value !== null)
const canSend = computed(() => inputText.value.trim().length > 0 && !isStreaming.value)
const canSummarize = computed(() => messages.value.length >= 4 && !isGeneratingSummary.value)
const userMessages = computed(() => messages.value.filter((m) => m.role === 'user'))

// ── Session list ──

async function loadSessions() {
  isLoadingSessions.value = true
  try {
    const data = await getSessions()
    sessions.value = data.list
  } catch {
    // Silently fail — empty state handled by UI
  } finally {
    isLoadingSessions.value = false
  }
}

async function handleNewChat() {
  // Abort streaming if in progress
  if (streamAbort.value) {
    streamAbort.value()
    streamAbort.value = null
    isStreaming.value = false
  }

  currentSessionId.value = null
  messages.value = []
  streamingContent.value = ''
  showSummary.value = false
  summaryContent.value = ''

  await loadRecommendations()
}

async function selectSession(sessionId: string) {
  if (streamAbort.value) {
    streamAbort.value()
    streamAbort.value = null
    isStreaming.value = false
  }

  currentSessionId.value = sessionId
  isLoadingMessages.value = true
  streamingContent.value = ''
  showSummary.value = false
  summaryContent.value = ''

  try {
    const detail = await getSession(sessionId)
    messages.value = detail.messages || []
    if (detail.summary) {
      summaryContent.value = typeof detail.summary === 'object'
        ? (detail.summary as Record<string, string>).content || ''
        : ''
      showSummary.value = true
    }
  } catch {
    ElMessage.error('加载会话失败')
  } finally {
    isLoadingMessages.value = false
  }
}

// ── Recommendations ──

async function loadRecommendations() {
  try {
    const recs = await getRecommendations()
    recommendations.value = recs
  } catch {
    // Fallback defaults
    recommendations.value = [
      { id: 'fb-1', text: '帮我规划一个3天游杭州的轻松路线', category: '行程规划' },
      { id: 'fb-2', text: '推荐几个适合周末出行的小众城市', category: '目的地推荐' },
      { id: 'fb-3', text: '带老人去北京玩，需要注意什么？', category: '出行提示' },
      { id: 'fb-4', text: '预算1000元，如何安排两天一夜旅行？', category: '预算规划' },
    ]
  }
}

function handleRecommendClick(rec: Recommendation) {
  inputText.value = rec.text
  handleSend()
}

// ── Send message ──

async function handleSend() {
  const content = inputText.value.trim()
  if (!content || isStreaming.value) return

  if (content.length > 2000) {
    ElMessage.warning('消息内容过长，请控制在2000字以内')
    return
  }

  // Add user message to UI immediately
  const tempUserMsg: ChatMessage = {
    id: `temp-${Date.now()}`,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  }
  messages.value.push(tempUserMsg)
  inputText.value = ''

  // Clear recommendations when conversation starts
  recommendations.value = []

  isStreaming.value = true
  streamingContent.value = ''

  // Create temporary assistant message placeholder
  const tempAssistantMsg: ChatMessage = {
    id: `temp-ai-${Date.now()}`,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
  }
  messages.value.push(tempAssistantMsg)

  await nextTick()
  scrollToBottom()

  const { abort } = sendMessage(
    { sessionId: currentSessionId.value || undefined, content },
    {
      onChunk(chunk: string) {
        streamingContent.value += chunk
        tempAssistantMsg.content = streamingContent.value
        nextTick(() => scrollToBottom())
      },
      onDone(event) {
        isStreaming.value = false
        streamAbort.value = null

        // Replace temp IDs with real ones
        if (event.userMessageId) {
          tempUserMsg.id = event.userMessageId
        }
        if (event.assistantMessageId) {
          tempAssistantMsg.id = event.assistantMessageId
        }

        // Set current session ID if this was a new session
        if (event.sessionId && !currentSessionId.value) {
          currentSessionId.value = event.sessionId
          loadSessions()
        }

        streamingContent.value = ''
      },
      onError(message: string, event) {
        isStreaming.value = false
        streamAbort.value = null

        // Set session ID even on error so header updates and summary button shows
        if (event?.sessionId && !currentSessionId.value) {
          currentSessionId.value = event.sessionId
          loadSessions()
        }

        // If no content received, show error in assistant bubble
        if (!tempAssistantMsg.content) {
          tempAssistantMsg.content = message
        } else {
          // Append error indicator to partial content
          tempAssistantMsg.content += '\n\n---\n⚠️ ' + message
        }

        streamingContent.value = ''
        ElMessage.error(message)
      },
    },
  )

  streamAbort.value = abort
}

function handleStopStream() {
  if (streamAbort.value) {
    streamAbort.value()
    streamAbort.value = null
    isStreaming.value = false
    ElMessage.info('已停止生成')
  }
}

// ── Summary ──

async function handleSummary() {
  if (!currentSessionId.value || isGeneratingSummary.value) return

  isGeneratingSummary.value = true
  showSummary.value = true
  summaryContent.value = ''

  const { abort } = generateSummary(
    currentSessionId.value,
    {
      onChunk(chunk: string) {
        summaryContent.value += chunk
      },
      onDone(event) {
        isGeneratingSummary.value = false
        if (event.content) {
          summaryContent.value = event.content
        }
      },
      onError(message: string) {
        isGeneratingSummary.value = false
        ElMessage.error(message)
      },
    },
  )

  // Track for potential abort
  streamAbort.value = abort
}

function copySummary() {
  navigator.clipboard.writeText(summaryContent.value).then(() => {
    ElMessage.success('已复制到剪贴板')
  })
}

// ── Utils ──

function scrollToBottom() {
  const el = document.querySelector('.chat-messages-area')
  if (el) {
    el.scrollTop = el.scrollHeight
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + '分钟前'
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + '小时前'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function goHome() {
  router.push('/home')
}

// ── Init ──

loadSessions()
loadRecommendations()
</script>

<template>
  <div class="chat-page" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- ── Sidebar ── -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <el-button type="primary" :icon="Plus" size="small" @click="handleNewChat" class="new-chat-btn">
          新建对话
        </el-button>
        <el-button text size="small" @click="toggleSidebar" class="collapse-btn">
          {{ sidebarCollapsed ? '展开' : '收起' }}
        </el-button>
      </div>

      <div class="session-list" v-loading="isLoadingSessions">
        <div v-if="sessions.length === 0 && !isLoadingSessions" class="empty-sessions">
          <p>暂无对话记录</p>
          <el-button text type="primary" @click="handleNewChat">开始新对话</el-button>
        </div>

        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: currentSessionId === session.id }"
          @click="selectSession(session.id)"
        >
          <div class="session-title">{{ session.title }}</div>
          <div class="session-meta">
            <span>{{ session.messageCount }} 条消息</span>
            <span>{{ formatTime(session.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── Main Chat Area ── -->
    <main class="chat-main">
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-header-left">
          <el-tooltip content="返回首页" placement="bottom">
            <el-button text :icon="ArrowLeft" @click="goHome" class="back-btn" />
          </el-tooltip>
          <el-button v-if="sidebarCollapsed" text @click="toggleSidebar" class="menu-btn">
            ☰
          </el-button>
          <h3 v-if="hasActiveSession">
            {{ sessions.find((s) => s.id === currentSessionId)?.title || '对话' }}
          </h3>
          <h3 v-else>智能问答</h3>
        </div>
        <div class="chat-header-actions">
          <el-button
            v-if="hasActiveSession"
            text
            :disabled="!canSummarize"
            :loading="isGeneratingSummary"
            @click="handleSummary"
            type="primary"
            size="small"
          >
            智能总结
          </el-button>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="chat-messages-area" v-loading="isLoadingMessages">
        <!-- Welcome state -->
        <div v-if="!hasActiveSession && messages.length === 0" class="welcome-area">
          <div class="welcome-icon">
            <el-icon :size="56" color="#667eea"><ChatDotRound /></el-icon>
          </div>
          <h2>你好，我是途灵 AI 旅行搭子</h2>
          <p>有什么旅行问题可以帮你？</p>

          <!-- Recommendations -->
          <div v-if="recommendations.length > 0" class="recommendations">
            <p class="rec-label">试试问我：</p>
            <div class="rec-cards">
              <div
                v-for="rec in recommendations"
                :key="rec.id"
                class="rec-card"
                @click="handleRecommendClick(rec)"
              >
                <span class="rec-text">{{ rec.text }}</span>
                <el-tag size="small" type="info">{{ rec.category }}</el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div v-for="msg in messages" :key="msg.id" class="message-row" :class="msg.role">
          <div class="message-bubble">
            <div class="message-content" v-text="msg.content"></div>
            <div class="message-time">{{ formatTime(msg.createdAt) }}</div>
          </div>
        </div>

        <!-- Streaming indicator -->
        <div v-if="isStreaming && streamingContent === ''" class="message-row assistant">
          <div class="message-bubble">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <!-- Summary section -->
        <div v-if="showSummary && summaryContent" class="summary-section">
          <div class="summary-header">
            <span>📋 智能总结</span>
            <el-button text size="small" :icon="CopyDocument" @click="copySummary">复制</el-button>
          </div>
          <div class="summary-content" v-text="summaryContent"></div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div v-if="isStreaming" class="stream-controls">
          <el-button type="warning" size="small" @click="handleStopStream" plain>
            停止生成
          </el-button>
          <span class="streaming-hint">AI正在回答...</span>
        </div>

        <div class="input-row">
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="2"
            placeholder="输入你的旅行问题..."
            :disabled="isStreaming"
            maxlength="2000"
            show-word-limit
            @keydown.enter.exact.prevent="handleSend"
          />
          <el-button
            type="primary"
            :icon="Position"
            :disabled="!canSend"
            @click="handleSend"
            class="send-btn"
          >
            发送
          </el-button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: calc(100vh - 60px);
  background: #f5f7fa;
}

/* ── Sidebar ── */
.chat-sidebar {
  width: 280px;
  min-width: 280px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s;
}

.sidebar-collapsed .chat-sidebar {
  margin-left: -280px;
}

.sidebar-header {
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.new-chat-btn {
  flex: 1;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-sessions {
  text-align: center;
  padding: 40px 16px;
  color: #909399;
}

.session-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.2s;
}

.session-item:hover {
  background: #f0f2f5;
}

.session-item.active {
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
}

.session-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.session-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  justify-content: space-between;
}

/* ── Main Chat ── */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-header-left h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.back-btn {
  font-size: 18px;
  color: #606266;
  padding: 8px;
  min-width: 36px;
  min-height: 36px;
}

.back-btn:hover {
  color: #667eea;
}

/* ── Messages ── */
.chat-messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  text-align: center;
  padding: 40px 20px;
}

.welcome-icon {
  margin-bottom: 16px;
}

.welcome-area h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #303133;
}

.welcome-area p {
  color: #909399;
  margin: 0 0 24px;
}

.recommendations {
  max-width: 480px;
  width: 100%;
}

.rec-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}

.rec-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.rec-card:hover {
  border-color: #667eea;
}

.rec-text {
  font-size: 14px;
  color: #303133;
  text-align: left;
}

/* ── Message Bubbles ── */
.message-row {
  display: flex;
  max-width: 80%;
}

.message-row.user {
  align-self: flex-end;
}

.message-row.assistant {
  align-self: flex-start;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  position: relative;
}

.message-row.user .message-bubble {
  background: #667eea;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-row.assistant .message-bubble {
  background: #fff;
  color: #303133;
  border: 1px solid #e4e7ed;
  border-bottom-left-radius: 4px;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.7;
}

/* ── Typing Indicator ── */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #909399;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ── Summary ── */
.summary-section {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 14px;
  color: #166534;
}

.summary-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
}

/* ── Input Area ── */
.chat-input-area {
  padding: 16px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.stream-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.streaming-hint {
  font-size: 13px;
  color: #909399;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-row :deep(.el-textarea) {
  flex: 1;
}

.send-btn {
  height: 40px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .chat-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  }

  .sidebar-collapsed .chat-sidebar {
    margin-left: -280px;
  }

  .message-row {
    max-width: 90%;
  }

  .back-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
  }
}
</style>
