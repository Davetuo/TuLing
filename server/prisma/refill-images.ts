/**
 * 景点图片补全脚本
 * 数据来源：高德地图 Web 服务 API（/v3/place/text）
 *
 * 用法:
 *   npm run seed:refill-images
 *
 * 目标:
 *   - 找出所有「图片字段为空 / 全是失效占位 URL」的景点
 *   - 按 name + city 精确检索高德 POI，取 photos[] 替换 images
 *   - 仅更新 images 字段，**不动**介绍/交通/票价等人工字段
 *
 * 名字适配:
 *   - 「长城（八达岭）」→ 先搜原名，再用「长城」/「八达岭长城」作 fallback
 *   - 「成都大熊猫繁育研究基地」→ 高德里通常用「大熊猫基地」别称
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
  console.error("[错误] 未在 server/.env 中找到 AMAP_WEB_KEY");
  process.exit(1);
}

const prisma = new PrismaClient();
const RATE_LIMIT_MS = 700;
const MAX_PHOTOS = 5;

// ─── 类型 ────────────────────────────────────────────────────
interface AmapPoi {
  id?: string;
  name?: string;
  type?: string;
  address?: unknown;
  photos?: Array<{ url?: string; title?: unknown }>;
}

interface AmapResp {
  status?: string;
  info?: string;
  infocode?: string;
  pois?: AmapPoi[];
}

function toText(v: unknown): string | undefined {
  if (v == null || Array.isArray(v)) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

// ─── 名称变体生成（适配高德搜索） ────────────────────────────
function nameVariants(name: string): string[] {
  const variants: string[] = [name];

  // 去括号 + 括号内容
  const stripped = name.replace(/[（(][^）)]*[）)]/g, "").trim();
  if (stripped && stripped !== name) variants.push(stripped);

  // 提取括号内容（如「长城（八达岭）」→「八达岭长城」）
  const inside = name.match(/[（(]([^）)]+)[）)]/);
  if (inside && stripped) {
    variants.push(`${inside[1].trim()}${stripped}`);
  }

  // 手工别名：极少数景点高德里名字不同
  const aliases: Record<string, string[]> = {
    成都大熊猫繁育研究基地: ["成都大熊猫繁育研究基地", "大熊猫基地"],
    长隆野生动物世界: ["长隆野生动物世界", "广州长隆野生动物世界"],
    西双版纳热带植物园: ["中国科学院西双版纳热带植物园", "西双版纳热带植物园"],
    鸟巢: ["国家体育场", "鸟巢"],
  };
  for (const [key, values] of Object.entries(aliases)) {
    if (name.includes(key)) variants.push(...values);
  }

  return Array.from(new Set(variants));
}

// ─── 高德检索 ────────────────────────────────────────────────
async function searchPoi(keyword: string, city: string): Promise<AmapPoi[]> {
  const url = new URL("https://restapi.amap.com/v3/place/text");
  url.searchParams.set("key", AMAP_KEY!);
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("city", city);
  url.searchParams.set("citylimit", "true");
  url.searchParams.set("extensions", "all");
  url.searchParams.set("offset", "10");
  url.searchParams.set("page", "1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as AmapResp;
    if (data.status !== "1") {
      console.warn(`    高德返回错误: ${data.info} (${data.infocode})`);
      return [];
    }
    return data.pois || [];
  } catch (err) {
    console.warn(`    请求失败: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function pickImages(poi: AmapPoi): string[] {
  return (poi.photos || [])
    .map((p) => p.url)
    .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    .slice(0, MAX_PHOTOS);
}

// 在结果列表中找最佳匹配（优先：name 完全相等 + 有图；其次：name 包含目标名 + 有图；最后：第一个有图）
function findBest(
  pois: AmapPoi[],
  expected: string,
): { poi: AmapPoi; images: string[] } | null {
  const candidates = pois
    .map((p) => ({ poi: p, images: pickImages(p) }))
    .filter((c) => c.images.length > 0);

  if (!candidates.length) return null;

  const exact = candidates.find((c) => toText(c.poi.name) === expected);
  if (exact) return exact;

  const contains = candidates.find((c) => {
    const n = toText(c.poi.name) || "";
    return n.includes(expected) || expected.includes(n);
  });
  if (contains) return contains;

  return candidates[0];
}

// ─── 主流程 ───────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("景点图片补全（高德 Web 服务 API）");
  console.log("=".repeat(60));

  const all = await prisma.scenicSpot.findMany({
    select: { id: true, name: true, city: true, images: true, source: true },
  });

  const targets = all.filter((spot) => {
    if (!spot.images || spot.images.length === 0) return true;
    return spot.images.every(
      (u) => !u.startsWith("http") || u.includes("unsplash"),
    );
  });

  console.log(`数据库共 ${all.length} 条景点，需要补图 ${targets.length} 条\n`);

  const stats = { ok: 0, fail: 0 };
  const failed: Array<{ name: string; city: string; reason: string }> = [];

  for (const [i, spot] of targets.entries()) {
    const variants = nameVariants(spot.name);
    let matched: { poi: AmapPoi; images: string[] } | null = null;
    let usedVariant = "";

    for (const v of variants) {
      const pois = await searchPoi(v, spot.city);
      if (pois.length === 0) {
        await sleep(RATE_LIMIT_MS);
        continue;
      }
      const best = findBest(pois, spot.name);
      if (best) {
        matched = best;
        usedVariant = v;
        break;
      }
      await sleep(RATE_LIMIT_MS);
    }

    const idx = `[${i + 1}/${targets.length}]`;
    if (matched) {
      await prisma.scenicSpot.update({
        where: { id: spot.id },
        data: { images: matched.images },
      });
      stats.ok++;
      console.log(
        `${idx} ✓ ${spot.name} (${spot.city}) → ${matched.images.length} 张图${usedVariant !== spot.name ? `  [变体: ${usedVariant}]` : ""}`,
      );
    } else {
      stats.fail++;
      failed.push({ name: spot.name, city: spot.city, reason: "高德无匹配或无图" });
      console.log(`${idx} ✗ ${spot.name} (${spot.city}) - 未找到含图 POI`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`补图完成：成功 ${stats.ok} / 失败 ${stats.fail}`);
  console.log("=".repeat(60));
  if (failed.length) {
    console.log("\n失败列表（建议人工补 Wikimedia 图片）:");
    for (const f of failed) {
      console.log(`  - ${f.name} (${f.city})`);
    }
  }
}

main()
  .catch((err) => {
    console.error("\n[失败]", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
