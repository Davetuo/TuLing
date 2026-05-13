/**
 * 武汉餐厅 seed 脚本
 * 数据来源：高德地图 Web 服务 API（/v3/place/text，餐饮服务类 050000）
 *
 * 用法:
 *   1. 在 server/.env 中填写 AMAP_WEB_KEY
 *   2. 执行 npm run seed:restaurants:wuhan
 *
 * 行为:
 *   - 按多关键词 × 多分页拉取武汉餐饮 POI（中餐厅/小吃/快餐/咖啡/特色）
 *   - 以 amap.id 做内存去重
 *   - 以 (name + city='武汉') 做数据库 upsert
 *   - 人均消费(avgCost)取 biz_ext.cost，无则留空
 *   - 菜系(cuisine)从 type 文本提取
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// ─── 加载 .env ───
function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const AMAP_KEY = process.env.AMAP_WEB_KEY;
if (!AMAP_KEY) {
  console.error("[错误] 未在 server/.env 中找到 AMAP_WEB_KEY");
  process.exit(1);
}

const prisma = new PrismaClient();

const CITY = "武汉";

interface SearchTask {
  keyword: string;
  types?: string;
  baseTags: string[];
}

const SEARCH_TASKS: SearchTask[] = [
  { keyword: "中餐厅", types: "050100", baseTags: ["正餐"] },
  { keyword: "湖北菜", baseTags: ["正餐", "本地"] },
  { keyword: "小吃", types: "050300", baseTags: ["小吃"] },
  { keyword: "热干面", baseTags: ["小吃", "本地"] },
  { keyword: "豆皮", baseTags: ["小吃", "本地"] },
  { keyword: "快餐", types: "050300", baseTags: ["快餐"] },
  { keyword: "咖啡", types: "050500", baseTags: ["咖啡", "休闲"] },
  { keyword: "火锅", baseTags: ["正餐"] },
];

const MAX_PAGES_PER_TASK = 3;
const PAGE_SIZE = 25;
const RATE_LIMIT_MS = 800;

interface AmapPoi {
  id?: string;
  name?: string;
  type?: string;
  address?: string | unknown[];
  location?: string;
  tel?: string | unknown[];
  pname?: string;
  cityname?: string;
  adname?: string;
  biz_ext?: {
    rating?: string | unknown[];
    cost?: string | unknown[];
    open_time?: string | unknown[];
  };
  photos?: Array<{ title?: string | unknown[]; url?: string }>;
}

interface AmapResponse {
  status?: string;
  info?: string;
  infocode?: string;
  count?: string;
  pois?: AmapPoi[];
}

function toText(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

async function fetchPois(
  keyword: string,
  types: string | undefined,
  page: number,
): Promise<AmapPoi[]> {
  const url = new URL("https://restapi.amap.com/v3/place/text");
  url.searchParams.set("key", AMAP_KEY!);
  url.searchParams.set("keywords", keyword);
  if (types) url.searchParams.set("types", types);
  url.searchParams.set("city", CITY);
  url.searchParams.set("citylimit", "true");
  url.searchParams.set("extensions", "all");
  url.searchParams.set("offset", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} (${keyword}, page=${page})`);
      return [];
    }
    const data = (await res.json()) as AmapResponse;
    if (data.status !== "1") {
      console.warn(
        `  高德返回错误: status=${data.status}, info=${data.info}, infocode=${data.infocode}`,
      );
      return [];
    }
    return data.pois || [];
  } catch (err) {
    console.warn(
      `  请求失败 (${keyword}, page=${page}): ${err instanceof Error ? err.message : err}`,
    );
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function pickTags(poi: AmapPoi, baseTags: string[]): string[] {
  const tags = new Set(["餐饮", ...baseTags]);
  const typeStr = toText(poi.type) || "";
  if (typeStr.includes("快餐")) tags.add("快餐");
  if (typeStr.includes("中餐")) tags.add("正餐");
  if (typeStr.includes("小吃")) tags.add("小吃");
  if (typeStr.includes("咖啡")) tags.add("咖啡");
  if (typeStr.includes("茶艺") || typeStr.includes("茶馆")) tags.add("茶饮");
  if (typeStr.includes("酒吧")) tags.add("酒吧");
  if (typeStr.includes("糕饼") || typeStr.includes("甜品")) tags.add("甜品");
  if (typeStr.includes("火锅")) tags.add("火锅");
  if (typeStr.includes("烧烤")) tags.add("烧烤");
  return Array.from(tags);
}

function pickCuisine(poi: AmapPoi): string[] {
  const type = toText(poi.type) || "";
  const cuisines = new Set<string>();
  const known = [
    "粤菜",
    "川菜",
    "湘菜",
    "鲁菜",
    "苏菜",
    "浙菜",
    "闽菜",
    "徽菜",
    "湖北菜",
    "东北菜",
    "西北菜",
    "北京菜",
    "上海菜",
    "云南菜",
    "贵州菜",
    "新疆菜",
    "日韩料理",
    "日本料理",
    "韩国料理",
    "东南亚",
    "意大利",
    "法式",
    "西餐",
    "海鲜",
    "火锅",
    "烧烤",
    "小吃",
    "快餐",
  ];
  for (const c of known) {
    if (type.includes(c)) cuisines.add(c);
  }
  return Array.from(cuisines);
}

function pickImages(poi: AmapPoi): string[] {
  return (poi.photos || [])
    .map((p) => p.url)
    .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    .slice(0, 5);
}

function pickScore(poi: AmapPoi): number | null {
  const raw = toText(poi.biz_ext?.rating);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(0, Number(n.toFixed(1))));
}

function pickAvgCost(poi: AmapPoi): number | null {
  const raw = toText(poi.biz_ext?.cost);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function pickLocation(poi: AmapPoi): {
  lng: number | null;
  lat: number | null;
} {
  const loc = toText(poi.location);
  if (!loc) return { lng: null, lat: null };
  const [lngStr, latStr] = loc.split(",");
  const lng = Number(lngStr);
  const lat = Number(latStr);
  if (!Number.isFinite(lng) || !Number.isFinite(lat))
    return { lng: null, lat: null };
  return { lng, lat };
}

function shouldSkip(poi: AmapPoi): string | null {
  const name = toText(poi.name);
  if (!name) return "缺少名称";
  const address = toText(poi.address);
  if (!address) return "缺少地址";
  const location = toText(poi.location);
  if (!location || !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)) {
    return "缺少坐标";
  }
  // 排除混入的非餐饮 POI
  const nameBlacklist = [
    "景区",
    "公园",
    "博物馆",
    "酒店",
    "宾馆",
    "民宿",
    "停车场",
    "加油站",
    "超市",
    "购物中心",
    "便利店",
    "学校",
    "幼儿园",
    "支行",
    "银行",
  ];
  if (nameBlacklist.some((b) => name.includes(b))) return `名称过滤: ${name}`;
  return null;
}

async function main() {
  console.log("=".repeat(60));
  console.log("武汉餐厅 seed（数据来源：高德地图 Web 服务 API）");
  console.log("=".repeat(60));

  const pool = new Map<string, { poi: AmapPoi; baseTags: string[] }>();

  for (const task of SEARCH_TASKS) {
    console.log(
      `\n[搜索] keyword="${task.keyword}"${task.types ? ` types=${task.types}` : ""}`,
    );
    for (let page = 1; page <= MAX_PAGES_PER_TASK; page++) {
      const pois = await fetchPois(task.keyword, task.types, page);
      if (!pois.length) break;
      let added = 0;
      for (const poi of pois) {
        const id = toText(poi.id);
        if (!id) continue;
        if (!pool.has(id)) {
          pool.set(id, { poi, baseTags: task.baseTags });
          added++;
        }
      }
      console.log(
        `  page=${page} 返回 ${pois.length} 条 / 新增 ${added} / 累计去重 ${pool.size}`,
      );
      if (pois.length < PAGE_SIZE) break;
      await sleep(RATE_LIMIT_MS);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n抓取完毕，去重后共 ${pool.size} 个 POI，开始入库...`);

  const stats = { inserted: 0, updated: 0, skipped: 0 };
  const skippedReasons = new Map<string, number>();

  for (const { poi, baseTags } of pool.values()) {
    const reason = shouldSkip(poi);
    if (reason) {
      stats.skipped++;
      skippedReasons.set(reason, (skippedReasons.get(reason) || 0) + 1);
      continue;
    }

    const name = toText(poi.name)!;
    const address = toText(poi.address)!;
    const adname = toText(poi.adname) || "";
    const fullAddress =
      adname && !address.startsWith(adname) ? `${adname}${address}` : address;
    const { lng, lat } = pickLocation(poi);

    const data = {
      name,
      city: CITY,
      address: fullAddress,
      tags: pickTags(poi, baseTags),
      cuisine: pickCuisine(poi),
      score: pickScore(poi),
      avgCost: pickAvgCost(poi),
      openTime: toText(poi.biz_ext?.open_time) || null,
      images: pickImages(poi),
      introduction: null,
      phone: toText(poi.tel) || null,
      lng,
      lat,
      source: "amap",
    };

    const existing = await prisma.restaurant.findFirst({
      where: { name, city: CITY },
      select: { id: true },
    });

    if (existing) {
      await prisma.restaurant.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      await prisma.restaurant.create({ data });
      stats.inserted++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("入库完成");
  console.log("=".repeat(60));
  console.log(`新增餐厅: ${stats.inserted}`);
  console.log(`更新餐厅: ${stats.updated}`);
  console.log(`跳过 POI: ${stats.skipped}`);
  if (skippedReasons.size) {
    console.log("跳过原因分布:");
    for (const [reason, count] of skippedReasons) {
      console.log(`  - ${reason}: ${count}`);
    }
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("\n[失败]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
