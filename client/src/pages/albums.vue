<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeft,
  Calendar,
  Close,
  Delete,
  Location,
  Picture,
  Plus,
  Upload,
  ZoomIn,
} from "@element-plus/icons-vue";
import {
  ElMessage,
  ElMessageBox,
  type UploadFile,
  type UploadInstance,
} from "element-plus";
import {
  deleteMemory,
  listMemories,
  uploadMemory,
} from "@/shared/api/memory";
import type { Memory } from "@/shared/types/memory";

const router = useRouter();

const memories = ref<Memory[]>([]);
const loading = ref(false);
const uploading = ref(false);
const showUploadDialog = ref(false);
const previewMemory = ref<Memory | null>(null);

const uploadRef = ref<UploadInstance>();
const pendingFile = ref<File | null>(null);
const pendingPreview = ref("");
const uploadForm = ref({
  title: "",
  location: "",
  takenAt: "",
});

const totalCount = computed(() => memories.value.length);
const cityCount = computed(() => {
  const set = new Set<string>();
  memories.value.forEach((m) => {
    const loc = m.location.trim();
    if (loc) set.add(loc);
  });
  return set.size;
});
const earliestYear = computed(() => {
  const dates = memories.value
    .map((m) => m.takenAt || m.createdAt)
    .filter(Boolean)
    .map((d) => new Date(d).getFullYear());
  return dates.length > 0 ? Math.min(...dates) : null;
});

// ── 加载图片墙 ──

async function loadMemories() {
  loading.value = true;
  try {
    const data = await listMemories(1, 60);
    memories.value = data.items;
  } catch {
    // 拦截器已弹错误提示
  } finally {
    loading.value = false;
  }
}

// ── 上传图片 ──

function openUploadDialog() {
  pendingFile.value = null;
  pendingPreview.value = "";
  uploadForm.value = { title: "", location: "", takenAt: "" };
  showUploadDialog.value = true;
}

function handleFileChange(uploadFile: UploadFile) {
  // auto-upload=false 下,选择文件触发 on-change(status='ready')
  // before-upload 钩子只在调用 submit() 后才触发,这里用 on-change 才能拿到选中的文件
  const file = uploadFile.raw;
  if (!file) return;

  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    ElMessage.warning("仅支持 JPG / PNG / WEBP / GIF 格式");
    uploadRef.value?.clearFiles();
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning("图片不能超过 10MB");
    uploadRef.value?.clearFiles();
    return;
  }

  pendingFile.value = file;

  if (pendingPreview.value) {
    URL.revokeObjectURL(pendingPreview.value);
  }
  pendingPreview.value = URL.createObjectURL(file);
}

function clearPendingFile() {
  pendingFile.value = null;
  if (pendingPreview.value) {
    URL.revokeObjectURL(pendingPreview.value);
    pendingPreview.value = "";
  }
  uploadRef.value?.clearFiles();
}

async function submitUpload() {
  if (!pendingFile.value) {
    ElMessage.warning("请选择要上传的图片");
    return;
  }

  uploading.value = true;
  try {
    const created = await uploadMemory({
      file: pendingFile.value,
      title: uploadForm.value.title.trim() || undefined,
      location: uploadForm.value.location.trim() || undefined,
      takenAt: uploadForm.value.takenAt || undefined,
    });
    memories.value.unshift(created);
    ElMessage.success("已添加到纪念墙");
    closeUploadDialog();
  } catch {
    // 拦截器已弹错误
  } finally {
    uploading.value = false;
  }
}

function closeUploadDialog() {
  showUploadDialog.value = false;
  clearPendingFile();
}

// ── 删除图片 ──

