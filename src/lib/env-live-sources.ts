import type { LiveSourceConfig } from './types';

/**
 * 部署者通过 DEFAULT_LIVE_SOURCES 环境变量预置的直播源（M3U 订阅）。
 * 格式为 JSON 数组：[{"name":"源名","url":"https://.../list.m3u","epg":"https://.../epg.xml.gz"}]
 * 解析失败时告警并整体忽略，不影响站点运行。模式与 env-sources.ts 对齐。
 */

/**
 * 预置源的稳定标识：基于 URL 而不是数组下标。
 * 用下标做 key 时，调整源顺序会让「新源」复用老下标的身份，
 * 前端按 key 记录的「已见过」判断就会把新源当成老源、不再自动启用。
 */
function sourceKey(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function getEnvLiveSources(): LiveSourceConfig[] {
  const raw = process.env.DEFAULT_LIVE_SOURCES;
  if (!raw || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('必须是 JSON 数组');
    const list: LiveSourceConfig[] = parsed.map((item, i) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`第 ${i + 1} 项不是对象`);
      }
      const { name, url, epg } = item as Record<string, unknown>;
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error(`第 ${i + 1} 项缺少 name`);
      }
      if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
        throw new Error(`第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
      }
      const cleanUrl = url.trim().replace(/\/+$/, '');
      return {
        key: `envlive_${sourceKey(cleanUrl)}`,
        name: name.trim(),
        url: cleanUrl,
        epg: typeof epg === 'string' && epg.trim() ? epg.trim() : undefined,
      };
    });
    return list;
  } catch (err) {
    console.warn('[LibreTV] DEFAULT_LIVE_SOURCES 解析失败，已忽略：', err instanceof Error ? err.message : err);
    return [];
  }
}
