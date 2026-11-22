'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import type { DeployInfo, GithubRankResponse, RepoItem } from '@/lib/github-rank-types';

type Tab = 'weekly' | 'allTime' | 'practical';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'weekly', label: '本周热榜', hint: 'GitHub Trending 周榜' },
  { id: 'allTime', label: '历史最热', hint: '总 star 最高的项目' },
  { id: 'practical', label: '最实用', hint: '可自托管 / 可部署的工具' },
];

function fmtCount(n: number): string {
  if (!n) return '0';
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function deployOf(item: RepoItem): DeployInfo {
  if (item.deploy) return item.deploy;
  const web = ['TypeScript', 'JavaScript', 'Vue', 'Svelte', 'Astro', 'HTML', 'CSS'].includes(item.language || '');
  if (web) {
    return {
      type: 'vercel',
      label: 'Vercel 部署',
      url: `https://vercel.com/new/clone?repository-url=${encodeURIComponent(item.html_url)}`,
    };
  }
  return { type: 'docs', label: '安装说明', url: item.html_url };
}

function StarIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
    </svg>
  );
}

export default function GithubClient() {
  const [resp, setResp] = useState<GithubRankResponse | null>(null);
  const [tab, setTab] = useState<Tab>('weekly');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [active, setActive] = useState<RepoItem | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (): Promise<GithubRankResponse | null> => {
    try {
      const res = await fetch('/api/github-rank', { cache: 'no-store' });
      const json = (await res.json()) as GithubRankResponse;
      setResp(json);
      return json;
    } catch {
      const fail: GithubRankResponse = { ok: false, building: false, stale: false, error: '网络错误，请稍后重试' };
      setResp(fail);
      return fail;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      const json = await load();
      if (!alive) return;
      if (json?.building) timer = setTimeout(run, 5000);
    };
    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const data = resp?.data;
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of data?.practical || []) if (item.category) set.add(item.category);
    return ['全部', ...Array.from(set)];
  }, [data]);

  const list = useMemo(() => {
    const source = data?.[tab] || [];
    const q = query.trim().toLowerCase();
    return source.filter((item) => {
      if (tab === 'practical' && category !== '全部' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.full_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.description_zh.toLowerCase().includes(q) ||
        (item.language || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    });
  }, [data, tab, query, category]);

  async function copyCmd(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8 mb-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-accent2/10" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent mb-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              每周自动更新 · 中文翻译
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight">GitHub 榜单</h1>
            <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
              本周热门、历史 star 最高、最值得自托管的实用项目，全部配中文简介。可一键部署到 Vercel，
              或复制 Docker 命令在自己的服务器上跑起来。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-faint">
              <span>更新于 {fmtDate(data?.updatedAt)}</span>
              <span>本周 {data?.weekly.length ?? 0} 个</span>
              <span>历史 {data?.allTime.length ?? 0} 个</span>
              <span>实用 {data?.practical.length ?? 0} 个</span>
              <span>{data?.translator === 'qwen' ? '通义千问翻译' : '原文简介'}</span>
            </div>
            {resp?.stale && (
              <div className="mt-3 text-[11px] text-warning">数据已超过一周，正在后台更新，稍后刷新即可看到新榜单。</div>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="inline-flex rounded-lg border border-line bg-card p-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setCategory('全部');
                }}
                title={t.hint}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-accent text-on-accent' : 'text-muted hover:text-content'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-72">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索项目、简介或语言…"
              className="w-full rounded-lg border border-line bg-card pl-8 pr-3 py-2 text-sm text-content outline-none focus:border-accent"
            />
          </label>
        </div>

        {tab === 'practical' && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
                  category === c
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-line text-faint hover:text-content'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {resp?.building && (
          <div className="mb-4 rounded-xl border border-line bg-card p-4 text-sm text-muted">
            正在生成首期榜单（抓取 GitHub + 翻译中文简介），通常需要 1–2 分钟。页面会自动刷新。
          </div>
        )}

        {!data && !resp?.building && (
          <div className="rounded-xl border border-line bg-card p-8 text-center">
            <div className="text-sm text-muted">{resp?.error || '榜单暂时不可用'}</div>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-xs text-on-accent"
            >
              重新加载
            </button>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.map((item, idx) => {
              const deploy = deployOf(item);
              return (
                <article
                  key={`${tab}-${item.full_name}`}
                  className="group rounded-xl border border-line bg-card p-4 transition-colors hover:border-accent/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 shrink-0 pt-0.5 text-center text-lg font-bold tabular-nums text-faint group-hover:text-accent">
                      {idx + 1}
                    </div>
                    <img
                      src={item.avatar}
                      alt={item.owner}
                      loading="lazy"
                      className="h-9 w-9 shrink-0 rounded-lg border border-line bg-surface object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={item.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-semibold text-content hover:text-accent"
                        >
                          <span className="text-muted">{item.owner}/</span>
                          {item.name}
                        </a>
                        {item.category && (
                          <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-xs leading-5 text-content/90 line-clamp-2">
                        {item.description_zh || item.description || '暂无简介'}
                      </div>
                      {item.description_zh && item.description && (
                        <div className="mt-1 text-[11px] leading-4 text-faint line-clamp-1">{item.description}</div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                        <span className="inline-flex items-center gap-1 text-warning">
                          <StarIcon />
                          {fmtCount(item.stars)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ForkIcon />
                          {fmtCount(item.forks)}
                        </span>
                        {item.language && (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-accent2" />
                            {item.language}
                          </span>
                        )}
                        {!!item.weekStars && <span className="text-success">本周 +{fmtCount(item.weekStars)}</span>}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCopied(false);
                            setActive(item);
                          }}
                          className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-on-accent hover:bg-accent-hover"
                        >
                          {deploy.type === 'docs' ? '部署 / 安装' : deploy.label}
                        </button>
                        <a
                          href={item.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted hover:text-content"
                        >
                          GitHub
                        </a>
                        {item.homepage && (
                          <a
                            href={item.homepage}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-[11px] text-faint hover:text-accent"
                          >
                            官网
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {data && list.length === 0 && (
          <div className="rounded-xl border border-line bg-card p-8 text-center text-sm text-muted">
            没有匹配的项目，换个关键词试试。
          </div>
        )}

        <p className="mt-6 text-[11px] leading-5 text-faint">
          数据来源：GitHub Trending 周榜与 GitHub Search API；中文简介由通义千问翻译。榜单每周一自动更新。
          部署按钮会跳转到 Vercel 或项目官方文档，部署前请自行确认运行环境、许可证与数据安全。
        </p>
      </main>
      <SiteFooter />

      {active && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
          onClick={() => setActive(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 border-b border-line p-4">
              <img src={active.avatar} alt={active.owner} className="h-10 w-10 rounded-lg border border-line" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-content">{active.full_name}</div>
                <div className="mt-0.5 text-[11px] text-faint">
                  {fmtCount(active.stars)} stars · {active.language || '未知语言'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="text-faint hover:text-content"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs leading-5 text-muted">{active.description_zh || active.description || '暂无简介'}</p>

              <div className="flex flex-wrap gap-2">
                <a
                  href={deployOf(active).url || active.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-on-accent hover:bg-accent-hover"
                >
                  {deployOf(active).type === 'vercel'
                    ? '在 Vercel 一键部署'
                    : deployOf(active).type === 'docker'
                      ? '查看 Docker 部署文档'
                      : '查看安装说明'}
                </a>
                <a
                  href={active.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-content"
                >
                  打开 GitHub 仓库
                </a>
              </div>

              {deployOf(active).cmd && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-faint">
                    <span>命令行部署</span>
                    <button
                      type="button"
                      onClick={() => void copyCmd(deployOf(active).cmd || '')}
                      className="text-accent hover:underline"
                    >
                      {copied ? '已复制' : '复制命令'}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-line bg-page p-2.5 text-[11px] leading-5 text-content">
                    {deployOf(active).cmd}
                  </pre>
                </div>
              )}

              <p className="text-[11px] leading-4 text-faint">
                部署会跳转到第三方平台或项目官方文档，需要你自己的账号或服务器。本站只做索引，不参与部署过程。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