async function handleDelete(memory: Memory) {
  try {
    await ElMessageBox.confirm(
      memory.title
        ? `确认删除「${memory.title}」？删除后无法恢复。`
        : "确认删除这张图片？删除后无法恢复。",
      "删除图片",
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
    await deleteMemory(memory.id);
    memories.value = memories.value.filter((m) => m.id !== memory.id);
    if (previewMemory.value?.id === memory.id) previewMemory.value = null;
    ElMessage.success("已删除");
  } catch {
    // 拦截器已弹错误
  }
}

// ── 预览 ──

function openPreview(memory: Memory) {
  previewMemory.value = memory;
}

function closePreview() {
  previewMemory.value = null;
}

// ── 工具 ──

function resolveImage(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return url;
}

function formatDate(memory: Memory): string {
  const raw = memory.takenAt || memory.createdAt;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

onMounted(() => {
  loadMemories();
});
</script>

<template>
  <div class="tl-page albums-page">
    <!-- ── 顶栏 ── -->
    <div class="topbar">
      <el-button text class="back-btn" @click="router.push('/home')">
        <el-icon><ArrowLeft /></el-icon>
        返回首页
      </el-button>
      <el-button
        type="primary"
        round
        :icon="Plus"
        @click="openUploadDialog"
        class="upload-cta"
      >
        上传图片
      </el-button>
    </div>

    <!-- ── Hero ── -->
    <section class="hero">
      <div class="hero-text">
        <h1>我的<span class="tl-grad-text">旅行纪念墙</span></h1>
        <p>把走过的每一段路都珍藏在这里，让回忆被看见。</p>
      </div>
      <div class="hero-stats">
        <div class="stat-card">
          <span class="stat-num">{{ totalCount }}</span>
          <span class="stat-label">张图片</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ cityCount }}</span>
          <span class="stat-label">个目的地</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ earliestYear ?? "—" }}</span>
          <span class="stat-label">最早回忆</span>
        </div>
      </div>
    </section>

    <!-- ── 图片墙 ── -->
    <section
      v-loading="loading && memories.length === 0"
      class="wall-section"
    >
      <div
        v-if="!loading && memories.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          <el-icon :size="56"><Picture /></el-icon>
        </div>
        <h3>还没有任何旅行回忆</h3>
        <p>点击右上角「上传图片」，开始你的第一面纪念墙吧。</p>
        <el-button
          type="primary"
          round
          :icon="Upload"
          @click="openUploadDialog"
        >
          上传第一张图片
        </el-button>
      </div>

      <div v-else class="masonry">
        <article
          v-for="memory in memories"
          :key="memory.id"
          class="memory-card"
        >
          <div class="memory-cover" @click="openPreview(memory)">
            <img
              :src="resolveImage(memory.imageUrl)"
              :alt="memory.title || '旅行回忆'"
              loading="lazy"
            />
            <div class="memory-overlay">
              <el-icon class="zoom-icon"><ZoomIn /></el-icon>
            </div>
            <button
              class="delete-btn"
              type="button"
              title="删除"
              @click.stop="handleDelete(memory)"
            >
              <el-icon><Delete /></el-icon>
            </button>
          </div>
          <div class="memory-meta">
            <strong v-if="memory.title">{{ memory.title }}</strong>
            <strong v-else class="meta-placeholder">未命名回忆</strong>
            <div class="meta-row">
              <span v-if="memory.location" class="meta-chip">
                <el-icon><Location /></el-icon>{{ memory.location }}
              </span>
              <span v-if="formatDate(memory)" class="meta-chip">
                <el-icon><Calendar /></el-icon>{{ formatDate(memory) }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ── 上传对话框 ── -->
    <el-dialog
      v-model="showUploadDialog"
      title="上传旅行图片"
      width="520px"
      :close-on-click-modal="false"
      :before-close="(done: () => void) => { if (!uploading) { closeUploadDialog(); done(); } }"
    >
      <div class="upload-body">
        <div v-if="!pendingPreview" class="upload-dropzone">
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :show-file-list="false"
            :multiple="false"
            accept="image/jpeg,image/png,image/webp,image/gif"
            :on-change="handleFileChange"
          >
            <el-icon class="upload-icon"><Upload /></el-icon>
            <div class="upload-tip">
              <strong>点击或拖拽图片到此处</strong>
              <span>JPG / PNG / WEBP / GIF，最大 10MB</span>
            </div>
          </el-upload>
        </div>

        <div v-else class="upload-preview-wrap">
          <img :src="pendingPreview" alt="预览" />
          <el-button
            text
            class="reselect-btn"
            :icon="Close"
            @click="clearPendingFile"
          >
            重选
          </el-button>
        </div>

        <el-form label-position="top" class="upload-form">
          <el-form-item label="标题（选填）">
            <el-input
              v-model="uploadForm.title"
              maxlength="100"
              show-word-limit
              placeholder="如：洱海日出"
            />
          </el-form-item>
          <el-form-item label="目的地（选填）">
            <el-input
              v-model="uploadForm.location"
              maxlength="100"
              placeholder="如：大理"
            />
          </el-form-item>
          <el-form-item label="拍摄日期（选填）">
            <el-date-picker
              v-model="uploadForm.takenAt"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="closeUploadDialog" :disabled="uploading"
          >取消</el-button
        >
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!pendingFile"
          @click="submitUpload"
        >
          {{ uploading ? "上传中..." : "保存到纪念墙" }}
        </el-button>
      </template>
    </el-dialog>

    <!-- ── 图片预览（灯箱） ── -->
    <el-dialog
      :model-value="!!previewMemory"
      width="80vw"
      append-to-body
      :show-close="false"
      class="preview-dialog"
      @update:model-value="(val: boolean) => { if (!val) closePreview() }"
    >
      <div v-if="previewMemory" class="preview-content">
        <button class="preview-close" type="button" @click="closePreview">
          <el-icon :size="22"><Close /></el-icon>
        </button>
        <img
          :src="resolveImage(previewMemory.imageUrl)"
          :alt="previewMemory.title || '旅行回忆'"
        />
        <div class="preview-info">
          <h3>{{ previewMemory.title || "未命名回忆" }}</h3>
          <div class="preview-meta-row">
            <span v-if="previewMemory.location">
              <el-icon><Location /></el-icon>{{ previewMemory.location }}
            </span>
            <span v-if="formatDate(previewMemory)">
              <el-icon><Calendar /></el-icon>{{ formatDate(previewMemory) }}
            </span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.albums-page {
  max-width: 1200px;
}

/* ── 顶栏 ── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.back-btn {
  font-size: 14px;
  color: var(--tl-text-3);
  background: var(--tl-bg-card);
  padding: 8px 16px;
  border-radius: var(--tl-radius-pill);
  box-shadow: var(--tl-shadow-sm);
}

.back-btn:hover {
  color: var(--tl-primary);
}

.back-btn .el-icon {
  margin-right: 4px;
}

.upload-cta {
  background: linear-gradient(135deg, #f472b6, #ec4899);
  border: none;
  color: #fff;
  padding: 12px 22px;
  height: auto;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(236, 72, 153, 0.3);
}

.upload-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(236, 72, 153, 0.42);
}

/* ── Hero ── */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 24px;
  align-items: center;
  padding: 32px 36px;
  background: linear-gradient(135deg, #fdf2f8 0%, #fef3c7 50%, #ede9fe 100%);
  border-radius: var(--tl-radius-2xl);
  margin-bottom: 24px;
}

.hero-text h1 {
  margin: 0 0 10px;
  font-size: 32px;
  font-weight: 800;
  line-height: 1.25;
  color: var(--tl-text-1);
  letter-spacing: -0.5px;
}

.hero-text p {
  margin: 0;
  color: var(--tl-text-3);
  font-size: 15px;
  line-height: 1.7;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.85);
  border-radius: var(--tl-radius-lg);
  padding: 16px 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.stat-num {
  display: block;
  font-size: 24px;
  font-weight: 800;
  color: var(--tl-text-1);
  line-height: 1.2;
}

.stat-label {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--tl-text-4);
}

