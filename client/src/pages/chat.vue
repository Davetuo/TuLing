<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  ChatDotRound,
  Position,
  CopyDocument,
  ArrowLeft,
  Delete,
  Location,
} from "@element-plus/icons-vue";
import {
  deleteSession,
  getSessions,
  getSession,
  createSession,
  sendMessage,
  generateSummary,
  getRecommendations,
} from "@/shared/api/chat";
import type {
  ChatSession,
  ChatMessage,
  Recommendation,
  PlaceMarker,
} from "@/shared/types/chat";
import RouteMapDialog from "@/shared/components/RouteMapDialog.vue";

// ── Router ──

const router = useRouter();

// ── State ──

const sessions = ref<ChatSession[]>([]);
const currentSessionId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const isLoadingSessions = ref(false);
const isLoadingMessages = ref(false);
const isStreaming = ref(false);
const streamAbort = ref<(() => void) | null>(null);
const streamingContent = ref("");
const inputText = ref("");
const recommendations = ref<Recommendation[]>([]);
const showSummary = ref(false);
const summaryContent = ref("");
const isGeneratingSummary = ref(false);
const sidebarCollapsed = ref(false);

// 地图弹层
const mapDialogVisible = ref(false);
const mapDialogText = ref("");
const mapDialogPlaces = ref<PlaceMarker[]>([]);

function openMapForMessage(msg: ChatMessage) {
  mapDialogText.value = msg.content;
  mapDialogPlaces.value = msg.places ?? [];
  mapDialogVisible.value = true;
}

// 后端 RAG 已经把候选传给前端 — 优先用结构化 places 判定
// 没有 places 时再退回旧的正则启发式（兼容旧消息）
const ROUTE_HINT_REGEX =
  /(?:山|湖|海|寺|庙|塔|楼|阁|公园|广场|博物馆|纪念馆|大学|古镇|古城|城墙|景区|风景区|步行街|动物园|植物园|长城|宫|殿|陵|度假区|湾|岛|溶洞)/;

function shouldShowMapButton(msg: ChatMessage): boolean {
  if (msg.role !== "assistant") return false;
  if (msg.places && msg.places.length > 0) return true;
  if (!msg.content || msg.content.length < 20) return false;
  return ROUTE_HINT_REGEX.test(msg.content);
}

// ── Computed ──

const hasActiveSession = computed(() => currentSessionId.value !== null);
const canSend = computed(
  () => inputText.value.trim().length > 0 && !isStreaming.value,
);
const canSummarize = computed(
  () => messages.value.length >= 4 && !isGeneratingSummary.value,
);
const userMessages = computed(() =>
  messages.value.filter((m) => m.role === "user"),
);

// ── Session list ──

async function loadSessions() {
  isLoadingSessions.value = true;
  try {
    const data = await getSessions();
    sessions.value = data.list;
  } catch {
    // Silently fail — empty state handled by UI
  } finally {
    isLoadingSessions.value = false;
  }
}

async function handleNewChat() {
  // Abort streaming if in progress
  if (streamAbort.value) {
    streamAbort.value();
    streamAbort.value = null;
    isStreaming.value = false;
  }

  currentSessionId.value = null;
  messages.value = [];
  streamingContent.value = "";
  showSummary.value = false;
  summaryContent.value = "";

  await loadRecommendations();
}

async function selectSession(sessionId: string) {
  if (streamAbort.value) {
    streamAbort.value();
    streamAbort.value = null;
    isStreaming.value = false;
  }

  currentSessionId.value = sessionId;
  isLoadingMessages.value = true;
  streamingContent.value = "";
  showSummary.value = false;
  summaryContent.value = "";

  try {
    const detail = await getSession(sessionId);
    messages.value = (detail.messages || []).map((m) => {
      // 从历史消息的 metadata.places 还原结构化地点数据
      const meta = m.metadata as { places?: PlaceMarker[] } | undefined;
      return {
        ...m,
        content:
          m.role === "assistant" ? stripMarkdown(m.content) : m.content,
        places: meta?.places,
      };
    });
    if (detail.summary) {
      summaryContent.value =
        typeof detail.summary === "object"
          ? stripMarkdown(
              (detail.summary as Record<string, string>).content || "",
            )
          : "";
      showSummary.value = true;
    }
  } catch {
    ElMessage.error("加载会话失败");
  } finally {
    isLoadingMessages.value = false;
  }
}

