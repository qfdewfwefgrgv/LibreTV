import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { GithubRankData, GithubRankResponse, RepoItem, DeployInfo } from './github-rank-types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'github-rank.json');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UA = 'LibreTV-GitHubRank/1.0 (+https://www.dianying.online/github)';

interface TranslationEntry {
  h: string;
  zh: string;
}

interface Store {
  data?: GithubRankData;
  translations: Record<string, TranslationEntry>;
}

let inflight: Promise<GithubRankData> | null = null;

const PRACTICAL: {
  id: string;
  zh: string;
  category: string;
  deploy: DeployInfo;
}[] = [
  {
    id: 'n8n-io/n8n',
    zh: '开源工作流自动化平台，用可视化节点把 400 多个服务串起来，可自托管替代 Zapier。',
    category: '自动化',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n',
      url: 'https://docs.n8n.io/hosting/',
    },
  },
  {
    id: 'immich-app/immich',
    zh: '自托管照片和视频备份方案，支持手机自动备份、人脸识别、相册共享与时间轴浏览。',
    category: '媒体',
    deploy: { type: 'docs', label: 'Docker Compose', url: 'https://immich.app/docs/install/docker-compose' },
  },
  {
    id: 'jellyfin/jellyfin',
    zh: '免费开源的媒体服务器，把电影、剧集和音乐串流到电视、手机和浏览器。',
    category: '媒体',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name jellyfin -p 8096:8096 -v jellyfin_config:/config -v jellyfin_cache:/cache jellyfin/jellyfin:latest',
      url: 'https://jellyfin.org/docs/general/installation/container',
    },
  },
  {
    id: 'louislam/uptime-kuma',
    zh: '自托管的网站与服务监控面板，支持 HTTP、Ping、端口探测和多种告警通知。',
    category: '运维',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name uptime-kuma -p 3001:3001 -v uptime-kuma:/app/data louislam/uptime-kuma:1',
      url: 'https://github.com/louislam/uptime-kuma/wiki',
    },
  },
  {
    id: 'CorentinTh/it-tools',
    zh: '开发者在线工具箱，聚合 JSON 格式化、Base64、哈希、时间戳、正则测试等常用小工具。',
    category: '效率',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name it-tools -p 8080:80 corentinth/it-tools:latest',
      url: 'https://github.com/CorentinTh/it-tools',
    },
  },
  {
    id: 'Stirling-Tools/Stirling-PDF',
    zh: '本地运行的 PDF 工具箱，合并、拆分、压缩、OCR、签名和格式转换都能在浏览器完成。',
    category: '效率',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name stirling-pdf -p 8080:8080 -v ./stirling-data:/configs stirlingtools/stirling-pdf:latest',
      url: 'https://docs.stirlingpdf.com/',
    },
  },
  {
    id: 'dani-garcia/vaultwarden',
    zh: '轻量级 Bitwarden 兼容密码管理器服务端，资源占用低，适合家庭或小团队自建。',
    category: '安全',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name vaultwarden -p 8080:80 -v vw-data:/data vaultwarden/server:latest',
      url: 'https://github.com/dani-garcia/vaultwarden/wiki',
    },
  },
  {
    id: 'go-gitea/gitea',
    zh: '轻量自托管 Git 服务，自带 Issues、Pull Request 和 CI，几分钟即可跑起来。',
    category: '开发',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name gitea -p 3000:3000 -p 222:22 -v gitea-data:/data gitea/gitea:latest',
      url: 'https://docs.gitea.com/installation/install-with-docker',
    },
  },
  {
    id: 'nocodb/nocodb',
    zh: '把现有数据库变成 Airtable 式的表格界面，支持团队协作、视图和自动生成 API。',
    category: '开发',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name nocodb -p 8080:8080 -v nocodb-data:/usr/app/data nocodb/nocodb:latest',
      url: 'https://docs.nocodb.com/getting-started/self-hosted/',
    },
  },
  {
    id: 'appwrite/appwrite',
    zh: '开源后端平台，提供认证、数据库、存储、云函数和实时订阅，开箱即用。',
    category: '开发',
    deploy: { type: 'docs', label: '自托管文档', url: 'https://appwrite.io/docs/self-hosting' },
  },
  {
    id: 'supabase/supabase',
    zh: '开源 Firebase 替代品，基于 Postgres，提供认证、存储、实时订阅和边缘函数。',
    category: '开发',
    deploy: { type: 'docs', label: '自托管文档', url: 'https://supabase.com/docs/guides/self-hosting/docker' },
  },
  {
    id: 'coollabsio/coolify',
    zh: '自托管 PaaS，像 Vercel 一样部署应用、数据库和 Docker Compose 服务。',
    category: '运维',
    deploy: {
      type: 'docs',
      label: '一键安装脚本',
      url: 'https://coolify.io/docs/installation',
      cmd: 'curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash',
    },
  },
  {
    id: 'Dokploy/dokploy',
    zh: '轻量自托管部署平台，支持 Docker、Compose、Traefik 和自动 HTTPS。',
    category: '运维',
    deploy: {
      type: 'docs',
      label: '一键安装脚本',
      url: 'https://docs.dokploy.com/docs/core/install',
      cmd: 'curl -sSL https://dokploy.com/install.sh | sh',
    },
  },
  {
    id: 'usememos/memos',
    zh: '轻量级自托管笔记与碎片记录工具，支持 Markdown、标签和公开分享。',
    category: '效率',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name memos -p 5230:5230 -v memos-data:/var/opt/memos neosmemo/memos:stable',
      url: 'https://www.usememos.com/docs/install/container-install',
    },
  },
  {
    id: 'excalidraw/excalidraw',
    zh: '手绘风格白板，适合画架构图、流程图和草图，支持协作与导出。',
    category: '效率',
    deploy: {
      type: 'vercel',
      label: 'Vercel 一键部署',
      url: 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fexcalidraw%2Fexcalidraw',
    },
  },
  {
    id: 'navidrome/navidrome',
    zh: '自托管音乐流媒体服务器，兼容 Subsonic 客户端，把本地音乐库变成在线电台。',
    category: '媒体',
    deploy: {
      type: 'docker',
      label: 'Docker 部署',
      cmd: 'docker run -d --name navidrome -p 4533:4533 -v navidrome-data:/data deluan/navidrome:latest',
      url: 'https://www.navidrome.org/docs/installation/docker/',
    },
  },
  {
    id: 'outline/outline',
    zh: '团队知识库与文档协作工具，界面现代，支持 Markdown、搜索和权限管理。',
    category: '协作',
    deploy: { type: 'docs', label: '自托管文档', url: 'https://docs.getoutline.com/s/hosting' },
  },
  {
    id: 'chatwoot/chatwoot',
    zh: '开源客服系统，把网站聊天、邮件、WhatsApp 等渠道汇总到一个收件箱。',
    category: '协作',
    deploy: { type: 'docs', label: 'Docker 部署', url: 'https://www.chatwoot.com/docs/self-hosted/deployment/docker' },
  },
];

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function toNumber(input: string | undefined): number {
  if (!input) return 0;
  const n = Number(input.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function hash(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

function makeRepo(fullName: string, extra: Partial<RepoItem> = {}): RepoItem {
  const [owner, name] = fullName.split('/');
  return {
    full_name: fullName,
    name: name || fullName,
    owner: owner || '',
    html_url: `https://github.com/${fullName}`,
    description: '',
    description_zh: '',
    translated: false,
    stars: 0,
    forks: 0,
    language: null,
    topics: [],
    homepage: null,
    avatar: `https://github.com/${owner || 'github'}.png?size=96`,
    ...extra,
  };
}

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Store;
    return { data: parsed.data, translations: parsed.translations || {} };
  } catch {
    return { translations: {} };
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store), 'utf8');
  await fs.rename(tmp, STORE_FILE);
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': UA,
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function fetchJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const res = await fetch(url, { headers: githubHeaders(), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${url}`);
  return (await res.json()) as T;
}

/** 抓取 GitHub Trending 周榜（HTML），失败时回落到“近 7 天新建且 star 最多”的搜索 */
async function fetchWeekly(): Promise<RepoItem[]> {
  try {
    const res = await fetch('https://github.com/trending?since=weekly', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LibreTV-GitHubRank/1.0)', Accept: 'text/html' },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`trending ${res.status}`);
    const html = await res.text();
    const chunks = html.split('<article class="Box-row">').slice(1);
    const items: RepoItem[] = [];
    for (const article of chunks) {
      const h2 = article.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || '';
      const full = h2.match(/href="\/([^"/]+\/[^"/]+)"/)?.[1];
      if (!full) continue;
      const desc = stripTags(
        article.match(/<p class="[^"]*color-fg-muted[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '',
      );
      const language = stripTags(article.match(/itemprop="programmingLanguage">([^<]+)</)?.[1] || '') || null;
      const stars = toNumber(stripTags(article.match(/href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/)?.[1] || ''));
      const forks = toNumber(stripTags(article.match(/href="\/[^"]+\/forks"[^>]*>([\s\S]*?)<\/a>/)?.[1] || ''));
      const weekStars = toNumber(article.match(/([\d,]+)\s*stars this week/)?.[1]);
      items.push(makeRepo(full, { description: desc, language, stars, forks, weekStars, html_url: `https://github.com/${full}` }));
    }
    if (items.length) return items.slice(0, 15);
  } catch {
    // 继续走搜索兜底
  }
  const since = new Date(Date.now() - WEEK_MS).toISOString().slice(0, 10);
  try {
    const data = await fetchJson<{ items: any[] }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(`created:>=${since}`)}&sort=stars&order=desc&per_page=15`,
    );
    return (data.items || []).map((it) => fromApi(it));
  } catch {
    return [];
  }
}

function fromApi(it: any): RepoItem {
  const full = String(it.full_name || '');
  return makeRepo(full, {
    description: String(it.description || '').trim(),
    stars: Number(it.stargazers_count || 0),
    forks: Number(it.forks_count || 0),
    language: it.language || null,
    topics: Array.isArray(it.topics) ? it.topics.slice(0, 6) : [],
    homepage: it.homepage || null,
    avatar: it.owner?.avatar_url || `https://github.com/${it.owner?.login || 'github'}.png?size=96`,
    created_at: it.created_at,
    pushed_at: it.pushed_at,
  });
}

