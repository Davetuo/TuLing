<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from "vue";
import AMapLoader from "@amap/amap-jsapi-loader";
import { Location } from "@element-plus/icons-vue";
import type { PlaceMarker } from "@/shared/types/chat";

interface Props {
  modelValue: boolean;
  text: string;
  places?: PlaceMarker[];
}
const props = withDefaults(defineProps<Props>(), { places: () => [] });
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

interface SpotPoint {
  name: string;
  address: string;
  lng: number;
  lat: number;
  type?: "spot" | "restaurant" | "hotel";
  score?: number | null;
}

const mapContainer = ref<HTMLElement | null>(null);
const loading = ref(false);
const status = ref("");
const points = ref<SpotPoint[]>([]);
let amapApi: any = null;
let amapInstance: any = null;
let amapMarkers: any[] = [];

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}

// 从 AI 文本中提取景点/地名候选词
function extractCandidates(text: string): string[] {
  if (!text) return [];

  // 常见景点后缀（中文）
  const suffixPattern =
    "山|湖|海|湾|岛|江|河|岸|滩|池|泉|" +
    "寺|庙|观|塔|楼|阁|宫|殿|陵|祠|" +
    "园|苑|林|岭|峰|崖|洞|谷|峡|" +
    "公园|广场|博物馆|纪念馆|博物院|艺术馆|展览馆|图书馆|大剧院|音乐厅|" +
    "大学|学院|校园|" +
    "古镇|古城|古村|城墙|长城|" +
    "景区|风景区|风景名胜区|度假区|遗址|新区|" +
    "步行街|商业街|美食街|夜市|" +
    "动物园|植物园|海洋馆|水族馆|乐园|游乐园|主题公园|" +
    "温泉|草原|沙漠|湿地|溶洞";

  // 提取「2-10 个中文字符 + 后缀」结构的词
  const regex = new RegExp(
    `[\\u4e00-\\u9fa5]{1,9}(?:${suffixPattern})`,
    "g",
  );
  const raw = text.match(regex) || [];

  // 去重 + 过滤太常见的单后缀词
  const set = new Set<string>();
  const tooShort = new Set([
    "山",
    "湖",
    "海",
    "湾",
    "岛",
    "寺",
    "塔",
    "园",
    "城",
    "宫",
    "陵",
    "街",
    "园林",
    "山水",
  ]);
  for (const w of raw) {
    if (w.length < 2) continue;
    if (tooShort.has(w)) continue;
    set.add(w);
  }
  return Array.from(set).slice(0, 12); // 最多取 12 个，避免过载
}

// 从文本里挑一个城市名作为高德 city 参数（提升识别准确度）
function pickCity(text: string): string | undefined {
  const cities = [
    "武汉", "北京", "上海", "广州", "深圳", "杭州", "南京", "成都",
    "重庆", "西安", "厦门", "苏州", "天津", "三亚", "长沙", "桂林",
    "丽江", "大理", "昆明", "拉萨", "哈尔滨", "青岛", "济南", "郑州",
    "合肥", "福州", "南昌", "贵阳", "兰州", "西宁", "银川", "乌鲁木齐",
    "呼和浩特", "石家庄", "太原", "沈阳", "长春", "海口", "南宁",
  ];
  for (const c of cities) {
    if (text.includes(c)) return c;
  }
  return undefined;
}

async function ensureAmap() {
  if (amapApi) return amapApi;
  const key = import.meta.env.VITE_AMAP_KEY;
  if (!key) {
    status.value = "未配置 VITE_AMAP_KEY，无法加载高德地图";
    return null;
  }
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (securityCode) {
    window._AMapSecurityConfig = { securityJsCode: securityCode };
  }
  try {
    amapApi = await AMapLoader.load({
      key,
      version: "2.0",
      plugins: ["AMap.ToolBar", "AMap.Scale", "AMap.PlaceSearch"],
    });
    return amapApi;
  } catch {
    status.value = "高德地图加载失败，请检查 Key 与域名白名单";
    return null;
  }
}

