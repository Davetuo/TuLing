/**
 * 武汉酒店 seed 脚本
 * 数据来源：高德地图 Web 服务 API（/v3/place/text，住宿服务类 100000）
 *
 * 用法:
 *   1. 在 server/.env 中填写 AMAP_WEB_KEY
 *   2. 执行 npm run seed:hotels:wuhan
 *
 * 行为:
 *   - 按多关键词拉取武汉酒店 POI（星级/经济型/公寓）
 *   - 星级从 type 文本解析（含五星/四星/三星等关键词）
 *   - 价位带按星级硬编码（参考价，非实时房价）
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

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
  { keyword: "酒店", types: "100100", baseTags: ["星级"] },
  { keyword: "经济型酒店", types: "100200", baseTags: ["经济型"] },
  { keyword: "公寓酒店", types: "100300", baseTags: ["公寓"] },
  { keyword: "民宿", baseTags: ["民宿"] },
  { keyword: "商务酒店", baseTags: ["商务"] },
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
  const tags = new Set(["住宿", ...baseTags]);
  const typeStr = toText(poi.type) || "";
  const name = toText(poi.name) || "";
  const text = typeStr + name;
  if (text.includes("五星")) tags.add("五星级");
  if (text.includes("四星")) tags.add("四星级");
  if (text.includes("三星")) tags.add("三星级");
  if (text.includes("经济")) tags.add("经济型");
  if (text.includes("快捷")) tags.add("快捷");
  if (text.includes("商务")) tags.add("商务");
  if (text.includes("公寓")) tags.add("公寓");
  if (text.includes("民宿") || text.includes("客栈")) tags.add("民宿");
  return Array.from(tags);
}

function pickStarLevel(poi: AmapPoi): number | null {
  const text = (toText(poi.type) || "") + (toText(poi.name) || "");
  if (text.includes("五星")) return 5;
  if (text.includes("四星")) return 4;
  if (text.includes("三星")) return 3;
  if (text.includes("二星")) return 2;
  if (text.includes("一星")) return 1;
  if (text.includes("经济") || text.includes("快捷")) return 2;
  if (text.includes("商务") || text.includes("精品")) return 4;
  return null;
}

function pickPriceBand(starLevel: number | null): {
  priceMin: number | null;
  priceMax: number | null;
} {
  switch (starLevel) {
    case 5:
      return { priceMin: 1200, priceMax: 2500 };
    case 4:
      return { priceMin: 600, priceMax: 1100 };
    case 3:
      return { priceMin: 350, priceMax: 600 };
    case 2:
      return { priceMin: 200, priceMax: 350 };
    case 1:
      return { priceMin: 120, priceMax: 200 };
    default:
      return { priceMin: null, priceMax: null };
  }
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
  // 排除混入的非住宿 POI
  const nameBlacklist = [
    "景区",
    "公园",
    "博物馆",
    "餐厅",
    "饭店",
    "茶馆",
    "停车场",
    "加油站",
    "超市",
    "便利店",
    "学校",
    "支行",
    "银行",
    "写字楼",
    "办公楼",
  ];
  if (nameBlacklist.some((b) => name.includes(b))) return `名称过滤: ${name}`;
  return null;
}

async function main() {
  console.log("=".repeat(60));
  console.log("武汉酒店 seed（数据来源：高德地图 Web 服务 API）");
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
    const starLevel = pickStarLevel(poi);
    const { priceMin, priceMax } = pickPriceBand(starLevel);

    const data = {
      name,
      city: CITY,
      address: fullAddress,
      tags: pickTags(poi, baseTags),
      score: pickScore(poi),
      starLevel,
      priceMin,
      priceMax,
      openTime: toText(poi.biz_ext?.open_time) || null,
      images: pickImages(poi),
      introduction: null,
      phone: toText(poi.tel) || null,
      lng,
      lat,
      source: "amap",
    };

    const existing = await prisma.hotel.findFirst({
      where: { name, city: CITY },
      select: { id: true },
    });

    if (existing) {
      await prisma.hotel.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      await prisma.hotel.create({ data });
      stats.inserted++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("入库完成");
  console.log("=".repeat(60));
  console.log(`新增酒店: ${stats.inserted}`);
  console.log(`更新酒店: ${stats.updated}`);
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
