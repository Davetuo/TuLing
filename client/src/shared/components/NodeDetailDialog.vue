<script setup lang="ts">
import { computed } from "vue";
import { Location, Phone, Money, Clock, Star } from "@element-plus/icons-vue";
import type { RoutePoint } from "@/shared/types/trip";

interface Props {
  modelValue: boolean;
  node: RoutePoint | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const typeMeta = computed(() => {
  const type = props.node?.type || "spot";
  switch (type) {
    case "meal":
      return {
        label: "餐饮推荐",
        color: "#f97316",
        emoji: "🍜",
        costLabel: "人均",
        costSuffix: "/人",
      };
    case "hotel":
      return {
        label: "住宿推荐",
        color: "#8b5cf6",
        emoji: "🏨",
        costLabel: "均价",
        costSuffix: "/晚",
      };
    case "spot":
    default:
      return {
        label: "景点推荐",
        color: "#6366f1",
        emoji: "🏛",
        costLabel: "门票",
        costSuffix: props.node?.cost === 0 ? "" : "/人",
      };
  }
});

const ratingDisplay = computed(() => {
  const r = props.node?.rating;
  if (!r || r <= 0) return null;
  return r.toFixed(1);
});

const costDisplay = computed(() => {
  if (props.node?.cost == null) return null;
  if (props.node.cost === 0) return "免费";
  return `¥${props.node.cost}`;
});
</script>

<template>
  <el-dialog
    v-model="visible"
    :show-close="true"
    width="480px"
    class="node-detail-dialog"
    :align-center="true"
  >
    <template #header>
      <div class="dialog-header">
        <span
          class="header-badge"
          :style="{ backgroundColor: typeMeta.color }"
        >
          {{ typeMeta.emoji }} {{ typeMeta.label }}
        </span>
      </div>
    </template>

    <div v-if="node" class="detail-body">
      <div
        v-if="node.thumbnail"
        class="hero"
        :style="{ backgroundImage: `url(${node.thumbnail})` }"
      />
      <div v-else class="hero hero-empty">
        <span class="hero-emoji">{{ typeMeta.emoji }}</span>
      </div>

      <div class="info-block">
        <h3 class="name">{{ node.name }}</h3>
        <div v-if="node.category" class="category">{{ node.category }}</div>

        <div class="meta-row">
          <div v-if="ratingDisplay" class="meta-item">
            <el-icon :color="typeMeta.color"><Star /></el-icon>
            <span class="meta-value">{{ ratingDisplay }}</span>
            <span class="meta-label">评分</span>
          </div>
          <div v-if="costDisplay" class="meta-item">
            <el-icon :color="typeMeta.color"><Money /></el-icon>
            <span class="meta-value">{{ costDisplay }}</span>
            <span v-if="node.cost && node.cost > 0" class="meta-label">
              {{ typeMeta.costLabel }}{{ typeMeta.costSuffix }}
            </span>
          </div>
          <div class="meta-item">
            <el-icon :color="typeMeta.color"><Clock /></el-icon>
            <span class="meta-value">{{ node.start }}-{{ node.end }}</span>
            <span class="meta-label">{{ node.duration }}</span>
          </div>
        </div>

        <div class="line">
          <el-icon :color="typeMeta.color"><Location /></el-icon>
          <span>{{ node.address }}</span>
        </div>

        <div v-if="node.transport" class="line subtle">
          <span>· {{ node.transport }}</span>
        </div>

        <p v-if="node.note" class="note">{{ node.note }}</p>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero {
  width: 100%;
  height: 180px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  background-color: #f1f5f9;
}

.hero-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
}

.hero-emoji {
  font-size: 64px;
  opacity: 0.7;
}

.info-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.category {
  font-size: 13px;
  color: #64748b;
  background: #f1f5f9;
  display: inline-block;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 6px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}

.meta-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 13px;
  color: #64748b;
}

.meta-value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.meta-label {
  font-size: 12px;
  color: #94a3b8;
}

.line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.line.subtle {
  color: #94a3b8;
}

.note {
  margin: 4px 0 0;
  padding: 10px 12px;
  background: #f8fafc;
  border-left: 3px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  color: #475569;
  line-height: 1.7;
}

:deep(.el-dialog__body) {
  padding: 0 20px 20px;
}

:deep(.el-dialog__header) {
  padding: 16px 20px 0;
  margin-right: 0;
}
</style>
