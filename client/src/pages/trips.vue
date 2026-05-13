<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import AMapLoader from "@amap/amap-jsapi-loader";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import {
  Calendar,
  Clock,
  Download,
  Edit,
  Delete,
  List,
  Location,
  Money,
  Plus,
  Sunny,
  Van,
} from "@element-plus/icons-vue";
import { getWeatherForecast } from "@/shared/api/weather";
import {
  createTrip,
  deleteTrip,
  listTrips,
  updateTrip,
} from "@/shared/api/trips";
import { useAuthStore } from "@/stores/auth";
import type {
  BudgetItem,
  DailyPlan,
  Pace,
  RoutePoint,
  TripPayload,
  TripPlan,
} from "@/shared/types/trip";

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

interface AmapPoi {
  id: string;
  name: string;
  area: string;
  address: string;
  lng: number;
  lat: number;
  rating?: number;
  type?: string;
}

const LEGACY_HISTORY_KEY = "tuling-trip-history-v2";

const preferences = [
  "历史文化",
  "自然风光",
  "亲子友好",
  "美食夜游",
  "轻松少走路",
  "拍照出片",
];
const paceOptions = [
  { label: "舒缓", value: "relaxed" },
  { label: "均衡", value: "balanced" },
  { label: "紧凑", value: "compact" },
] as const;

const form = reactive({
  destination: "西安",
  dateRange: [] as string[],
  days: 3,
  people: 2,
  budget: 3600,
  pace: "balanced" as Pace,
  preferences: ["历史文化", "美食夜游"] as string[],
});

const activeTab = ref("map");
const selectedDay = ref(1);
const currentPlan = ref<TripPlan | null>(null);
const history = ref<TripPlan[]>([]);
const amapContainer = ref<HTMLElement | null>(null);
const amapStatus = ref("");
const weatherLoading = ref(false);
const generating = ref(false);
const authStore = useAuthStore();
const router = useRouter();
let amapInstance: any = null;
let amapPolyline: any = null;
let amapDriving: any = null;
let amapMarkers: any[] = [];
let amapApi: any = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const currentDailyPlan = computed(() => {
  if (!currentPlan.value) return null;
  return (
    currentPlan.value.dailyPlans.find(
      (item) => item.day === selectedDay.value,
    ) || currentPlan.value.dailyPlans[0]
  );
});

const mapPoints = computed(() => currentDailyPlan.value?.nodes || []);

const amapConfigured = computed(() => Boolean(import.meta.env.VITE_AMAP_KEY));