async function handleDeleteSession(session: ChatSession) {
  try {
    await ElMessageBox.confirm(
      `确认删除“${session.title || "新对话"}”？删除后无法恢复。`,
      "删除对话",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        confirmButtonClass: "el-button--danger",
      },
    );
  } catch {
    return;
  }

  try {
    await deleteSession(session.id);
    sessions.value = sessions.value.filter((item) => item.id !== session.id);

    if (currentSessionId.value === session.id) {
      currentSessionId.value = null;
      messages.value = [];
      showSummary.value = false;
      summaryContent.value = "";
      await loadRecommendations();
    }

    ElMessage.success("已删除对话");
  } catch {
    ElMessage.error("删除对话失败");
  }
}

// ── Recommendations ──

async function loadRecommendations() {
  try {
    const recs = await getRecommendations();
    recommendations.value = recs;
  } catch {
    // Fallback defaults
    recommendations.value = [
      {
        id: "fb-1",
        text: "帮我规划一个3天游杭州的轻松路线",
        category: "行程规划",
      },
      {
        id: "fb-2",
        text: "推荐几个适合周末出行的小众城市",
        category: "目的地推荐",
      },
      {
        id: "fb-3",
        text: "带老人去北京玩，需要注意什么？",
        category: "出行提示",
      },
      {
        id: "fb-4",
        text: "预算1000元，如何安排两天一夜旅行？",
        category: "预算规划",
      },
    ];
  }
}

function handleRecommendClick(rec: Recommendation) {
  inputText.value = rec.text;
  handleSend();
}

// ── Send message ──

async function handleSend() {
  const content = inputText.value.trim();
  if (!content || isStreaming.value) return;

  if (content.length > 2000) {
    ElMessage.warning("消息内容过长，请控制在2000字以内");
    return;
  }

  // Add user message to UI immediately
  const tempUserMsg: ChatMessage = {
    id: `temp-${Date.now()}`,
    role: "user",
    content,
    createdAt: new Date().toISOString(),
  };
  messages.value.push(tempUserMsg);
  inputText.value = "";

  // Clear recommendations when conversation starts
  recommendations.value = [];

  isStreaming.value = true;
  streamingContent.value = "";

  // Create temporary assistant message placeholder
  const tempAssistantMsg: ChatMessage = {
    id: `temp-ai-${Date.now()}`,
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
  };
  messages.value.push(tempAssistantMsg);

  await nextTick();
  scrollToBottom();

  const { abort } = sendMessage(
    { sessionId: currentSessionId.value || undefined, content },
    {
      onPlaces(places) {
        tempAssistantMsg.places = places;
      },
      onChunk(chunk: string) {
        streamingContent.value += chunk;
        tempAssistantMsg.content = stripMarkdown(streamingContent.value);
        nextTick(() => scrollToBottom());
      },
      onDone(event) {
        isStreaming.value = false;
        streamAbort.value = null;

        // Replace temp IDs with real ones
        if (event.userMessageId) {
          tempUserMsg.id = event.userMessageId;
        }
        if (event.assistantMessageId) {
          tempAssistantMsg.id = event.assistantMessageId;
        }

        // Set current session ID if this was a new session
        if (event.sessionId && !currentSessionId.value) {
          currentSessionId.value = event.sessionId;
          loadSessions();
        }

        streamingContent.value = "";
      },
      onError(message: string, event) {
        isStreaming.value = false;
        streamAbort.value = null;

        // Set session ID even on error so header updates and summary button shows
        if (event?.sessionId && !currentSessionId.value) {
          currentSessionId.value = event.sessionId;
          loadSessions();
        }

        // If no content received, show error in assistant bubble
        if (!tempAssistantMsg.content) {
          tempAssistantMsg.content = message;
        } else {
          // Append error indicator to partial content
          tempAssistantMsg.content += "\n\n---\n⚠️ " + message;
        }

        streamingContent.value = "";
        ElMessage.error(message);
      },
    },
  );

  streamAbort.value = abort;
}

function handleStopStream() {
  if (streamAbort.value) {
    streamAbort.value();
    streamAbort.value = null;
    isStreaming.value = false;
    ElMessage.info("已停止生成");
  }
}

// ── Summary ──

async function handleSummary() {
  if (!currentSessionId.value || isGeneratingSummary.value) return;

  isGeneratingSummary.value = true;
  showSummary.value = true;
  summaryContent.value = "";

  const { abort } = generateSummary(currentSessionId.value, {
    onChunk(chunk: string) {
      summaryContent.value += chunk;
      summaryContent.value = stripMarkdown(summaryContent.value);
    },
    onDone(event) {
      isGeneratingSummary.value = false;
      if (event.content) {
        summaryContent.value = stripMarkdown(event.content);
      }
    },
    onError(message: string) {
      isGeneratingSummary.value = false;
      ElMessage.error(message);
    },
  });

  // Track for potential abort
  streamAbort.value = abort;
}

function copySummary() {
  navigator.clipboard.writeText(summaryContent.value).then(() => {
    ElMessage.success("已复制到剪贴板");
  });
}

