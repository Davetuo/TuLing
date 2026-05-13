/**
 * 武汉景点 seed 脚本
 * 数据来源：高德地图 Web 服务 API（/v3/place/text）
 *
 * 用法:
 *   1. 在 server/.env 中填写 AMAP_WEB_KEY（注意：「Web 服务」类型 Key，与前端 VITE_AMAP_KEY 不同）
 *   2. 执行 npm run seed:wuhan
 *
 * 行为:
 *   - 按多关键词 × 多分页拉取武汉 POI（覆盖景区/博物馆/公园/寺庙/步行街/高校）
 *   - 以 amap.id 做内存去重
 *   - 以 (name + city='武汉') 做数据库去重 upsert
 *   - 图片直接取高德 POI photos 字段（CDN 直连，可前端展示）
 *   - 评分取 biz_ext.rating，无则留空
 *   - 不覆盖介绍/交通字段（高德不提供），留待后续人工补全或 LLM 生成
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// ─── 加载 .env ───────────────────────────────────────────────
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
  console.error(
    "[错误] 未在 server/.env 中找到 AMAP_WEB_KEY\n" +
      '       请先在「高德开放平台」申请「Web 服务」类型 Key，并填写到 .env\n' +
      "       注意：前端用的 VITE_AMAP_KEY（Web 端 JS API）与本脚本所需 Key 类型不同",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── 配置 ────────────────────────────────────────────────────
const CITY = "武汉";

interface SearchTask {
  keyword: string;
  types?: string;
  baseTags: string[];
}

const SEARCH_TASKS: SearchTask[] = [
  // 风景名胜：黄鹤楼/东湖/木兰山等
  { keyword: "景区", types: "110000", baseTags: ["景点"] },
  // 博物馆/纪念馆：湖北省博/辛亥革命博/武汉博
  { keyword: "博物馆", types: "110200", baseTags: ["文化", "亲子"] },
  // 公园广场：解放公园/月湖公园
  { keyword: "公园", types: "110100", baseTags: ["免费", "自然"] },
  // 宗教场所：归元寺/古德寺/长春观
  { keyword: "寺庙", types: "110203", baseTags: ["文化"] },
  { keyword: "古迹", types: "110105", baseTags: ["文化"] },
  // 步行街/商业街：江汉路/户部巷/昙华林
  { keyword: "步行街", baseTags: ["美食", "夜景"] },
  // 著名高校：武大樱花季
  { keyword: "大学", types: "141200", baseTags: ["文化", "免费"] },
];

const MAX_PAGES_PER_TASK = 3; // 每个关键词最多翻 3 页（25*3=75 条/词）
const PAGE_SIZE = 25; // 高德每页上限
const RATE_LIMIT_MS = 800; // 请求间隔，避免限流

// ─── 高德 POI 类型 ────────────────────────────────────────────
interface AmapPoi {
  id?: string;
  name?: string;
  type?: string;
  typecode?: string;
  address?: string | unknown[];
  location?: string;
  tel?: string | unknown[];
  pname?: string;
  cityname?: string;
  adname?: string;
  business_area?: string;
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

// ─── 高德接口字段清洗 ──────────────────────────────────────────
// 高德很多字段在「为空」时会返回 []（空数组）而不是空串/null，需统一为 undefined
function toText(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

// ─── 抓取 ────────────────────────────────────────────────────
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

// ─── 字段映射 ─────────────────────────────────────────────────
function pickTags(poi: AmapPoi, baseTags: string[]): string[] {
  const tags = new Set(baseTags);
  const typeStr = toText(poi.type) || "";

  if (typeStr.includes("博物馆") || typeStr.includes("纪念馆")) {
    tags.add("文化");
    tags.add("亲子");
  }
  if (typeStr.includes("风景")) tags.add("自然");
  if (typeStr.includes("公园")) {
    tags.add("免费");
    tags.add("自然");
  }
  if (
    typeStr.includes("宗教") ||
    typeStr.includes("寺") ||
    typeStr.includes("庙") ||
    typeStr.includes("观")
  ) {
    tags.add("文化");
  }
  if (typeStr.includes("夜市") || typeStr.includes("步行街")) {
    tags.add("美食");
    tags.add("夜景");
  }
  if (typeStr.includes("高校") || typeStr.includes("大学")) {
    tags.add("文化");
    tags.add("免费");
  }

  return Array.from(tags);
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

function pickTicketInfo(poi: AmapPoi): string | null {
  const cost = toText(poi.biz_ext?.cost);
  if (!cost) return null;
  if (cost === "0" || cost === "免费") return "免费";
  // 高德 cost 通常是人均消费数字，作为参考门票
  return `参考门票 ¥${cost}`;
}

// ─── POI 过滤：高德 POI 鱼龙混杂，需排除明显非景点 ──────────────
function shouldSkip(poi: AmapPoi): string | null {
  const name = toText(poi.name);
  if (!name) return "缺少名称";

  const address = toText(poi.address);
  if (!address) return "缺少地址";

  const location = toText(poi.location);
  if (!location || !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)) {
    return "缺少坐标";
  }

  // 排除明显的商业 POI（餐厅、酒店、停车场等碰巧出现在结果里的）
  const type = toText(poi.type) || "";
  const blacklist = ["餐饮", "酒店", "宾馆", "停车场", "公厕", "加油站", "便利店"];
  if (blacklist.some((b) => type.includes(b))) return `类型过滤: ${type}`;

  // 名称黑名单（明显不是景点的）
  const nameBlacklist = ["售票处", "停车场", "服务区", "门店", "分店"];
  if (nameBlacklist.some((b) => name.includes(b))) return `名称过滤: ${name}`;

  return null;
}

// ─── 主流程 ───────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("武汉景点 seed（数据来源：高德地图 Web 服务 API）");
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
    const fullAddress = adname && !address.startsWith(adname) ? `${adname}${address}` : address;

    const data = {
      name,
      city: CITY,
      address: fullAddress,
      tags: pickTags(poi, baseTags),
      score: pickScore(poi),
      openTime: toText(poi.biz_ext?.open_time) || null,
      images: pickImages(poi),
      introduction: null,
      transport: null,
      ticketInfo: pickTicketInfo(poi),
      phone: toText(poi.tel) || null,
      suggestedDuration: null,
      source: "amap",
    };

    const existing = await prisma.scenicSpot.findFirst({
      where: { name, city: CITY },
      select: { id: true },
    });

    if (existing) {
      await prisma.scenicSpot.update({ where: { id: existing.id }, data });
      stats.updated++;
    } else {
      await prisma.scenicSpot.create({ data });
      stats.inserted++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("入库完成");
  console.log("=".repeat(60));
  console.log(`新增景点: ${stats.inserted}`);
  console.log(`更新景点: ${stats.updated}`);
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