/* ── 图片墙 ── */
.wall-section {
  min-height: 240px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  text-align: center;
  background: var(--tl-bg-card, #fff);
  border-radius: var(--tl-radius-xl);
  border: 1px dashed #e4e7ed;
}

.empty-icon {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fdf2f8, #ede9fe);
  color: #ec4899;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 6px;
  font-size: 18px;
  color: var(--tl-text-1);
}

.empty-state p {
  margin: 0 0 18px;
  color: var(--tl-text-4);
  font-size: 14px;
}

.masonry {
  column-count: 4;
  column-gap: 16px;
}

.memory-card {
  break-inside: avoid;
  margin-bottom: 16px;
  background: var(--tl-bg-card, #fff);
  border-radius: var(--tl-radius-lg);
  overflow: hidden;
  box-shadow: var(--tl-shadow-sm);
  border: 1px solid #f1f5f9;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.memory-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
}

.memory-cover {
  position: relative;
  cursor: zoom-in;
  background: #f5f7fa;
}

.memory-cover img {
  display: block;
  width: 100%;
  height: auto;
}

.memory-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 60%,
    rgba(0, 0, 0, 0.35) 100%
  );
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 12px;
  pointer-events: none;
}

.memory-cover:hover .memory-overlay {
  opacity: 1;
}