/** 历史总 star 最高的项目 */
async function fetchAllTime(): Promise<RepoItem[]> {
  try {
    const data = await fetchJson<{ items: any[] }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent('stars:>100000')}&sort=stars&order=desc&per_page=24`,
    );
    return (data.items || []).map((it) => fromApi(it));
  } catch {
    return [];
  }
}

async function buildPractical(): Promise<RepoItem[]> {
  const items: RepoItem[] = [];
  for (const entry of PRACTICAL) {
    let repo: RepoItem;
    try {
      const it = await fetchJson<any>(`https://api.github.com/repos/${entry.id}`);
      repo = fromApi(it);
    } catch {
      repo = makeRepo(entry.id, { description: entry.zh });
    }
    repo.category = entry.category;
    repo.deploy = entry.deploy;
    repo.description_zh = entry.zh;
    repo.translated = true;
    items.push(repo);
  }
  return items;
}

const ALIYUN_BASE = (process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');

/** 用通义千问批量翻译英文简介；失败的项目保留英文，不影响榜单 */
async function translateMissing(items: RepoItem[], cache: Record<string, TranslationEntry>): Promise<void> {
  const key = process.env.ALIYUN_API_KEY;
  if (!key) return;

  const pending = items.filter((it) => it.description && !it.description_zh);
  for (let start = 0; start < pending.length; start += 10) {
    const batch = pending.slice(start, start + 10);
    const input = batch.map((it, i) => `${i + 1}. ${it.description}`).join('\n');
    try {
      const res = await fetch(`${ALIYUN_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.ALIYUN_CHAT_MODEL || 'qwen-plus',
          messages: [
            {
              role: 'system',
              content:
                '你是资深技术编辑，负责把 GitHub 项目简介翻译成自然、准确、简洁的简体中文。保留产品名、技术名词和专有名词原文。只输出 JSON 数组，格式：[{"i":1,"zh":"……"}]，不要输出代码块或任何解释。',
            },
            { role: 'user', content: input },
          ],
          temperature: 0.2,
          max_tokens: 1600,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content || '');
      const arr = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
      const parsed = JSON.parse(arr) as { i: number; zh: string }[];
      for (const row of parsed) {
        const target = batch[Number(row.i) - 1];
        const zh = String(row.zh || '').trim();
        if (target && zh) {
          target.description_zh = zh;
          target.translated = true;
          cache[target.full_name] = { h: hash(target.description), zh };
        }
      }
    } catch {
      // 单批失败就跳过，下一周会重试
    }
  }
}

async function refresh(): Promise<GithubRankData> {
  const store = await readStore();
  const [weekly, allTime, practical] = await Promise.all([fetchWeekly(), fetchAllTime(), buildPractical()]);

  if (!weekly.length && !allTime.length) {
    if (store.data) return store.data;
    throw new Error('GitHub 数据抓取失败');
  }

  const previous = new Map<string, RepoItem>();
  if (store.data) {
    for (const section of [store.data.weekly, store.data.allTime, store.data.practical]) {
      for (const item of section) previous.set(item.full_name, item);
    }
  }

  const all = [...weekly, ...allTime, ...practical];
  for (const item of all) {
    const old = previous.get(item.full_name);
    if (old && old.description === item.description && old.description_zh) {
      item.description_zh = old.description_zh;
      item.translated = old.translated;
      continue;
    }
    const cached = store.translations[item.full_name];
    if (cached && item.description && cached.h === hash(item.description)) {
      item.description_zh = cached.zh;
      item.translated = true;
    }
  }

  await translateMissing(all, store.translations);

  const data: GithubRankData = {
    updatedAt: new Date().toISOString(),
    translator: process.env.ALIYUN_API_KEY ? 'qwen' : 'none',
    weekly,
    allTime,
    practical,
  };
  await writeStore({ data, translations: store.translations });
  return data;
}

function ensureRefresh(): Promise<GithubRankData> {
  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** 读取缓存；超过 7 天返回旧数据并在后台刷新 */
export async function getGithubRank(): Promise<GithubRankResponse> {
  const store = await readStore();
  if (!store.data) {
    void ensureRefresh().catch(() => {});
    return { ok: true, building: true, stale: false };
  }
  const age = Date.now() - Date.parse(store.data.updatedAt);
  if (age > WEEK_MS) {
    void ensureRefresh().catch(() => {});
    return { ok: true, building: false, stale: true, data: store.data };
  }
  return { ok: true, building: false, stale: false, data: store.data };
}

/** 强制刷新，供每周定时任务调用 */
export async function refreshGithubRank(): Promise<GithubRankData> {
  return ensureRefresh();
}