function searchPoiByKeyword(
  AMap: any,
  keyword: string,
  city?: string,
): Promise<SpotPoint | null> {
  return new Promise((resolve) => {
    const placeSearch = new AMap.PlaceSearch({
      city: city || "全国",
      citylimit: !!city,
      pageSize: 1,
      pageIndex: 1,
    });
    placeSearch.search(keyword, (s: string, result: any) => {
      if (s !== "complete" || !result?.poiList?.pois?.length) {
        resolve(null);
        return;
      }
      const poi = result.poiList.pois[0];
      const lng =
        typeof poi.location?.getLng === "function"
          ? poi.location.getLng()
          : Number(poi.location?.lng);
      const lat =
        typeof poi.location?.getLat === "function"
          ? poi.location.getLat()
          : Number(poi.location?.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        resolve(null);
        return;
      }
      resolve({
        name: poi.name || keyword,
        address: poi.address || poi.pname || "",
        lng,
        lat,
      });
    });
  });
}

async function load() {
  // ── 路径 A：后端 RAG 已经给出结构化候选 ──
  // 优先用 places 渲染；缺坐标的（如景点表没存 lat/lng）用 amap 现场补
  if (props.places && props.places.length > 0) {
    loading.value = true;
    status.value = "正在准备地图...";

    const AMap = await ensureAmap();
    if (!AMap) {
      loading.value = false;
      return;
    }

    const direct: SpotPoint[] = [];
    const needLookup: PlaceMarker[] = [];
    for (const p of props.places) {
      if (p.lat !== null && p.lng !== null) {
        direct.push({
          name: p.name,
          address: p.address || p.city || "",
          lat: p.lat,
          lng: p.lng,
          type: p.type,
          score: p.score,
        });
      } else {
        needLookup.push(p);
      }
    }

    // 用 amap 补全没坐标的候选（景点）
    const lookupResults = await Promise.all(
      needLookup.map(async (p): Promise<SpotPoint | null> => {
        const sp = await searchPoiByKeyword(AMap, p.name, p.city || undefined);
        if (!sp) return null;
        return {
          name: p.name,
          address: p.address || sp.address,
          lng: sp.lng,
          lat: sp.lat,
          type: p.type,
          score: p.score,
        };
      }),
    );
    const looked: SpotPoint[] = lookupResults.filter(
      (p): p is SpotPoint => p !== null,
    );

    const merged: SpotPoint[] = [...direct, ...looked];
    // 按经纬度去重
    const dedup = new Map<string, SpotPoint>();
    for (const p of merged) {
      const key = `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`;
      if (!dedup.has(key)) dedup.set(key, p);
    }
    points.value = Array.from(dedup.values());

    if (points.value.length === 0) {
      status.value = "回答中提到的地点暂无法在地图上定位";
      loading.value = false;
      return;
    }

    status.value = "";
    await nextTick();
    renderMap(AMap);
    loading.value = false;
    return;
  }

  // ── 路径 B（兜底）：旧消息没有 places，退回到正则提取 + amap 查询 ──
  const candidates = extractCandidates(props.text);
  if (candidates.length === 0) {
    status.value = "未在回答中识别到可定位的景点";
    points.value = [];
    return;
  }

  loading.value = true;
  status.value = "正在通过高德地图查找景点位置...";

  const AMap = await ensureAmap();
  if (!AMap) {
    loading.value = false;
    return;
  }

  const city = pickCity(props.text);
  const results = await Promise.all(
    candidates.map((k) => searchPoiByKeyword(AMap, k, city)),
  );
  const found = results.filter((p): p is SpotPoint => p !== null);

  // 按经纬度去重（同一景点可能出现多次）
  const dedup = new Map<string, SpotPoint>();
  for (const p of found) {
    const key = `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`;
    if (!dedup.has(key)) dedup.set(key, p);
  }
  points.value = Array.from(dedup.values());

  if (points.value.length === 0) {
    status.value = `识别到 ${candidates.length} 个候选词，但高德均未匹配到位置`;
    loading.value = false;
    return;
  }

  status.value = "";
  await nextTick();
  renderMap(AMap);
  loading.value = false;
}

function labelColor(type?: SpotPoint["type"]): string {
  if (type === "restaurant") return "rgba(249, 115, 22, 0.94)";
  if (type === "hotel") return "rgba(2, 132, 199, 0.94)";
  return "rgba(64, 158, 255, 0.92)"; // 景点 / 未知
}

function typeLabel(type?: SpotPoint["type"]): string {
  if (type === "restaurant") return "餐厅";
  if (type === "hotel") return "酒店";
  if (type === "spot") return "景点";
  return "";
}