.zoom-icon {
  color: #fff;
  font-size: 22px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  padding: 6px;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  color: #ef4444;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.85);
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.memory-card:hover .delete-btn {
  opacity: 1;
  transform: scale(1);
}

.delete-btn:hover {
  background: #ef4444;
  color: #fff;
}

.memory-meta {
  padding: 12px 14px 14px;
}

.memory-meta strong {
  display: block;
  font-size: 14px;
  color: var(--tl-text-1);
  font-weight: 600;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-placeholder {
  color: var(--tl-text-5) !important;
  font-weight: 500 !important;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 11px;
}

.meta-chip .el-icon {
  font-size: 12px;
}

/* ── 上传对话框 ── */
.upload-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-dropzone :deep(.el-upload-dragger) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: #fafafa;
  border: 2px dashed #e4e7ed;
  border-radius: 12px;
  transition: border-color 0.2s;
}

.upload-dropzone :deep(.el-upload-dragger:hover) {
  border-color: #ec4899;
}

.upload-icon {
  font-size: 36px;
  color: #ec4899;
  margin-bottom: 8px;
}

.upload-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.upload-tip strong {
  color: var(--tl-text-1);
  font-size: 14px;
}

.upload-tip span {
  color: var(--tl-text-5);
  font-size: 12px;
}

.upload-preview-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
  max-height: 260px;
  display: flex;
  justify-content: center;
}

.upload-preview-wrap img {
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
}

.reselect-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 999px;
  padding: 4px 12px;
}

.reselect-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.upload-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

/* ── 预览对话框 ── */
.preview-dialog :deep(.el-dialog) {
  background: transparent;
  box-shadow: none;
  margin-top: 5vh !important;
}

.preview-dialog :deep(.el-dialog__header) {
  display: none;
}

.preview-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.preview-content {
  position: relative;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-content img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  display: block;
}

.preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: background 0.2s;
}

.preview-close:hover {
  background: #fff;
}

.preview-info {
  width: 100%;
  padding: 18px 24px 24px;
  color: #fff;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 100%);
}

.preview-info h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
}

.preview-meta-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 14px;
  opacity: 0.9;
}

.preview-meta-row span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ── 响应式 ── */
@media (max-width: 1100px) {
  .masonry {
    column-count: 3;
  }
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 24px;
  }

  .hero-text h1 {
    font-size: 26px;
  }

  .masonry {
    column-count: 2;
  }
}

@media (max-width: 560px) {
  .topbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .masonry {
    column-count: 1;
  }

  .hero-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .stat-num {
    font-size: 20px;
  }
}
</style>
