/**
 * 景点评价 seed 脚本：批量插入 50 条真实风格的评价数据
 *
 * 用法：
 *   cd server && npx ts-node prisma/seed-reviews.ts
 *
 * 行为：
 *   - 读取当前数据库中已有的景点；不足时报错退出
 *   - 若现有用户数 < 5，自动创建若干 demo 用户（默认密码 demo1234）
 *   - 在景点 × 用户矩阵中均匀分布 50 条评价
 *   - 同一个 (user, spot) 不会重复评价
 *   - 评分分布：5★ ≈ 60%，4★ ≈ 28%，3★ ≈ 12%
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as bcrypt from "bcrypt";

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

const prisma = new PrismaClient();

const TARGET_REVIEW_COUNT = 50;

// 5★ 评价：热情、推荐
const REVIEWS_5: string[] = [
  "整体体验超出预期，环境优美交通便利，绝对值得专门跑一趟。",
  "拍照出片率极高，每个角度都很有故事感，朋友圈晒了一整天。",
  "讲解员特别专业，把背后的历史讲得生动有趣，孩子也听得入迷。",
  "傍晚去最合适，光线柔和、人也不算多，整个氛围非常治愈。",
  "景区维护得很到位，干净整洁、指引清晰，老人小孩都能放心逛。",
  "性价比超高，门票不贵但内容丰富，玩了一整天都没逛完。",
  "本地朋友强推的宝藏地点，比攻略里的网红打卡点更值得去。",
  "节目编排和景观结合得太巧妙了，看完直接被惊艳。",
  "周末带家人来非常合适，配套餐饮完善、节奏也很轻松。",
  "工作人员态度都特别好，有问题随时帮忙解决，超加分。",
  "建筑群的细节经得起细看，每一处雕花都能讲出故事。",
  "夜景灯光秀比白天还震撼，强烈建议晚上再来一次。",
  "拍到了今年最满意的一组照片，色彩饱和度直接拉满。",
  "园区动线设计很科学，不走回头路，体验顺滑。",
  "意外的好玩，本来只打算待两小时结果耗了半天。",
];

// 4★ 评价：肯定为主、有小瑕疵
const REVIEWS_4: string[] = [
  "整体不错，就是周末人略多，建议工作日来体验更好。",
  "景色没得说，但餐饮区域选择有点少，可以自带零食过去。",
  "比想象中好玩，唯一吐槽就是停车有点紧张，建议公共交通。",
  "讲解牌如果再多一些中英文对照就更友好了，对外宾不太方便。",
  "票价稍微贵了一点点，不过逛完觉得也算值得。",
  "环境是真不错，就是热门打卡点要排队拍照，等了好一会儿。",
  "适合慢慢逛，但夏天去要做好防晒，遮阴的地方不算多。",
  "整体满意，就是出口附近的纪念品价格偏高，体验上稍打折扣。",
  "孩子玩得很开心，互动项目可以再丰富一些就完美了。",
  "氛围感很到位，唯一遗憾是开放时间偏短，没逛尽兴。",
  "导览图设计可以更直观一点，第一次去容易迷路。",
  "出片很容易，但卫生间分布略不均匀，找一次得走老远。",
];

// 3★ 评价：中性、客观提示
const REVIEWS_3: string[] = [
  "体验一般，主要是节假日去人太多了，拍照都得抢机位。",
  "景区本身不错，但周边商业化有点过头，少了些原本的味道。",
  "适合走马观花，深度玩半天会觉得内容略显单薄。",
  "门票和实际体验稍微有点落差，期待值别拉太满会更好。",
  "交通比想象中麻烦，自驾的话停车找位置花了不少时间。",
  "讲解音响有点小，靠后的游客基本听不清，建议租讲解器。",
];

interface ReviewTemplate {
  score: number;
  pool: string[];
}

const TEMPLATES: ReviewTemplate[] = [
  ...Array.from({ length: 30 }, () => ({ score: 5, pool: REVIEWS_5 })),
  ...Array.from({ length: 14 }, () => ({ score: 4, pool: REVIEWS_4 })),
  ...Array.from({ length: 6 }, () => ({ score: 3, pool: REVIEWS_3 })),
];

const DEMO_USERS = [
  { email: "demo.amy@tuling.app", nickname: "旅行的Amy" },
  { email: "demo.luke@tuling.app", nickname: "背包客Luke" },
  { email: "demo.linlin@tuling.app", nickname: "林林爱拍照" },
  { email: "demo.kai@tuling.app", nickname: "凯子在路上" },
  { email: "demo.cici@tuling.app", nickname: "西西Travel" },
  { email: "demo.yibo@tuling.app", nickname: "一波看世界" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function ensureUsers(): Promise<string[]> {
  const existing = await prisma.user.findMany({
    select: { id: true },
    take: 50,
  });
  if (existing.length >= 5) {
    console.log(`[users] 已有 ${existing.length} 个用户，复用现有账号`);
    return existing.map((u) => u.id);
  }

  console.log(
    `[users] 现有 ${existing.length} 个用户，将补建 demo 账号至少 5 个`,
  );
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const created: string[] = [];
  for (const profile of DEMO_USERS) {
    const exists = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });
    if (exists) {
      created.push(exists.id);
      continue;
    }
    const user = await prisma.user.create({
      data: {
        email: profile.email,
        passwordHash,
        nickname: profile.nickname,
      },
      select: { id: true },
    });
    created.push(user.id);
    console.log(`  + 创建用户: ${profile.nickname} <${profile.email}>`);
  }

  return Array.from(new Set([...existing.map((u) => u.id), ...created]));
}

async function loadSpots(): Promise<{ id: string; name: string }[]> {
  const spots = await prisma.scenicSpot.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (spots.length === 0) {
    throw new Error(
      "数据库中没有景点数据，请先执行 npm run seed:spots 或 npm run seed:wuhan",
    );
  }
  console.log(`[spots] 候选景点 ${spots.length} 个`);
  return spots;
}

function randomDateWithinDays(daysBack: number): Date {
  const now = Date.now();
  const offset = Math.floor(Math.random() * daysBack * 86400_000);
  // 同一时刻可能产生重复 createdAt，叠加毫秒级抖动避免排序抖动
  return new Date(now - offset - Math.floor(Math.random() * 1000));
}

async function seedReviews() {
  const userIds = await ensureUsers();
  const spots = await loadSpots();

  // 把 50 个评价模板"分配"到 (user, spot) 上：尽量分散
  // 避免同一 user 对同一 spot 多次评价
  const usedPairs = new Set<string>();

  // 拉取现有评价的 pair，避免重复
  const existingReviews = await prisma.spotReview.findMany({
    select: { userId: true, spotId: true },
  });
  for (const r of existingReviews) {
    usedPairs.add(`${r.userId}:${r.spotId}`);
  }

  let inserted = 0;
  let attempts = 0;
  const maxAttempts = TARGET_REVIEW_COUNT * 8;

  while (inserted < TARGET_REVIEW_COUNT && attempts < maxAttempts) {
    attempts++;
    const userId = pick(userIds);
    const spot = pick(spots);
    const pairKey = `${userId}:${spot.id}`;
    if (usedPairs.has(pairKey)) continue;

    const template = TEMPLATES[inserted % TEMPLATES.length];
    const content = pick(template.pool);

    await prisma.spotReview.create({
      data: {
        userId,
        spotId: spot.id,
        score: template.score,
        content,
        images: [],
        status: "approved",
        createdAt: randomDateWithinDays(120),
      },
    });
    usedPairs.add(pairKey);
    inserted++;

    if (inserted % 10 === 0) {
      console.log(`  ... 已写入 ${inserted}/${TARGET_REVIEW_COUNT}`);
    }
  }

  if (inserted < TARGET_REVIEW_COUNT) {
    console.warn(
      `[警告] 仅成功写入 ${inserted}/${TARGET_REVIEW_COUNT} 条 — ` +
        `用户(${userIds.length}) × 景点(${spots.length}) 可分配的去重组合不够。` +
        ` 可以增加 DEMO_USERS 或导入更多景点。`,
    );
  } else {
    console.log(`[done] 成功写入 ${inserted} 条评价`);
  }
}

async function main() {
  try {
    await seedReviews();
  } catch (err) {
    console.error("[fatal]", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