function renderMap(AMap: any) {
  if (!mapContainer.value || points.value.length === 0) return;

  clearMap();

  amapInstance = new AMap.Map(mapContainer.value, {
    viewMode: "2D",
    zoom: 11,
    center: [points.value[0].lng, points.value[0].lat],
  });
  amapInstance.addControl(new AMap.ToolBar({ position: "RT" }));
  amapInstance.addControl(new AMap.Scale());

  amapMarkers = points.value.map((p, idx) => {
    const color = labelColor(p.type);
    const marker = new AMap.Marker({
      position: [p.lng, p.lat],
      title: p.name,
      label: {
        direction: "right",
        offset: new AMap.Pixel(8, 0),
        content: `<div class="route-map-label" style="background:${color}">${idx + 1}. ${p.name}</div>`,
      },
    });
    marker.on("click", () => {
      const tLabel = typeLabel(p.type);
      const tBadge = tLabel
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:${color};color:#fff;font-size:11px;margin-right:6px">${tLabel}</span>`
        : "";
      const scoreInfo =
        p.score !== undefined && p.score !== null
          ? `<span style="color:#f59e0b;font-size:12px">★ ${p.score.toFixed(1)}</span>`
          : "";
      const infoWindow = new AMap.InfoWindow({
        anchor: "bottom-center",
        content: `<div style="padding:6px 8px;min-width:160px"><div>${tBadge}<strong>${p.name}</strong> ${scoreInfo}</div><div style="color:#909399;font-size:12px;margin-top:4px">${p.address || ""}</div></div>`,
      });
      infoWindow.open(amapInstance, [p.lng, p.lat]);
    });
    amapInstance.add(marker);
    return marker;
  });

  amapInstance.setFitView(amapMarkers, false, [50, 50, 50, 50]);
}

function clearMap() {
  amapMarkers.forEach((m) => m.setMap(null));
  amapMarkers = [];
  if (amapInstance) {
    amapInstance.destroy();
    amapInstance = null;
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      nextTick(load);
    } else {
      clearMap();
      status.value = "";
      points.value = [];
    }
  },
);

onBeforeUnmount(clearMap);

function close() {
  emit("update:modelValue", false);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="路线地图"
    width="90%"
    style="max-width: 900px"
    :before-close="close"
    destroy-on-close
  >
    <div class="route-map-wrapper">
      <div
        v-if="loading || status"
        class="route-map-status"
        :class="{ error: !loading && points.length === 0 }"
      >
        <el-icon v-if="loading" class="is-loading"><Location /></el-icon>
        {{ status }}
      </div>

      <div
        v-show="points.length > 0"
        ref="mapContainer"
        class="route-map-container"
      ></div>

      <div v-if="points.length > 0" class="route-map-legend">
        <div
          v-for="(p, idx) in points"
          :key="idx"
          class="route-map-legend-item"
        >
          <span
            class="route-map-index"
            :style="{ background: labelColor(p.type) }"
          >{{ idx + 1 }}</span>
          <span
            v-if="typeLabel(p.type)"
            class="route-map-type"
            :style="{ background: labelColor(p.type) }"
          >{{ typeLabel(p.type) }}</span>
          <strong>{{ p.name }}</strong>
          <span
            v-if="p.score !== null && p.score !== undefined"
            class="route-map-score"
          >★ {{ p.score.toFixed(1) }}</span>
          <span v-if="p.address" class="route-map-addr">{{ p.address }}</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.route-map-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.route-map-status {
  padding: 32px 16px;
  text-align: center;
  color: #606266;
  font-size: 14px;
}

.route-map-status.error {
  color: #909399;
}

.route-map-container {
  width: 100%;
  height: 420px;
  border-radius: 8px;
  overflow: hidden;
  background: #eef2f7;
}

.route-map-legend {
  max-height: 180px;
  overflow-y: auto;
  padding: 12px;
  background: #f7faff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-map-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.route-map-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.route-map-type {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  background: #409eff;
  color: #fff;
  font-size: 11px;
  flex-shrink: 0;
}

.route-map-score {
  color: #f59e0b;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.route-map-addr {
  color: #909399;
  font-size: 12px;
}
</style>

<style>
.route-map-label {
  padding: 2px 8px;
  background: rgba(64, 158, 255, 0.92);
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}
</style>