// ── Utils ──

// 去除 LLM 输出里的 markdown 标记字符（# * _ ` > - 等），让纯文本气泡更干净
function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // # 标题
    .replace(/\*\*([^*\n]+)\*\*/g, "$1") // **粗体**
    .replace(/__([^_\n]+)__/g, "$1") // __粗体__
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1") // *斜体*
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1") // _斜体_
    .replace(/~~([^~\n]+)~~/g, "$1") // ~~删除线~~
    .replace(/`([^`\n]+)`/g, "$1") // `行内代码`
    .replace(/^\s{0,3}>\s?/gm, "") // > 引用
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // - / * 列表
    .replace(/\*+/g, "") // 残留的 * 号
    .replace(/_{2,}/g, ""); // 残留的 __
}

function scrollToBottom() {
  const el = document.querySelector(".chat-messages-area");
  if (el) {
    el.scrollTop = el.scrollHeight;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "分钟前";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "小时前";
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function goHome() {
  router.push("/home");
}

// ── Init ──

loadSessions();
loadRecommendations();
</script>

<template>
  <div class="chat-page" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- ── Sidebar ── -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <el-button
          type="primary"
          :icon="Plus"
          size="small"
          @click="handleNewChat"
          class="new-chat-btn"
        >
          新建对话
        </el-button>
        <el-button
          text
          size="small"
          @click="toggleSidebar"
          class="collapse-btn"
        >
          {{ sidebarCollapsed ? "展开" : "收起" }}
        </el-button>
      </div>

      <div class="session-list" v-loading="isLoadingSessions">
        <div
          v-if="sessions.length === 0 && !isLoadingSessions"
          class="empty-sessions"
        >
          <p>暂无对话记录</p>
          <el-button text type="primary" @click="handleNewChat"
            >开始新对话</el-button
          >
        </div>

        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: currentSessionId === session.id }"
          @click="selectSession(session.id)"
        >
          <div class="session-item-top">
            <div class="session-title">{{ session.title }}</div>
            <el-button
              text
              circle
              size="small"
              class="delete-session-btn"
              :icon="Delete"
              @click.stop="handleDeleteSession(session)"
            />
          </div>
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
            <el-button
              text
              :icon="ArrowLeft"
              @click="goHome"
              class="back-btn"
            />
          </el-tooltip>
          <el-button
            v-if="sidebarCollapsed"
            text
            @click="toggleSidebar"
            class="menu-btn"
          >
            ☰
          </el-button>
          <h3 v-if="hasActiveSession">
            {{
              sessions.find((s) => s.id === currentSessionId)?.title || "对话"
            }}
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
        <div
          v-if="!hasActiveSession && messages.length === 0"
          class="welcome-area"
        >
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
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-row"
          :class="msg.role"
        >
          <div class="message-bubble">
            <div class="message-content" v-text="msg.content"></div>
            <div class="message-time">{{ formatTime(msg.createdAt) }}</div>
            <div
              v-if="shouldShowMapButton(msg)"
              class="message-actions"
            >
              <el-button
                size="small"
                text
                type="primary"
                :icon="Location"
                @click="openMapForMessage(msg)"
              >
                在地图上查看
              </el-button>
            </div>
          </div>
        </div>

        <!-- Streaming indicator -->
        <div
          v-if="isStreaming && streamingContent === ''"
          class="message-row assistant"
        >
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
            <el-button
              text
              size="small"
              :icon="CopyDocument"
              @click="copySummary"
              >复制</el-button
            >
          </div>
          <div class="summary-content" v-text="summaryContent"></div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div v-if="isStreaming" class="stream-controls">
          <el-button
            type="warning"
            size="small"
            @click="handleStopStream"
            plain
          >
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

    <!-- 路线地图弹层 -->
    <RouteMapDialog
      v-model="mapDialogVisible"
      :text="mapDialogText"
      :places="mapDialogPlaces"
    />
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: calc(100vh - 68px);
  background: var(--tl-bg-page);
}

/* ── Sidebar ── */
.chat-sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--tl-bg-card);
  border-right: 1px solid var(--tl-border-soft);
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s;
}

.sidebar-collapsed .chat-sidebar {
  margin-left: -280px;
}

.sidebar-header {
  padding: 16px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--tl-border-soft);
}

.new-chat-btn {
  flex: 1;
  border-radius: var(--tl-radius-md);
  font-weight: 600;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.empty-sessions {
  text-align: center;
  padding: 48px 16px;
  color: var(--tl-text-5);
}

.empty-sessions p {
  font-size: 13px;
  margin: 0 0 12px;
}

.session-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--tl-radius-md);
  cursor: pointer;
  margin-bottom: 4px;
  transition: background var(--tl-tx);
  border: 1px solid transparent;
}

.session-item:hover {
  background: var(--tl-bg-soft);
}

.session-item.active {
  background: var(--tl-primary-soft);
  border-color: #c7d2fe;
}

.session-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--tl-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item.active .session-title {
  color: var(--tl-primary);
  font-weight: 600;
}

.session-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-session-btn {
  flex-shrink: 0;
  color: var(--tl-text-5);
  opacity: 0;
  transition: opacity var(--tl-tx);
}

.session-item:hover .delete-session-btn {
  opacity: 1;
}

.delete-session-btn:hover {
  color: var(--tl-danger);
}

.session-meta {
  font-size: 12px;
  color: var(--tl-text-5);
  display: flex;
  justify-content: space-between;
}

/* ── Main ── */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--tl-bg-page);
}

.chat-header {
  padding: 14px 24px;
  background: var(--tl-bg-card);
  border-bottom: 1px solid var(--tl-border-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-header-left h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--tl-text-1);
}

.back-btn {
  font-size: 16px;
  color: var(--tl-text-3);
  padding: 8px;
  min-width: 36px;
  min-height: 36px;
  border-radius: var(--tl-radius-md);
}

.back-btn:hover {
  color: var(--tl-primary);
  background: var(--tl-primary-soft);
}

/* ── Messages ── */
.chat-messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
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
  width: 72px;
  height: 72px;
  border-radius: var(--tl-radius-xl);
  background: var(--tl-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 18px;
  box-shadow: var(--tl-shadow-primary);
}

.welcome-area h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 800;
  color: var(--tl-text-1);
  letter-spacing: -0.3px;
}

.welcome-area > p {
  color: var(--tl-text-4);
  margin: 0 0 28px;
  font-size: 14px;
}

.recommendations {
  max-width: 520px;
  width: 100%;
}

.rec-label {
  font-size: 13px;
  color: var(--tl-text-5);
  margin-bottom: 12px;
}

.rec-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rec-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: var(--tl-bg-card);
  border: 1px solid var(--tl-border-soft);
  border-radius: var(--tl-radius-md);
  cursor: pointer;
  transition: all var(--tl-tx);
}

.rec-card:hover {
  border-color: #c7d2fe;
  background: var(--tl-primary-soft);
  transform: translateX(2px);
}

.rec-text {
  font-size: 14px;
  color: var(--tl-text-2);
  text-align: left;
}

.rec-card :deep(.el-tag) {
  border-radius: 6px;
  background: var(--tl-bg-mute);
  color: var(--tl-text-4);
  border: none;
}

/* ── Message Bubbles ── */
.message-row {
  display: flex;
  max-width: 78%;
}

.message-row.user {
  align-self: flex-end;
}

.message-row.assistant {
  align-self: flex-start;
}

.message-bubble {
  padding: 14px 18px;
  border-radius: var(--tl-radius-lg);
  position: relative;
  box-shadow: var(--tl-shadow-sm);
}

.message-row.user .message-bubble {
  background: var(--tl-gradient-primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-row.assistant .message-bubble {
  background: var(--tl-bg-card);
  color: var(--tl-text-2);
  border: 1px solid var(--tl-border-soft);
  border-bottom-left-radius: 4px;
}

.message-content {
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  font-size: 11px;
  margin-top: 6px;
  opacity: 0.7;
}

.message-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(124, 131, 255, 0.2);
}

.message-row.user .message-actions {
  display: none;
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
  background: var(--tl-primary);
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ── Summary ── */
.summary-section {
  background: linear-gradient(135deg, #ecfeff 0%, #eef2ff 100%);
  border: 1px solid #c7d2fe;
  border-radius: var(--tl-radius-lg);
  padding: 18px 20px;
  margin-top: 8px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 700;
  font-size: 14px;
  color: var(--tl-primary);
}

.summary-content {
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--tl-text-2);
}

/* ── Input ── */
.chat-input-area {
  padding: 16px 24px 20px;
  background: var(--tl-bg-card);
  border-top: 1px solid var(--tl-border-soft);
}

.stream-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.streaming-hint {
  font-size: 13px;
  color: var(--tl-text-5);
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  max-width: 920px;
  margin: 0 auto;
}

.input-row :deep(.el-textarea) {
  flex: 1;
}

.input-row :deep(.el-textarea__inner) {
  border-radius: var(--tl-radius-md);
  padding: 12px 14px;
  background: var(--tl-bg-soft);
  border: 1px solid var(--tl-border-soft);
  transition: all var(--tl-tx);
}

.input-row :deep(.el-textarea__inner:focus) {
  background: #fff;
  border-color: var(--tl-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.send-btn {
  height: 44px;
  padding: 0 22px;
  border-radius: var(--tl-radius-md);
  font-weight: 600;
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