const totalBudget = computed(() => {
  return (
    currentPlan.value?.budgetItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    ) || 0
  );
});

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateText: string, amount: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`).getTime();
  const endDate = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(startDate) || Number.isNaN(endDate)) return form.days;
  return Math.max(
    1,
    Math.min(15, Math.round((endDate - startDate) / 86400000) + 1),
  );
}

async function buildPlan() {
  if (generating.value) return;
  const destination = form.destination.trim() || "西安";
  const startDate = form.dateRange[0] || todayString();
  const endDate = form.dateRange[1] || addDays(startDate, form.days - 1);
  const days =
    form.dateRange.length === 2
      ? daysBetween(startDate, endDate)
      : Math.max(1, Math.min(15, form.days));
  const nodesPerDay =
    form.pace === "compact" ? 4 : form.pace === "relaxed" ? 2 : 3;
  const neededCount = days * nodesPerDay;

  generating.value = true;
  amapStatus.value = "正在从高德地图检索真实景点...";
  let pois: AmapPoi[];
  try {
    pois = await searchRealPois(destination, neededCount);
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? error.message
        : "高德景点检索失败，请检查地图 Key 后重试",
    );
    generating.value = false;
    return;
  } finally {
    amapStatus.value = "";
  }

  if (!pois.length) {
    ElMessage.error("未检索到可规划的真实景点，请换一个目的地或偏好");
    generating.value = false;
    return;
  }

  const timeSlots = [
    ["09:00", "11:00"],
    ["11:30", "13:30"],
    ["14:30", "16:30"],
    ["19:00", "21:00"],
  ];

  const dailyPlans: DailyPlan[] = Array.from(
    { length: days },
    (_, dayIndex) => {
      const dailyPois = orderPoisByNearest(
        pois.slice(dayIndex * nodesPerDay, (dayIndex + 1) * nodesPerDay),
      );
      const nodes = dailyPois.map((source, nodeIndex) => {
        const [start, end] = timeSlots[nodeIndex];
        return {
          id: source.id || `d${dayIndex + 1}-${nodeIndex + 1}`,
          day: dayIndex + 1,
          order: nodeIndex + 1,
          name: source.name,
          area: source.area,
          address: source.address,
          start,
          end,
          duration: nodeIndex === nodesPerDay - 1 ? "90分钟" : "120分钟",
          transport:
            nodeIndex === 0
              ? "酒店出发，打车或地铁前往"
              : "地铁/步行衔接，控制换乘次数",
          note: buildNodeNote(source.name, form.preferences, nodeIndex),
          lng: source.lng,
          lat: source.lat,
          rating: source.rating,
          type: source.type,
        };
      });

      return {
        day: dayIndex + 1,
        date: addDays(startDate, dayIndex),
        theme: buildDayTheme(destination, dayIndex, form.preferences),
        summary: `${destination}第 ${dayIndex + 1} 天安排 ${nodes.length} 个节点，兼顾${form.preferences.slice(0, 2).join("、") || "核心景点"}与交通顺路性。`,
        distance: "路线计算中",
        transitTime: "路线计算中",
        nodes,
      };
    },
  ).filter((day) => day.nodes.length > 0);

  const budgetItems = buildBudget(form.budget, form.people, days);
  const draft: TripPayload = {
    title: `${destination}${days}日智能行程`,
    destination,
    startDate,
    endDate: addDays(startDate, days - 1),
    days,
    people: form.people,
    budget: form.budget,
    pace: form.pace,
    preferences: [...form.preferences],
    summary: `已根据目的地、出行日期、预算和偏好生成 ${days} 天路线，地图中可按天查看景点顺序和交通走向。`,
    dailyPlans,
    budgetItems,
    weather: buildWeather(startDate, days),
  };

  let plan: TripPlan;
  try {
    plan = await createTrip(draft);
  } catch {
    generating.value = false;
    return;
  }

  currentPlan.value = plan;
  selectedDay.value = 1;
  activeTab.value = "map";
  upsertHistory(plan);
  loadWeatherForPlan(plan);
  nextTick(renderAmapRoute);
  generating.value = false;
  ElMessage.success("已生成行程方案");
}

function buildNodeNote(name: string, prefs: string[], index: number) {
  if (prefs.includes("美食夜游") && index >= 2)
    return `${name}适合安排在傍晚后，预留拍照和小吃时间。`;
  if (prefs.includes("轻松少走路"))
    return `${name}周边交通便利，建议减少跨区折返。`;
  if (prefs.includes("亲子友好"))
    return `${name}建议提前确认休息点和洗手间位置。`;
  return `${name}作为当天核心节点，建议提前预约并错峰进入。`;
}

function buildDayTheme(destination: string, dayIndex: number, prefs: string[]) {
  const themes = [
    "城市初见与经典地标",
    "文化深度与街区漫游",
    "近郊延展与夜游收尾",
    "慢行补完与自由购物",
  ];
  if (prefs.includes("自然风光") && dayIndex === 1)
    return `${destination}自然风光线`;
  if (prefs.includes("美食夜游") && dayIndex === 2)
    return `${destination}夜游美食线`;
  return themes[dayIndex % themes.length];
}

function buildBudget(
  total: number,
  people: number,
  days: number,
): BudgetItem[] {
  const safeTotal = Math.max(800, total);
  return [
    {
      label: "住宿",
      amount: Math.round(safeTotal * 0.34),
      note: `${days - 1 || 1} 晚，按 ${people} 人估算`,
    },
    {
      label: "门票预约",
      amount: Math.round(safeTotal * 0.22),
      note: "优先覆盖核心景区和展馆",
    },
    {
      label: "餐饮",
      amount: Math.round(safeTotal * 0.24),
      note: "含当地特色餐与简餐",
    },
    {
      label: "市内交通",
      amount: Math.round(safeTotal * 0.14),
      note: "地铁、打车与近郊往返",
    },
    {
      label: "机动预留",
      amount: Math.round(safeTotal * 0.06),
      note: "应对排队、寄存和临时调整",
    },
  ];
}

function buildWeather(startDate: string, days: number) {
  const texts = ["晴间多云", "多云", "小雨转阴", "晴"];
  return Array.from({ length: days }, (_, index) => ({
    date: addDays(startDate, index),
    text: texts[index % texts.length],
    temp: `${18 + index}-${27 + index}℃`,
    wind: "",
    humidity: "",
    precip: "",
    tip:
      index % 3 === 2
        ? "带折叠伞，室内景点可作为备选。"
        : "适合步行游览，注意补水和防晒。",
  }));
}

async function loadWeatherForPlan(plan: TripPlan) {
  weatherLoading.value = true;
  try {
    const { data } = await getWeatherForecast(plan.destination, plan.days);
    plan.weather = data.daily;
    schedulePersist(plan);
  } catch {
    ElMessage.warning("天气 API 未配置或暂不可用，已使用本地示例天气");
  } finally {
    weatherLoading.value = false;
  }
}

function getPoiKeywords() {
  const keywords = ["景区", "风景名胜", "博物馆", "公园"];
  if (form.preferences.includes("历史文化"))
    keywords.push("历史古迹", "纪念馆", "文化景点");
  if (form.preferences.includes("自然风光"))
    keywords.push("自然风景区", "森林公园", "湖泊");
  if (form.preferences.includes("亲子友好"))
    keywords.push("动物园", "科技馆", "主题公园");
  if (form.preferences.includes("美食夜游"))
    keywords.push("夜市", "步行街", "美食街");
  if (form.preferences.includes("拍照出片"))
    keywords.push("观景台", "艺术街区", "网红景点");
  return Array.from(new Set(keywords));
}

async function searchRealPois(
  destination: string,
  neededCount: number,
): Promise<AmapPoi[]> {
  const AMap = await ensureAmap();
  if (!AMap) {
    throw new Error("未能加载高德地图，无法基于真实景点规划");
  }

  const keywords = getPoiKeywords();
  const batches = await Promise.all(
    keywords.map((keyword) => searchPoiByKeyword(AMap, destination, keyword)),
  );
  const unique = new Map<string, AmapPoi>();

  batches.flat().forEach((poi) => {
    const key = poi.id || `${poi.name}-${poi.lng}-${poi.lat}`;
    if (!unique.has(key)) unique.set(key, poi);
  });

  return Array.from(unique.values())
    .filter((poi) => Number.isFinite(poi.lng) && Number.isFinite(poi.lat))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, Math.max(neededCount, 8));
}

function searchPoiByKeyword(
  AMap: any,
  city: string,
  keyword: string,
): Promise<AmapPoi[]> {
  return new Promise((resolve) => {
    const placeSearch = new AMap.PlaceSearch({
      city,
      citylimit: true,
      pageSize: 20,
      pageIndex: 1,
      extensions: "all",
    });

    placeSearch.search(keyword, (status: string, result: any) => {
      if (status !== "complete" || !result?.poiList?.pois) {
        resolve([]);
        return;
      }

      const pois = result.poiList.pois
        .map((item: any) => {
          const lng = getLng(item.location);
          const lat = getLat(item.location);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
          return {
            id: item.id || `${item.name}-${lng}-${lat}`,
            name: item.name,
            area: item.adname || item.pname || city,
            address: item.address || item.name,
            lng,
            lat,
            rating:
              Number.parseFloat(item.biz_ext?.rating || item.rating || "0") ||
              0,
            type: item.type,
          } satisfies AmapPoi;
        })
        .filter(Boolean) as AmapPoi[];

      resolve(pois);
    });
  });
}

function getLng(location: any) {
  if (!location) return Number.NaN;
  if (typeof location.getLng === "function") return location.getLng();
  return Number(location.lng);
}

function getLat(location: any) {
  if (!location) return Number.NaN;
  if (typeof location.getLat === "function") return location.getLat();
  return Number(location.lat);
}

function orderPoisByNearest(pois: AmapPoi[]) {
  if (pois.length <= 2) return pois;
  const remaining = [...pois];
  const ordered = [remaining.shift() as AmapPoi];

  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((poi, index) => {
      const distance = Math.hypot(poi.lng - last.lng, poi.lat - last.lat);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return ordered;
}

async function ensureAmap() {
  if (amapApi) return amapApi;
  const key = import.meta.env.VITE_AMAP_KEY;
  if (!key) {
    amapStatus.value = "未配置 VITE_AMAP_KEY，无法加载高德地图";
    return null;
  }
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (securityCode) {
    window._AMapSecurityConfig = { securityJsCode: securityCode };
  }
  amapStatus.value = "正在加载高德地图...";
  try {
    amapApi = await AMapLoader.load({
      key,
      version: "2.0",
      plugins: [
        "AMap.ToolBar",
        "AMap.Scale",
        "AMap.PlaceSearch",
        "AMap.Driving",
      ],
    });
    amapStatus.value = "";
    return amapApi;
  } catch {
    amapStatus.value = "高德地图加载失败，请检查 Key、安全密钥和域名白名单";
    return null;
  }
}

async function renderAmapRoute() {
  if (activeTab.value !== "map" || !currentDailyPlan.value) return;
  await nextTick();
  if (!amapContainer.value) return;

  const AMap = await ensureAmap();
  if (!AMap) return;

  const points = currentDailyPlan.value.nodes.map((point) => [
    point.lng,
    point.lat,
  ]);
  if (!points.length) return;

  if (!amapInstance) {
    amapInstance = new AMap.Map(amapContainer.value, {
      viewMode: "2D",
      zoom: 12,
      center: points[0],
      mapStyle: "amap://styles/darkblue",
    });
    amapInstance.addControl(new AMap.ToolBar({ position: "RT" }));
    amapInstance.addControl(new AMap.Scale());
  }

  clearAmapOverlays();

  amapMarkers = currentDailyPlan.value.nodes.map((point) => {
    const marker = new AMap.Marker({
      position: [point.lng, point.lat],
      title: point.name,
      label: {
        direction: "right",
        offset: new AMap.Pixel(10, 0),
        content: `<div class="amap-route-label">${point.day}-${point.order} ${point.name}</div>`,
      },
      content: `<div class="amap-route-marker">${point.day}-${point.order}</div>`,
    });
    marker.on("click", () => {
      const btnId = `tl-review-jump-${point.day}-${point.order}`;
      const infoWindow = new AMap.InfoWindow({
        anchor: "bottom-center",
        offset: new AMap.Pixel(0, -28),
        content: `<div class="tl-info-card"><strong class="tl-info-title">${point.name}</strong><span class="tl-info-meta">${point.start}-${point.end} · ${point.duration}</span><p class="tl-info-addr">${point.address}</p><button type="button" id="${btnId}" class="tl-info-btn">检索这个景点 →</button></div>`,
      });
      infoWindow.open(amapInstance, [point.lng, point.lat]);
      // 高德 InfoWindow 在下一帧插入 DOM,延后绑定 click
      setTimeout(() => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.onclick = (event) => {
          event.stopPropagation();
          router.push({
            path: "/spots",
            query: {
              keyword: point.name,
              city: currentPlan.value?.destination || "",
            },
          });
        };
      }, 0);
    });
    amapInstance.add(marker);
    return marker;
  });

  await renderDrivingRoute(AMap, currentDailyPlan.value.nodes);
  amapInstance.setFitView(amapMarkers, false, [70, 70, 70, 70]);
}

function clearAmapOverlays() {
  amapMarkers.forEach((marker) => marker.setMap(null));
  amapMarkers = [];
  if (amapPolyline) {
    amapPolyline.setMap(null);
    amapPolyline = null;
  }
  if (amapDriving) {
    amapDriving.clear();
  }
}

function renderDrivingRoute(AMap: any, nodes: RoutePoint[]) {
  return new Promise<void>((resolve) => {
    if (nodes.length < 2) {
      resolve();
      return;
    }

    if (!amapDriving) {
      amapDriving = new AMap.Driving({
        map: amapInstance,
        hideMarkers: true,
        showTraffic: false,
        policy: AMap.DrivingPolicy.LEAST_TIME,
      });
    }

    const start = [nodes[0].lng, nodes[0].lat];
    const end = [nodes[nodes.length - 1].lng, nodes[nodes.length - 1].lat];
    const waypoints = nodes.slice(1, -1).map((node) => [node.lng, node.lat]);

    amapDriving.search(
      start,
      end,
      { waypoints },
      (status: string, result: any) => {
        if (status === "complete" && result?.routes?.[0]) {
          updateRouteMetrics(result.routes[0]);
          resolve();
          return;
        }

        amapPolyline = new AMap.Polyline({
          path: nodes.map((node) => [node.lng, node.lat]),
          strokeColor: "#32c5ff",
          strokeWeight: 5,
          strokeOpacity: 0.9,
          strokeStyle: "dashed",
          lineJoin: "round",
          lineCap: "round",
        });
        amapInstance.add(amapPolyline);
        amapStatus.value = "高德路线规划未返回道路路径，已显示景点连接线";
        resolve();
      },
    );
  });
}

function updateRouteMetrics(route: any) {
  if (!currentDailyPlan.value) return;
  if (route.distance) {
    currentDailyPlan.value.distance = `${(route.distance / 1000).toFixed(1)} km`;
  }
  if (route.time) {
    currentDailyPlan.value.transitTime = `${Math.ceil(route.time / 60)} 分钟`;
  }
  if (currentPlan.value) schedulePersist(currentPlan.value);
}

function upsertHistory(plan: TripPlan) {
  const next = [
    plan,
    ...history.value.filter((item) => item.id !== plan.id),
  ].slice(0, 8);
  history.value = next;
}

function toPayload(plan: TripPlan): TripPayload {
  const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = plan;
  return payload;
}

function schedulePersist(plan: TripPlan) {
  if (!plan.id) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    updateTrip(plan.id, toPayload(plan))
      .then((saved) => {
        upsertHistory(saved);
      })
      .catch(() => {
        // 拦截器已弹错误
      });
  }, 800);
}

async function loadHistory() {
  try {
    const data = await listTrips(1, 8);
    history.value = data.items;
    if (!currentPlan.value) {
      currentPlan.value = history.value[0] || null;
    }
  } catch {
    history.value = [];
  }
}

async function migrateLegacyHistory() {
  if (!authStore.isLoggedIn) return;
  const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
  if (!raw) return;

  // 读出后立刻清除：后续上传无论成功与否,下次都不再重复迁移
  localStorage.removeItem(LEGACY_HISTORY_KEY);

  let legacy: TripPlan[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) legacy = parsed.filter(hasMapCoordinates);
  } catch {
    return;
  }

  if (legacy.length === 0) return;

  let migrated = 0;
  for (const plan of legacy) {
    try {
      await createTrip(toPayload(plan));
      migrated++;
    } catch {
      // 静默：迁移是尽力而为,不阻塞页面加载
    }
  }

  if (migrated > 0) {
    ElMessage.success(`已迁移 ${migrated} 条本地行程到云端`);
  }
}

function hasMapCoordinates(plan: TripPlan) {
  return plan.dailyPlans.every((day) =>
    day.nodes.every(
      (node) => Number.isFinite(node.lng) && Number.isFinite(node.lat),
    ),
  );
}

function openHistory(plan: TripPlan) {
  currentPlan.value = plan;
  selectedDay.value = 1;
  activeTab.value = "map";
  nextTick(renderAmapRoute);
}

async function deleteHistoryItem(plan: TripPlan) {
  try {
    await ElMessageBox.confirm(
      `确认删除“${plan.title}”？删除后无法恢复。`,
      "删除行程",
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
    await deleteTrip(plan.id);
  } catch {
    return;
  }

  const next = history.value.filter((item) => item.id !== plan.id);
  history.value = next;

  if (currentPlan.value?.id === plan.id) {
    currentPlan.value = next[0] || null;
    selectedDay.value = 1;
    activeTab.value = "map";
    nextTick(renderAmapRoute);
  }

  ElMessage.success("已删除行程");
}

function exportPlan() {
  if (!currentPlan.value) return;
  const plan = currentPlan.value;
  const lines = [
    plan.title,
    `${plan.startDate} 至 ${plan.endDate} · ${plan.people}人 · 预算 ¥${plan.budget}`,
    "",
    plan.summary,
    "",
    ...plan.dailyPlans.flatMap((day) => [
      `Day ${day.day} ${day.date} ${day.theme}`,
      ...day.nodes.map(
        (node) => `${node.start}-${node.end} ${node.name}｜${node.transport}`,
      ),
      "",
    ]),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${plan.title}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(async () => {
  await migrateLegacyHistory();
  await loadHistory();
  if (!currentPlan.value) await buildPlan();
  nextTick(renderAmapRoute);
});

onBeforeUnmount(() => {
  if (persistTimer) clearTimeout(persistTimer);
  if (amapInstance) {
    amapInstance.destroy();
    amapInstance = null;
  }
});

watch([activeTab, selectedDay, currentPlan], () => {
  renderAmapRoute();
});
</script>

<template>
  <div class="trip-page">
    <section class="trip-hero">
      <div class="hero-actions">
        <el-button :icon="Edit" plain @click="activeTab = 'daily'"
          >编辑行程</el-button
        >
        <el-button :icon="Download" type="primary" @click="exportPlan"
          >导出行程</el-button
        >
      </div>
    </section>

    <section class="planner-shell">
      <aside class="planner-panel">
        <div class="panel-title">
          <el-icon><List /></el-icon>
          <span>规划条件</span>
        </div>

        <el-form label-position="top" class="trip-form">
          <el-form-item label="目的地">
            <el-input
              v-model="form.destination"
              placeholder="例如：西安"
              clearable
            >
              <template #prefix>
                <el-icon><Location /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="出行日期">
            <el-date-picker
              v-model="form.dateRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              class="date-picker"
            />
          </el-form-item>

          <div class="form-grid">
            <el-form-item label="天数">
              <el-input-number
                v-model="form.days"
                :min="1"
                :max="15"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="人数">
              <el-input-number
                v-model="form.people"
                :min="1"
                :max="12"
                controls-position="right"
              />
            </el-form-item>
          </div>

          <el-form-item label="预算">
            <el-input-number
              v-model="form.budget"
              :min="800"
              :step="200"
              controls-position="right"
              class="full-number"
            />
          </el-form-item>

          <el-form-item label="节奏">
            <el-segmented v-model="form.pace" :options="paceOptions" />
          </el-form-item>

          <el-form-item label="偏好">
            <div class="preference-list">
              <el-check-tag
                v-for="item in preferences"
                :key="item"
                :checked="form.preferences.includes(item)"
                @change="
                  (checked: boolean) => {
                    form.preferences = checked
                      ? [...form.preferences, item]
                      : form.preferences.filter(
                          (preference) => preference !== item,
                        );
                  }
                "
              >
                {{ item }}
              </el-check-tag>
            </div>
          </el-form-item>

          <el-button
            type="primary"
            :icon="Plus"
            :loading="generating"
            class="generate-button"
            @click="buildPlan"
          >
            一键规划
          </el-button>
        </el-form>

        <div class="history-block">
          <div class="panel-title">
            <el-icon><Clock /></el-icon>
            <span>历史行程</span>
          </div>
          <div v-if="history.length" class="history-list">
            <div
              v-for="item in history"
              :key="item.id"
              class="history-item"
              :class="{ active: currentPlan?.id === item.id }"
              @click="openHistory(item)"
            >
              <div class="history-item-top">
                <strong>{{ item.title }}</strong>
                <el-button
                  text
                  circle
                  size="small"
                  class="delete-history-btn"
                  :icon="Delete"
                  @click.stop="deleteHistoryItem(item)"
                />
              </div>
              <span
                >{{ formatDateTime(item.createdAt) }} · {{ item.days }}天</span
              >
            </div>
          </div>
          <el-empty v-else description="暂无历史行程" :image-size="64" />
        </div>
      </aside>

      <main v-if="currentPlan" class="result-panel">
        <div class="plan-summary">
          <div>
            <h2>{{ currentPlan.title }}</h2>
            <p>{{ currentPlan.summary }}</p>
          </div>
          <div class="summary-stats">
            <span
              ><el-icon><Calendar /></el-icon>{{ currentPlan.days }} 天</span
            >
            <span
              ><el-icon><Money /></el-icon>¥{{ totalBudget }}</span
            >
            <span
              ><el-icon><Van /></el-icon
              >{{ currentDailyPlan?.transitTime }}</span
            >
          </div>
        </div>

        <el-tabs v-model="activeTab" class="trip-tabs">
          <el-tab-pane label="行程概览" name="overview">
            <div class="overview-grid">
              <div
                v-for="day in currentPlan.dailyPlans"
                :key="day.day"
                class="day-card"
                @click="
                  selectedDay = day.day;
                  activeTab = 'map';
                "
              >
                <span class="day-index">Day {{ day.day }}</span>
                <h3>{{ day.theme }}</h3>
                <p>{{ day.summary }}</p>
                <div class="day-meta">
                  <span>{{ day.distance }}</span>
                  <span>{{ day.transitTime }}</span>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="预算明细" name="budget">
            <div class="budget-list">
              <div
                v-for="item in currentPlan.budgetItems"
                :key="item.label"
                class="budget-row"
              >
                <div>
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.note }}</span>
                </div>
                <b>¥{{ item.amount }}</b>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="景点地图" name="map">
            <div class="map-toolbar">
              <el-radio-group v-model="selectedDay" size="small">
                <el-radio-button
                  v-for="day in currentPlan.dailyPlans"
                  :key="day.day"
                  :value="day.day"
                >
                  第 {{ day.day }} 天
                </el-radio-button>
              </el-radio-group>
              <span class="map-caption">{{ currentDailyPlan?.theme }}</span>
            </div>

            <div class="route-map" aria-label="高德行程地图">
              <div ref="amapContainer" class="amap-container"></div>
              <div v-if="amapStatus" class="map-status">
                <strong>{{
                  amapConfigured ? "地图加载异常" : "需要配置高德地图"
                }}</strong>
                <span>{{ amapStatus }}</span>
              </div>

              <div class="map-note">
                <strong>{{ currentDailyPlan?.nodes[0]?.name }}</strong>
                <span>路线按当天景点顺序连接，可切换日期查看不同日程。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="每日行程" name="daily">
            <div class="daily-layout">
              <el-timeline>
                <el-timeline-item
                  v-for="node in currentDailyPlan?.nodes"
                  :key="node.id"
                  :timestamp="`${node.start} - ${node.end}`"
                  placement="top"
                >
                  <div class="timeline-card">
                    <h3>{{ node.day }}-{{ node.order }} {{ node.name }}</h3>
                    <p>{{ node.address }}</p>
                    <div class="timeline-tags">
                      <el-tag size="small" type="info">{{
                        node.duration
                      }}</el-tag>
                      <el-tag size="small" effect="plain">{{
                        node.transport
                      }}</el-tag>
                    </div>
                    <span>{{ node.note }}</span>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </div>
          </el-tab-pane>

          <el-tab-pane label="天气信息" name="weather">
            <el-alert
              v-if="weatherLoading"
              title="正在同步和风天气..."
              type="info"
              :closable="false"
              show-icon
              class="weather-alert"
            />
            <div class="weather-grid">
              <div
                v-for="item in currentPlan.weather"
                :key="item.date"
                class="weather-card"
              >
                <div class="weather-card__header">
                  <div class="weather-card__icon">
                    <el-icon><Sunny /></el-icon>
                  </div>
                  <div class="weather-card__title-group">
                    <strong>{{ item.date }}</strong>
                    <span class="weather-card__summary">{{ item.text }}</span>
                  </div>
                  <div class="weather-card__temp">{{ item.temp }}</div>
                </div>
                <div class="weather-card__meta">
                  <span v-if="item.wind">{{ item.wind }}</span>
                  <span>湿度 {{ item.humidity }}</span>
                </div>
                <p class="weather-card__tip">{{ item.tip }}</p>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </main>

      <main v-else class="result-panel empty-result">
        <el-empty description="输入条件后生成行程方案" />
      </main>
    </section>
  </div>
</template>

<style scoped>
.trip-page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

/* ── Hero ── */
.trip-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 32px;
  margin-bottom: 22px;
  background: linear-gradient(135deg, #eef2ff 0%, #f0f9ff 60%, #ecfeff 100%);
  border-radius: var(--tl-radius-2xl);
  position: relative;
  overflow: hidden;
}

.trip-hero::after {
  content: "🗺️";
  position: absolute;
  right: 32px;
  bottom: -16px;
  font-size: 180px;
  opacity: 0.08;
  pointer-events: none;
}

.eyebrow {
  display: inline-block;
  margin: 0 0 8px;
  padding: 4px 12px;
  border-radius: var(--tl-radius-pill);
  background: rgba(255, 255, 255, 0.7);
  color: var(--tl-primary);
  font-size: 12px;
  font-weight: 600;
}

.trip-hero h1 {
  margin: 0;
  color: var(--tl-text-1);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.3px;
  position: relative;
}

.hero-copy {
  max-width: 680px;
  margin: 10px 0 0;
  color: var(--tl-text-4);
  font-size: 14px;
  line-height: 1.7;
  position: relative;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  position: relative;
}

/* ── Planner shell ── */
.planner-shell {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.planner-panel,
.result-panel {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-xl);
  box-shadow: var(--tl-shadow-md);
  border: 1px solid var(--tl-border-soft);
}

.planner-panel {
  padding: 22px 20px;
  position: sticky;
  top: 84px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  color: var(--tl-text-1);
  font-weight: 700;
  font-size: 16px;
}

.panel-title::before {
  content: "";
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: var(--tl-gradient-primary);
}

.trip-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.trip-form :deep(.el-form-item__label) {
  font-size: 13px;
  color: var(--tl-text-3);
  font-weight: 500;
}

.trip-form :deep(.el-input__wrapper),
.trip-form :deep(.el-input-number__decrease),
.trip-form :deep(.el-input-number__increase) {
  border-radius: 10px;
}

.date-picker,
.full-number,
.generate-button {
  width: 100%;
}

.generate-button {
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  border-radius: var(--tl-radius-md);
  letter-spacing: 1px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-grid :deep(.el-input-number) {
  width: 100%;
}

.preference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── History ── */
.history-block {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--tl-border-soft);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--tl-border-soft);
  border-radius: var(--tl-radius-md);
  background: var(--tl-bg-card);
  text-align: left;
  cursor: pointer;
  transition: all var(--tl-tx);
}

.history-item strong {
  color: var(--tl-text-1);
  font-size: 14px;
}

.history-item span {
  color: var(--tl-text-5);
  font-size: 12px;
}

.history-item.active,
.history-item:hover {
  border-color: #c7d2fe;
  background: var(--tl-primary-soft);
}

.history-item.active strong,
.history-item:hover strong {
  color: var(--tl-primary);
}

.history-item-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.history-item-top strong {
  flex: 1;
}

.delete-history-btn {
  flex-shrink: 0;
  color: var(--tl-text-5);
}

.delete-history-btn:hover {
  color: var(--tl-danger);
}

/* ── Result panel ── */
.result-panel {
  min-width: 0;
  padding: 22px 28px 28px;
}

.plan-summary {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--tl-border-soft);
}

.plan-summary h2 {
  margin: 0 0 8px;
  color: var(--tl-text-1);
  font-size: 24px;
  font-weight: 800;
}

.plan-summary p {
  margin: 0;
  color: var(--tl-text-4);
  font-size: 14px;
  line-height: 1.6;
}

.summary-stats {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 260px;
}

.summary-stats span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border-radius: var(--tl-radius-pill);
  background: var(--tl-bg-mute);
  color: var(--tl-text-2);
  font-size: 13px;
  font-weight: 500;
}

.summary-stats span .el-icon {
  color: var(--tl-primary);
}

.trip-tabs {
  margin-top: 16px;
}

.trip-tabs :deep(.el-tabs__nav-wrap)::after {
  background: var(--tl-border-soft);
}

.trip-tabs :deep(.el-tabs__item) {
  font-weight: 600;
  color: var(--tl-text-4);
}

.trip-tabs :deep(.el-tabs__item.is-active) {
  color: var(--tl-primary);
}

.trip-tabs :deep(.el-tabs__active-bar) {
  background: var(--tl-gradient-primary);
  height: 3px;
  border-radius: 2px;
}

/* ── Grid blocks ── */
.overview-grid,
.weather-grid,
.knowledge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.day-card,
.weather-card,
.knowledge-item,
.timeline-card {
  background: var(--tl-bg-card);
  border-radius: var(--tl-radius-lg);
  border: 1px solid var(--tl-border-soft);
  transition: all var(--tl-tx);
}

.day-card {
  padding: 16px 18px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.day-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--tl-gradient-primary);
  opacity: 0.6;
}

.day-card:hover {
  border-color: #c7d2fe;
  transform: translateY(-2px);
  box-shadow: var(--tl-shadow-md);
}

.day-card:hover::before {
  opacity: 1;
}

.day-index {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--tl-radius-pill);
  background: var(--tl-primary-soft);
  color: var(--tl-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.day-card h3 {
  margin: 10px 0 6px;
  color: var(--tl-text-1);
  font-size: 16px;
  font-weight: 700;
}

.day-card p {
  min-height: 44px;
  margin: 0;
  color: var(--tl-text-4);
  font-size: 13px;
  line-height: 1.6;
}

.day-meta {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  color: var(--tl-text-5);
  font-size: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--tl-border-soft);
}

/* ── Budget ── */
.budget-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.budget-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--tl-border-soft);
  border-radius: var(--tl-radius-md);
  background: var(--tl-bg-soft);
  transition: all var(--tl-tx);
}

.budget-row:hover {
  background: #fff;
  border-color: #c7d2fe;
}

.budget-row div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.budget-row strong {
  color: var(--tl-text-1);
  font-size: 15px;
}

.budget-row span {
  color: var(--tl-text-5);
  font-size: 13px;
}

.budget-row b {
  color: #f97316;
  font-size: 20px;
  font-weight: 800;
}

/* ── Map ── */
.map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.map-caption {
  color: var(--tl-text-4);
  font-size: 13px;
}

.route-map {
  position: relative;
  overflow: hidden;
  border: 1px solid #1e293b;
  border-radius: var(--tl-radius-lg);
  background: #0b1220;
  aspect-ratio: 16 / 7.5;
  min-height: 420px;
}

.amap-container {
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.map-status {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  background: rgba(11, 18, 32, 0.86);
  color: #fff;
  text-align: center;
}

.map-status strong {
  font-size: 18px;
  color: #fff;
}

.map-status span {
  color: #c5d7e8;
  font-size: 13px;
}

.map-note {
  position: absolute;
  top: 20px;
  right: 22px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-width: 260px;
  padding: 14px 16px;
  background: rgba(11, 18, 32, 0.72);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--tl-radius-md);
  color: #fff;
  text-align: left;
}

.map-note strong {
  font-size: 16px;
  font-weight: 700;
}

.map-note span {
  color: #d7e8f5;
  font-size: 12px;
  line-height: 1.5;
}

.route-map :deep(.amap-route-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--tl-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 0 12px rgba(112, 124, 255, 0.75);
}

.route-map :deep(.amap-route-label) {
  padding: 5px 8px;
  border: 1px solid rgba(124, 131, 255, 0.45);
  border-radius: 6px;
  background: rgba(6, 18, 32, 0.88);
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}

.route-map :deep(.amap-info-content) {
  padding: 14px 16px !important;
  width: auto !important;
  min-width: 240px !important;
  max-width: 320px !important;
  background: #ffffff !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18) !important;
}

.route-map :deep(.tl-info-card) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  line-height: 1.5;
}

.route-map :deep(.tl-info-title) {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.route-map :deep(.tl-info-meta) {
  font-size: 12px;
  color: #64748b;
}

.route-map :deep(.tl-info-addr) {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
  word-break: break-all;
}

.route-map :deep(.tl-info-btn) {
  margin-top: 8px;
  padding: 8px 16px;
  border: 1px solid #6366f1;
  border-radius: 999px;
  background: #eef2ff;
  color: #6366f1;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  align-self: flex-start;
  white-space: nowrap;
}

.route-map :deep(.tl-info-btn:hover) {
  background: #6366f1;
  color: #fff;
}

.daily-layout {
  max-width: 840px;
}

.timeline-card {
  padding: 16px 18px;
}

.timeline-card h3 {
  margin: 0 0 8px;
  color: var(--tl-text-1);
  font-size: 16px;
  font-weight: 700;
}

.timeline-card p,
.timeline-card span {
  margin: 0;
  color: var(--tl-text-3);
  font-size: 13px;
  line-height: 1.6;
}

.timeline-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}

.timeline-tags :deep(.el-tag) {
  border-radius: 6px;
  background: var(--tl-primary-soft);
  border-color: #c7d2fe;
  color: var(--tl-primary);
}

.knowledge-item {
  display: flex;
  gap: 12px;
  padding: 16px 18px;
}

.knowledge-item .el-icon {
  margin-top: 2px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--tl-primary-soft);
  color: var(--tl-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.knowledge-item strong {
  color: var(--tl-text-1);
  font-size: 15px;
}

.knowledge-item p {
  margin: 6px 0 0;
  color: var(--tl-text-4);
  font-size: 13px;
  line-height: 1.7;
}

.weather-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.9),
      rgba(248, 250, 252, 0.98)
    ),
    radial-gradient(
      circle at top right,
      rgba(99, 102, 241, 0.1),
      transparent 38%
    );
}

.weather-card:hover {
  border-color: #c7d2fe;
  transform: translateY(-2px);
  box-shadow: var(--tl-shadow-md);
}

.weather-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: var(--tl-gradient-primary);
  opacity: 0.8;
}

.weather-alert {
  margin-bottom: 12px;
  border-radius: var(--tl-radius-md);
}

.weather-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.weather-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    rgba(250, 204, 21, 0.18),
    rgba(251, 191, 36, 0.05)
  );
  color: var(--tl-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.weather-card__icon .el-icon {
  font-size: 22px;
}

.weather-card__title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weather-card strong {
  color: var(--tl-text-1);
  font-size: 16px;
  font-weight: 700;
}

.weather-card__summary {
  color: var(--tl-text-4);
  font-size: 13px;
  line-height: 1.5;
}

.weather-card__temp {
  padding: 4px 10px;
  border-radius: var(--tl-radius-pill);
  background: var(--tl-primary-soft);
  color: var(--tl-primary);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.weather-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.weather-card__meta span {
  padding: 4px 10px;
  border-radius: var(--tl-radius-pill);
  background: rgba(148, 163, 184, 0.14);
  color: var(--tl-text-4);
  font-size: 12px;
}

.weather-card__tip,
.weather-card p {
  margin: 0;
  color: var(--tl-text-4);
  font-size: 13px;
  line-height: 1.6;
}

.weather-card__tip {
  padding-top: 2px;
}

/* ── Empty ── */
.empty-result {
  min-height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
}

/* ── Responsive ── */
@media (max-width: 1080px) {
  .planner-shell {
    grid-template-columns: 1fr;
  }

  .planner-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .trip-page {
    padding: 18px 12px 28px;
  }

  .trip-hero {
    flex-direction: column;
    align-items: stretch;
    padding: 22px;
  }

  .trip-hero h1 {
    font-size: 22px;
  }

  .plan-summary,
  .map-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-actions .el-button {
    flex: 1;
  }

  .summary-stats {
    justify-content: flex-start;
    min-width: 0;
  }

  .route-map {
    min-height: 360px;
    aspect-ratio: auto;
  }

  .amap-container {
    min-height: 360px;
  }

  .map-note {
    position: static;
    padding: 12px;
    max-width: none;
    background: rgba(11, 18, 32, 0.92);
  }

  .result-panel {
    padding: 18px 18px 22px;
  }
}
</style>
