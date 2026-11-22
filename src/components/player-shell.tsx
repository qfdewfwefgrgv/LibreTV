'use client';

import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls, { type HlsConfig } from 'hls.js';

import { PlaybackRecovery, describeHlsError } from '@/lib/playback-recovery';
import { createHlsLoader } from '@/lib/hls-loader';
import {
  getVideoPrefetcher,
  getNextEpisodePrefetcher,
} from '@/lib/video-prefetcher';
import { loadCacheSettings } from '@/lib/video-cache';
import { formatTime } from '@/lib/utils';
import { prefersTouchPointer } from '@/lib/touch-pointer';
import { createLandscapeGuard } from '@/lib/force-landscape';
import {
  BRIGHTNESS_DEFAULT,
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  VOLUME_MAX,
  VOLUME_MIN,
  classifyGesture,
  gestureValue,
  type GestureKind,
} from '@/lib/touch-gesture';
import {
  ART_DEFAULT_CONTROL_HIDE_MS,
  DESKTOP_CONTROL_HIDE_MS,
  TOUCH_CONTROL_HIDE_MS,
} from '@/lib/control-hide';

/**
 * 片头 / 片尾自动跳过（播放器设置面板里的两项）。
 * 取值 0 表示关闭；选项固定为 30/60/90/120 秒，属于本机个人偏好，存 localStorage。
 */
const SKIP_STORAGE_KEY = 'libretv:skip-seconds';
const SKIP_OPTIONS = [0, 30, 60, 90, 120] as const;

type SkipPrefs = { intro: number; outro: number };

const isSkipOption = (value: unknown): value is number =>
  typeof value === 'number' && (SKIP_OPTIONS as readonly number[]).includes(value);

function loadSkipPrefs(): SkipPrefs {
  try {
    const raw = localStorage.getItem(SKIP_STORAGE_KEY);
    if (!raw) return { intro: 0, outro: 0 };
    const parsed = JSON.parse(raw) as Partial<SkipPrefs>;
    return {
      intro: isSkipOption(parsed.intro) ? parsed.intro : 0,
      outro: isSkipOption(parsed.outro) ? parsed.outro : 0,
    };
  } catch {
    // 隐私模式 / 存储被禁用：按关闭处理
    return { intro: 0, outro: 0 };
  }
}

function saveSkipPrefs(prefs: SkipPrefs) {
  try {
    localStorage.setItem(SKIP_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // 忽略写入失败，当前会话内仍然生效
  }
}

/**
 * 播放器外壳：ArtPlayer + hls.js（旧版 player.js 的 React 化）。
 * 保留：广告分片过滤、自动连播回调、进度回调、快捷键、移动端长按倍速、错误恢复。
 * 移除：DOM 手工操作、watch.html 跳转链、localStorage 状态总线。
 *
 * 关键设计：ArtPlayer 实例只在挂载时创建一次，换集（url 变化）只「切换 HLS 源」
 * 而不销毁重建。否则在「网页全屏（页面全屏）」下整实例重建会丢失全屏上下文、
 * 重建 <video> 元素，触发「黑屏有声」的渲染竞态。
 */

interface PlayerShellProps {
  url: string;
  title: string;
  adFilter: boolean;
  autoplayNext: boolean;
  /** 剧集标识 `${source}:${vodId}:${episodeIndex}`（片段缓存按集淘汰的分组键） */
  episodeKey?: string;
  /** 下一集 m3u8 地址：当前集预取完成后预热下一集前 7 分钟 */
  nextUrl?: string;
  nextEpisodeKey?: string;
  /** 进度恢复：优先 URL position，其次查询该回调（返回 0 表示无记录） */
  getRestorePosition?: () => number | Promise<number>;
  onTimeUpdate?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onPause?: (position: number, duration: number) => void;
  /**
   * 实测画质（视频高度，像素）。
   * 单码率 m3u8 / 直链的分辨率只能等解码后才知道，播放一次后回写缓存，
   * 下次搜索同一部剧就能直接显示画质，不必再探测。
   */
  onQuality?: (height: number) => void;
  /** 恢复策略判源不可用（重试耗尽/格式硬失败）时回调：父级弹出换源面板 */
  onRequestSwitchSource?: (reason: string) => void;
}

export function PlayerShell({
  url,
  title,
  adFilter,
  autoplayNext,
  episodeKey,
  nextUrl,
  nextEpisodeKey,
  getRestorePosition,
  onTimeUpdate,
  onEnded,
  onPause,
  onQuality,
  onRequestSwitchSource,
}: PlayerShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  // 起播前的品牌占位图（沿用旧版 nomedia 素材），实际开始播放后隐藏
  const [showPoster, setShowPoster] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 始终持有最新 props/回调，避免重建播放器
  const propsRef = useRef({
    url, title, adFilter, autoplayNext, episodeKey, nextUrl, nextEpisodeKey,
    getRestorePosition, onTimeUpdate, onEnded, onPause, onQuality, onRequestSwitchSource,
  });
  propsRef.current = {
    url, title, adFilter, autoplayNext, episodeKey, nextUrl, nextEpisodeKey,
    getRestorePosition, onTimeUpdate, onEnded, onPause, onQuality, onRequestSwitchSource,
  };

  /** 上报实测画质：多次上报取大值由调用方决定，这里只管把拿到的高度传出去 */
  const reportQuality = (height: number) => {
    if (height > 0) propsRef.current.onQuality?.(height);
  };

  // 跨集共享、每次换集重置的播放链路状态
  // 媒体健康度：音频轨可播不代表视频轨正常（「黑屏但有声」的假死态）。
  // 仅当有分片真正进入 MSE buffer 后才视为恢复，错误遮罩才能被清除。
  const mediaHealthyRef = useRef(true);
  const playbackStartedRef = useRef(false);
  // 起播阶段的 video 元素级错误允许自愈重试一次（重建 hls/MSE）
  const videoErrorRetryUsedRef = useRef(false);
  // 进度恢复每集只执行一次（MANIFEST_PARSED 可能因代理回退再次触发）
  const restoredRef = useRef(false);
  // 某些 HLS 源在 MANIFEST_PARSED 时 duration 仍未就绪，延迟到媒体元数据可用后恢复
  const restoreCleanupRef = useRef<(() => void) | null>(null);
  // timeupdate 续跑预取的游标：必须按集清零，否则会沿用上一集的时间戳推迟首次续跑
  const lastPrefetchEnsureRef = useRef(0);
  // 片头/片尾跳过偏好（设置面板可改，改完立即生效并持久化）
  const skipPrefsRef = useRef<SkipPrefs>({ intro: 0, outro: 0 });
  // 每集各只自动跳一次：用户看完片头后又拖回开头时不能反复抢进度
  const introSkippedRef = useRef(false);
  const outroSkippedRef = useRef(false);
  // setupHls 可能改走代理形式，video:error 重试要用最近一次的地址
  const currentMediaUrlRef = useRef(url);
  // 本集的恢复策略实例：跨直连/代理两级重建共享计数
  const recoveryRef = useRef<PlaybackRecovery | null>(null);
  // 自然播完标记，卸载时不回写进度（避免覆盖「已看完」记录）
  const endedRef = useRef(false);
  // 多码率档位（按高度从高到低），仅当清单有 ≥2 档时用于控制栏画质按钮
  const qualityLevelsRef = useRef<Array<{ index: number; height: number }>>([]);
  // 自适应降档：40s 窗口内出现 2 次空窗（waiting）就认为客户端解不动当前码率
  const stallEventsRef = useRef<number[]>([]);
  const autoDowngradedRef = useRef(false);

  const showHint = (text: string) => {
    setHint(text);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(''), 2500);
  };

  // 片段缓存开启时略微调大 hls.js 自身缓冲，缓冲之外的空窗由预取器补齐。
  // 注意别把 maxBufferLength 调得太大：1080p 单段约 7MB，120s 缓冲意味着
  // 一次性往 MSE 里塞 80MB+，低配设备会明显掉帧（画面看起来像「缓冲满了还卡」）。
  const buildHlsConfig = (): Partial<HlsConfig> => {
    const p = propsRef.current;
    const cacheSettings = loadCacheSettings();
    const cacheEnabled = cacheSettings.enabled && !!p.episodeKey;
    return {
      debug: false,
      enableWorker: true,
      backBufferLength: 30,
      maxBufferLength: cacheEnabled ? 45 : 30,
      maxMaxBufferLength: cacheEnabled ? 90 : 60,
      maxBufferSize: (cacheEnabled ? 45 : 30) * 1000 * 1000,
      maxBufferHole: 0.5,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 1000,
      startLevel: -1,
      abrEwmaDefaultEstimate: 500_000,
      // 长视频流畅度：预取下一个分片，减少播到片尾才去请求导致的卡顿空窗
      startFragPrefetch: true,
      maxStarvationDelay: 6,
      maxLoadingDelay: 6,
      appendErrorMaxRetry: 5,
      // 直播平滑：贴着直播边缘播（3 个目标时长），落后超过 10 个时长就加速追帧，
      // 避免直播越播越延迟、或滞后过多后被迫卡顿重缓冲。对点播清单不生效。
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      maxLiveSyncPlaybackRate: 1.5,
      // 组合 loader：广告过滤（blockAd 随设置）+ 片段缓存命中（cacheEnabled）
      loader: createHlsLoader(Hls, { blockAd: p.adFilter }) as unknown as HlsConfig['loader'],
    };
  };

  /**
   * 画质切换（1080p / 2K）：只在清单含 ≥2 个档位时往控制栏加一个按钮。
   * 初始锁在最低档（1080p）保证流畅，用户点一下即切到下一档；
   * 单码率源（外部影库、直播等）不会出现该按钮。
   */
  const updateQualityControl = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const art = artRef.current as any;
    const hls = hlsRef.current;
    if (!art || !hls) return;

    const levels = hls.levels
      .map((level, index) => ({ index, height: level.height || 0 }))
      .sort((a, b) => b.height - a.height);

    if (levels.length < 2) {
      qualityLevelsRef.current = [];
      try { art.controls?.remove?.('quality'); } catch { /* 尚未挂载 */ }
      return;
    }
    qualityLevelsRef.current = levels;

    const currentLevel = () => (hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel);
    const labelOf = () => {
      const height = hls.levels[currentLevel()]?.height || 0;
      return height >= 1440 ? '2K' : height > 0 ? `${height}P` : '画质';
    };

    if (!art.controls?.quality) {
      art.controls.add({
        name: 'quality',
        position: 'right',
        index: 10,
        html: labelOf(),
        tooltip: '切换画质（1080P / 2K）',
        click: () => {
          const live = hlsRef.current;
          const list = qualityLevelsRef.current;
          if (!live || list.length < 2) return;
          const cur = live.currentLevel >= 0 ? live.currentLevel : live.loadLevel;
          const pos = list.findIndex((item) => item.index === cur);
          const next = list[(pos + 1) % list.length];
          live.currentLevel = next.index;
          const text = next.height >= 1440 ? '2K' : `${next.height}P`;
          try { art.controls.update('quality', { html: text }); } catch { /* 忽略 */ }
          // 换档后旧档的预取窗口作废，按新档位重建（否则会继续按 1080p 拉分片）
          getVideoPrefetcher().stop();
          ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
          showHint(`已切换到 ${text}`);
        },
      });
    } else {
      try { art.controls.update('quality', { html: labelOf() }); } catch { /* 忽略 */ }
    }
  };

  // 当前 HLS 档位高度：多码率清单下让预取只拉正在播的那一档
  const currentHlsHeight = () => {
    const h = hlsRef.current;
    if (!h || h.levels.length === 0) return undefined;
    const idx = h.currentLevel >= 0 ? h.currentLevel : h.loadLevel;
    return h.levels[idx]?.height || undefined;
  };

  // 当前集预取（episodeKey 缺省 = 关闭，见 ensure 内部 settings.enabled 判断）
  const ensurePrefetch = (mediaUrl: string, currentTime: number, horizonSeconds?: number) => {
    const p = propsRef.current;
    if (!p.episodeKey) return;
    getVideoPrefetcher().ensure({
      m3u8Url: mediaUrl,
      currentTime,
      episodeKey: p.episodeKey,
      horizonSeconds,
      preferredHeight: currentHlsHeight(),
      onProgress: (stats) => {
        // 当前集预取完成且存在下一集：用独立预取器预热下一集前 7 分钟
        if (stats.state === 'done' && p.nextUrl && p.nextEpisodeKey) {
          getNextEpisodePrefetcher().ensure({
            m3u8Url: p.nextUrl,
            currentTime: 0,
            episodeKey: p.nextEpisodeKey,
            horizonSeconds: 420,
          });
        }
      },
    });
  };

  /**
   * 初始化/切换 HLS。allowProxyFallback：直连致命网络错误（CORS/防盗链/分片被拒）时，
   * 自动改走同源 cookie 鉴权的 /api/proxy 重试一次。
   * 注意：不销毁 ArtPlayer，只销毁并重建 hls，从而保留网页全屏等播放器状态。
   */
  const setupHls = (video: HTMLVideoElement, mediaUrl: string, allowProxyFallback: boolean) => {
    restoreCleanupRef.current?.();
    restoreCleanupRef.current = null;
    hlsRef.current?.destroy();
    currentMediaUrlRef.current = mediaUrl;

    // 部分国产浏览器内核（夸克/UC/百度等）不支持或残缺支持 MSE，hls.js 无法起播。
    // 此时回退到 <video> 原生 HLS，由内核自行解码。
    if (!Hls.isSupported()) {
      hlsRef.current = null;
      video.src = mediaUrl;
      video.addEventListener(
        'error',
        () => showHint('当前浏览器不支持网页播放，请使用 LibreTV 客户端或 Chrome'),
        { once: true },
      );
      video.play().catch(() => {});
      return;
    }
    // 换集（或重建链路）时清空自适应降档的计数，避免把上一集的卡顿带过来
    stallEventsRef.current = [];
    autoDowngradedRef.current = false;
    const hls = new Hls(buildHlsConfig());
    hlsRef.current = hls;

    let restoreInFlight = false;
    const restoreAndStart = async () => {
      if (restoredRef.current || restoreInFlight) return;

      // MANIFEST_PARSED 早于 loadedmetadata 的 HLS 源很常见；没有有效时长时
      // 先不消费 restoredRef，等 loadedmetadata/durationchange 后再重试。
      const duration = artRef.current?.duration || video.duration || 0;
      if (!Number.isFinite(duration) || duration <= 0) return;

      restoreInFlight = true;
      try {
        const saved = (await propsRef.current.getRestorePosition?.()) ?? 0;
        const currentDuration = artRef.current?.duration || video.duration || duration;
        let prefetchAnchor = video.currentTime;
        if (saved > 10 && Number.isFinite(currentDuration) && saved < currentDuration - 2) {
          if (artRef.current) artRef.current.currentTime = saved;
          prefetchAnchor = saved;
          showHint(`已从 ${formatTime(saved)} 继续播放`);
        }
        restoredRef.current = true;
        restoreCleanupRef.current?.();
        restoreCleanupRef.current = null;
        ensurePrefetch(mediaUrl, prefetchAnchor);
        video.play().catch(() => {});
      } catch {
        // IndexedDB 读取失败时不阻塞播放，后续事件仍可再次尝试恢复。
      } finally {
        restoreInFlight = false;
      }
    };

    const restoreEvents = ['loadedmetadata', 'durationchange', 'canplay'] as const;
    const onRestoreEvent = () => { void restoreAndStart(); };
    restoreEvents.forEach((event) => video.addEventListener(event, onRestoreEvent));
    restoreCleanupRef.current = () => {
      restoreEvents.forEach((event) => video.removeEventListener(event, onRestoreEvent));
    };

    hls.loadSource(mediaUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      recoveryRef.current?.markHealthy();
      // master playlist 的档位高度：多码率源在这里就能拿到上限
      const heights = hls.levels
        .map((level) => level.height)
        .filter((h): h is number => typeof h === 'number' && h > 0);
      if (heights.length > 0) reportQuality(Math.max(...heights));
      // 多码率清单按「最高不超过 1080P」设上限，交给 ABR 自适应：
      // 之前锁 currentLevel = 0（hls.js 里 0 通常是最低档），片源有多档时会一直糊着播。
      if (hls.levels.length > 1) {
        const capIdx = hls.levels.reduce((best, level, i) => {
          const h = level.height || 0;
          if (h > 1080) return best;
          return h > (hls.levels[best]?.height || 0) ? i : best;
        }, 0);
        hls.autoLevelCapping = capIdx;
        hls.currentLevel = -1;
      }
      // 稍等一拍：ArtPlayer 实例在主流程里创建，此刻可能还没赋值
      setTimeout(() => updateQualityControl(), 0);
      // 进度恢复改由 restoreAndStart 处理：duration 未就绪时不消费标记，挂事件重试
      void restoreAndStart();
    });
    // 播放链路恢复（FRAG_LOADED / MANIFEST_PARSED）：静默窗外清零连续失败计数
    hls.on(Hls.Events.FRAG_LOADED, () => recoveryRef.current?.markHealthy());
    // 单码率源在 MANIFEST 阶段拿不到 height（清单尚未解析），这里补一次。
    // 注意 data.level 是档位下标，分辨率在 levelInfo 上
    hls.on(Hls.Events.LEVEL_LOADED, (_evt, data) => {
      const height = data.levelInfo?.height;
      if (typeof height === 'number') reportQuality(height);
    });
    // 档位真正切换后刷新按钮文案（同时兜底补挂按钮：MANIFEST 时播放器可能还没就绪）
    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
      setTimeout(() => updateQualityControl(), 0);
    });
    // 分片真正进入 MSE buffer 才算媒体恢复：此时视频轨可渲染，错误态可解除
    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      mediaHealthyRef.current = true;
    });

    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return;
      const recovery = recoveryRef.current;
      if (!recovery) return;
      const decision = recovery.onFatal(data.type, data.details);
      switch (decision.action) {
        case 'ignore':
          break;
        case 'retry': {
          // 前两次重试保留直连；达到退避阈值或清单级错误时升级为代理形式
          // （同源 cookie 鉴权，规避 CORS/防盗链/分片被拒）
          if (
            allowProxyFallback &&
            !mediaUrl.startsWith('/api/proxy') &&
            (decision.attempt >= 2 || data.details === 'manifestLoadError')
          ) {
            showHint('直连失败，改用代理重试...');
            setupHls(video, `/api/proxy?url=${encodeURIComponent(mediaUrl)}`, false);
            return;
          }
          showHint(`${decision.reason}（第 ${decision.attempt} 次）...`);
          recovery.schedule(decision.delayMs, () => hls.startLoad());
          break;
        }
        case 'recover-media': {
          showHint(`${decision.reason}（第 ${decision.attempt} 次）...`);
          if (decision.swapAudio) hls.swapAudioCodec?.();
          hls.recoverMediaError();
          break;
        }
        case 'switch-source': {
          // 覆盖播放开始后的场景：起播失败走 setError 遮罩；
          // 播放中失败走回调弹换源面板（父级未提供回调时同样 setError）
          const message = `${describeHlsError(data.type, data.details)}：${decision.reason}`;
          if (playbackStartedRef.current) {
            showHint(message);
            propsRef.current.onRequestSwitchSource?.(decision.reason);
          } else {
            setError(`视频加载失败，${message}，请尝试其他视频源`);
          }
          break;
        }
      }
    });
  };

  /** 换集：重置每集状态并切换到新 HLS 源（不重建 ArtPlayer）。 */
  /** 是否为 HLS 播放列表；非 HLS（如本地 mp4 直链）走原生播放，不经 hls.js */
  const isHlsUrl = (u: string) => /\.m3u8(\?|#|$)/i.test(u);

  const loadEpisode = (targetUrl: string) => {
    if (!targetUrl) return;
    mediaHealthyRef.current = true;
    playbackStartedRef.current = false;
    videoErrorRetryUsedRef.current = false;
    restoredRef.current = false;
    lastPrefetchEnsureRef.current = 0;
    // 换集后按当前设置重新判断片头/片尾
    introSkippedRef.current = false;
    outroSkippedRef.current = false;
    recoveryRef.current = new PlaybackRecovery();
    // 换集时清掉上一集的预取窗口，避免带宽被旧集占用
    getVideoPrefetcher().stop();
    setError('');
    setShowPoster(true);
    const art = artRef.current;
    if (!art) return;
    if (!isHlsUrl(targetUrl)) {
      // 直链（本地 mp4/mkv 等）：交给 <video> 原生播放，hls.js 解析不了这类地址
      hlsRef.current?.destroy();
      hlsRef.current = null;
      currentMediaUrlRef.current = targetUrl;
      art.video.src = targetUrl;
      art.play?.();
      return;
    }
    setupHls(art.video, targetUrl, true);
  };

  // —— 创建播放器（仅一次，挂载即创建） ——
  useEffect(() => {
    if (!containerRef.current || !propsRef.current.url) return;
    const initialUrl = propsRef.current.url;
    // ArtPlayer 默认 3 秒才隐藏控制栏；桌面失去鼠标悬停后缩短为 0.8 秒。
    // 触屏没有 hover，自动隐藏会让按钮来不及点（issue #937）：改为常驻，
    // 由「点按视频 toggle」收起。CONTROL_HIDE_TIME 是 static，创建后修改立即生效。
    const touchPointer = prefersTouchPointer();
    Artplayer.CONTROL_HIDE_TIME = touchPointer ? TOUCH_CONTROL_HIDE_MS : DESKTOP_CONTROL_HIDE_MS;

    // 初始化每集状态
    mediaHealthyRef.current = true;
    playbackStartedRef.current = false;
    videoErrorRetryUsedRef.current = false;
    restoredRef.current = false;
    recoveryRef.current = new PlaybackRecovery();
    endedRef.current = false;

    let lastSave = 0;

    const art = new Artplayer({
      container: containerRef.current,
      url: initialUrl,
      // 本地 mp4 等直链用原生播放；只有 m3u8 才交给 hls.js
      type: isHlsUrl(initialUrl) ? 'm3u8' : 'mp4',
      volume: 0.8,
      autoplay: true,
      pip: true,
      autoMini: true,
      screenshot: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      airplay: true,
      hotkey: false,
      theme: '#2563eb',
      lang: navigator.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en',
      moreVideoAttr: { crossOrigin: 'anonymous', playsInline: true },
      customType: {
        m3u8: (video: HTMLVideoElement, mediaUrl: string) => {
          setupHls(video, mediaUrl, true);
        },
      },
    });
    artRef.current = art;

    // —— 设置面板里的「跳过开头 / 跳过结尾」（ArtPlayer 自带齿轮面板） ——
    skipPrefsRef.current = loadSkipPrefs();
    introSkippedRef.current = false;
    outroSkippedRef.current = false;

    const addSkipSetting = (label: string, key: 'intro' | 'outro') => {
      // ArtPlayer 的 setting.add 未提供完整类型，这里用 any 兜住 selector/onSelect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (art.setting as any).add({
        html: label,
        tooltip: `${label}：播放到指定位置自动跳过，「不跳过」为关闭`,
        selector: SKIP_OPTIONS.map((sec) => ({
          html: sec === 0 ? '不跳过' : `${sec} 秒`,
          value: sec,
          default: skipPrefsRef.current[key] === sec,
        })),
        onSelect(item: { html?: string; value?: unknown }) {
          const value = Number(item.value);
          skipPrefsRef.current = {
            ...skipPrefsRef.current,
            [key]: isSkipOption(value) ? value : 0,
          };
          saveSkipPrefs(skipPrefsRef.current);
          // 改了时长就允许本集按新值重新跳一次
          if (key === 'intro') introSkippedRef.current = false;
          else outroSkippedRef.current = false;
          showHint(value > 0 ? `${label} ${value} 秒` : `${label}已关闭`);
          return item.html ?? '';
        },
      });
    };
    addSkipSetting('跳过开头', 'intro');
    addSkipSetting('跳过结尾', 'outro');
    // 全屏（原生全屏 / 网页全屏）时：手机与平板强制横屏，桌面不处理
    const releaseLandscapeGuard = createLandscapeGuard(
      () => (art as unknown as { template?: { $player?: HTMLElement } }).template?.$player ?? null
    );

    /**
     * 读解码后的真实分辨率。
     * 单码率 m3u8 / mp4 直链的清单里没有画质字段，服务端无论如何探测不到，
     * 只有 video 元素的 videoHeight 是真的——这是「播放一次即记住画质」链路的唯一数据源。
     * loadedmetadata 在部分浏览器上 videoHeight 仍为 0，因此 resize / canplay / playing
     * 各补一次机会，不能只赌单一事件时机。
     */
    const reportVideoHeight = () => {
      const height = art.video?.videoHeight;
      if (typeof height === 'number' && height > 0) reportQuality(height);
    };
    art.on('video:loadedmetadata', reportVideoHeight);
    art.on('video:canplay', reportVideoHeight);
    // resize 不在 ArtPlayer 的视频事件转发表里，直接挂原生事件
    art.video?.addEventListener('resize', reportVideoHeight);

    art.on('video:loadedmetadata', () => {
      // ArtPlayer 运行时支持 title 选项（类型定义未覆盖），用于界面标题展示
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (art as any).title = propsRef.current.title;
      } catch { /* 忽略 */ }
    });

    art.on('video:playing', () => {
      playbackStartedRef.current = true;
      setShowPoster(false);
      // 仅在媒体真正恢复（有分片进入 buffer）后清错误遮罩：
      // 否则「视频轨挂了、音频轨先播出来」时会清掉遮罩，留下黑屏假死态
      if (mediaHealthyRef.current) setError('');
      reportVideoHeight();
    });
    art.on('video:error', () => {
      mediaHealthyRef.current = false;
      // 起播阶段的 video 元素级错误（MSE/解码偶发失败）：重建一次播放链路自愈，
      // 而不是直接钉死错误遮罩——重建后视频轨重新 append，黑屏有声即可解除
      if (!playbackStartedRef.current && !videoErrorRetryUsedRef.current) {
        videoErrorRetryUsedRef.current = true;
        showHint('播放异常，正在重试...');
        setupHls(art.video, currentMediaUrlRef.current, true);
        return;
      }
      setError('视频播放失败，请尝试其他视频源');
    });
    art.on('video:timeupdate', () => {
      const now = Date.now();
      if (now - lastSave > 5000) {
        lastSave = now;
        propsRef.current.onTimeUpdate?.(art.currentTime, art.duration);
      }
      // 每 30s 续跑一次前向预取窗口（ensure 幂等，窗口未覆盖足够余量才会重建）
      if (now - lastPrefetchEnsureRef.current > 30_000) {
        lastPrefetchEnsureRef.current = now;
        // 用 currentMediaUrlRef（代理回退后的实际地址）：否则预取的 key 与
        // loader 读取的 key 不一致，缓存永不命中且直连 fetch 白耗流量
        ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
      }

      // —— 片头 / 片尾自动跳过（设置面板的偏好，每集各跳一次） ——
      const { intro, outro } = skipPrefsRef.current;
      const total = art.duration;
      // 片头：只在起播附近生效，恢复进度落在中段时不打扰；
      // 片长不足「跳过开头 + 1 秒」时不动，避免短视频被直接推到结尾
      if (
        intro > 0 &&
        !introSkippedRef.current &&
        total > intro + 1 &&
        art.currentTime > 0.8 &&
        art.currentTime < intro
      ) {
        introSkippedRef.current = true;
        art.currentTime = intro;
        showHint(`已跳过开头 ${intro} 秒`);
      }
      // 片尾：临近结尾直接推到片尾（自动连播时即进入下一集）
      if (
        outro > 0 &&
        !outroSkippedRef.current &&
        !art.video?.paused &&
        total > outro + 1 &&
        total - art.currentTime <= outro
      ) {
        outroSkippedRef.current = true;
        showHint(`已跳过结尾 ${outro} 秒`);
        art.currentTime = total - 0.15;
      }
    });
    art.on('video:seeked', () => {
      ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
    });
    art.on('video:pause', () => {
      propsRef.current.onPause?.(art.currentTime, art.duration);
      // 暂停 = 预取黄金窗口：解除限速并无限铺满整集（用户主动行为，带宽占用可接受）
      // waiting 触发的限速在此解除，否则黄金窗口会被 500ms 轮询冻结
      getVideoPrefetcher().setThrottled(false);
      ensurePrefetch(currentMediaUrlRef.current, art.currentTime, 0);
    });
    art.on('video:waiting', () => {
      // 卡顿：预取临时让出带宽给播放
      getVideoPrefetcher().setThrottled(true);

      // 自适应降档：缓冲里明明有数据却反复空窗，说明卡在解码/渲染而非网络，
      // 此时主动降到最低码率档（720P），比让用户干等更有效。每集只自动降一次。
      const hls = hlsRef.current;
      if (!hls || !playbackStartedRef.current || autoDowngradedRef.current) return;
      if (hls.levels.length < 2 || art.video.currentTime < 2) return;
      const now = Date.now();
      const recent = stallEventsRef.current.filter((t) => now - t < 40_000);
      recent.push(now);
      stallEventsRef.current = recent;
      if (recent.length < 2) return;

      const lowest = hls.levels
        .map((level, index) => ({ index, bitrate: level.bitrate || 0, height: level.height || 0 }))
        .sort((a, b) => a.bitrate - b.bitrate)[0];
      const cur = hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel;
      if (!lowest || lowest.index === cur) return;

      autoDowngradedRef.current = true;
      hls.currentLevel = lowest.index;
      getVideoPrefetcher().stop();
      ensurePrefetch(currentMediaUrlRef.current, art.currentTime);
      showHint(`持续卡顿，已自动切到 ${lowest.height >= 1440 ? '2K' : `${lowest.height}P`} 保证流畅`);
    });
    art.on('video:playing', () => {
      getVideoPrefetcher().setThrottled(false);
    });
    art.on('video:ended', () => {
      endedRef.current = true;
      propsRef.current.onEnded?.();
    });

    // —— 键盘快捷键（旧版 hotkey:false + 自定义逻辑的移植） ——
    const shortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 输入框或按钮获得焦点时不劫持按键：否则空格会吞掉按钮的默认激活
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('button')) return;
      const current = artRef.current;
      if (!current) return;
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return; } // 由父层处理集数切换
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return; }
      switch (e.key) {
        case 'ArrowLeft':
          if (current.currentTime > 5) { current.currentTime -= 5; showHint('快退 5s'); e.preventDefault(); }
          break;
        case 'ArrowRight':
          if (current.duration - current.currentTime > 5) { current.currentTime += 5; showHint('快进 5s'); e.preventDefault(); }
          break;
        case 'ArrowUp':
          if (current.volume < 1) { current.volume = Math.min(1, current.volume + 0.1); showHint(`音量 ${Math.round(current.volume * 100)}%`); e.preventDefault(); }
          break;
        case 'ArrowDown':
          if (current.volume > 0) { current.volume = Math.max(0, current.volume - 0.1); showHint(`音量 ${Math.round(current.volume * 100)}%`); e.preventDefault(); }
          break;
        case ' ':
          current.toggle(); showHint('播放/暂停'); e.preventDefault();
          break;
        case 'f': case 'F':
          current.fullscreen = !current.fullscreen; e.preventDefault();
          break;
      }
    };
    document.addEventListener('keydown', shortcuts);

    // —— 移动端长按 3 倍速 ——
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;
    let originalRate = 1.0;
    const el = containerRef.current;

    // 全屏时播放器覆盖整个视口，无法依赖 mouseleave 判断“移出播放器”。
    // 改为按鼠标活动计时：停止移动后快速收起控制栏，移动时立即显示。
    let controlHideTimer: ReturnType<typeof setTimeout> | null = null;
    const showControlsOnPointerMove = () => {
      art.controls.show = true;
      if (controlHideTimer) clearTimeout(controlHideTimer);
      controlHideTimer = setTimeout(() => {
        if (!art.setting.show) art.controls.show = false;
      }, 800);
    };
    const hideControlsOnMouseLeave = () => {
      if (controlHideTimer) clearTimeout(controlHideTimer);
      controlHideTimer = null;
      art.controls.show = false;
    };
    // 触屏不监听 mousemove/mouseleave，也跳过初始显示：iOS 点按视频的合成事件
    // 序列是 mousemove → click，若 mousemove 先把 show 置 true，紧跟的 ArtPlayer
    // click toggle 会把它翻回 false——控制栏「闪一下即隐」，正是 issue #937 的病灶
    if (!touchPointer) {
      el?.addEventListener('mousemove', showControlsOnPointerMove);
      el?.addEventListener('mouseleave', hideControlsOnMouseLeave);
      showControlsOnPointerMove();
    }

    // —— 自动最小化还原：滚回播放器原位置时把小窗收回 ——
    // ArtPlayer 的 autoMini 只会在滚出视野时最小化，滚回来不会自动还原，
    // 小窗会一直挂在右下角。这里记住播放器在文档中的位置，滚回重叠区就撤销 mini。
    let playerDocTop = 0;
    let playerDocHeight = 0;
    let miniRaf = 0;
    const rememberPlayerTop = () => {
      if (art.mini) return;
      const rect = el?.getBoundingClientRect();
      if (rect && rect.height > 40) {
        playerDocTop = rect.top + window.scrollY;
        playerDocHeight = rect.height;
      }
    };
    const onScrollRestoreMini = () => {
      if (miniRaf) return;
      miniRaf = window.requestAnimationFrame(() => {
        miniRaf = 0;
        if (!art.mini) {
          rememberPlayerTop();
          return;
        }
        const viewTop = window.scrollY;
        const viewBottom = viewTop + window.innerHeight;
        if (playerDocHeight > 0 && viewBottom > playerDocTop + 80 && viewTop < playerDocTop + playerDocHeight) {
          art.mini = false;
        }
      });
    };
    window.addEventListener('scroll', onScrollRestoreMini, { passive: true });
    rememberPlayerTop();

    // —— 观影手势：左半屏上下滑调亮度，右半屏上下滑调音量（与长按倍速共存） ——
    // kind 为 null 表示「候选」：位移未达判定阈值前不生效，避免点按误触
    let gesture: { startX: number; startY: number; kind: GestureKind | null; startVal: number } | null = null;
    let currentBrightness = BRIGHTNESS_DEFAULT;
    // 手势结束后吞掉合成 click，否则会误触 ArtPlayer 的控制栏 toggle
    let swallowClick = false;

    const onTouchStart = (e: TouchEvent) => {
      // 控制栏 / 设置面板上的触摸不触发手势与倍速（按住进度条拖动、长按倍速菜单项会误触）
      const onControls = !!(e.target as HTMLElement).closest?.('.art-controls, .art-settings');
      // 多指（如双指缩放）不是本手势：直接作废候选，避免第二指把值拉跳
      if (e.touches.length !== 1 || onControls || isLongPress || longPressTimer) {
        gesture = null;
      } else {
        const t = e.touches[0];
        gesture = { startX: t.clientX, startY: t.clientY, kind: null, startVal: 0 };
      }
      if (art.video?.paused) return;
      // 已有触控在处理时忽略新手指：否则第二指会把 originalRate 捕获成 3.0，
      // 松手后倍速永久卡在 3x；旧定时器句柄也会被覆盖成无法清除的幽灵触发
      if (isLongPress || longPressTimer) return;
      if (onControls) return;
      originalRate = art.video.playbackRate;
      longPressTimer = setTimeout(() => {
        if (art.video?.paused) return;
        art.video.playbackRate = 3.0;
        isLongPress = true;
        showHint('3 倍速');
      }, 500);
    };
    const onTouchEnd = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (isLongPress) {
        art.video.playbackRate = originalRate;
        isLongPress = false;
        showHint(`${originalRate} 倍速`);
      }
      if (gesture?.kind) {
        swallowClick = true;
        // 兜底：部分场景合成 click 可能不来，超时后自动解除吞点击状态
        setTimeout(() => { swallowClick = false; }, 400);
      }
      gesture = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isLongPress) { e.preventDefault(); return; }
      if (!gesture || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - gesture.startX;
      const dy = t.clientY - gesture.startY;
      if (!gesture.kind) {
        const kind = classifyGesture(dx, dy, gesture.startX, el?.clientWidth || 0);
        if (!kind) return;
        // 手势成立：取消长按倍速定时器（否则滑动中途会突然跳到 3 倍速），
        // 捕获当前值作为起点，并把 startY 重置到判定点——后续位移从 0 起算，不会跳变
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        gesture.kind = kind;
        gesture.startVal = kind === 'volume' ? (art.video?.volume ?? 0.8) : currentBrightness;
        gesture.startY = t.clientY;
        return;
      }
      e.preventDefault();
      const dy2 = t.clientY - gesture.startY;
      const h = el?.clientHeight || 0;
      if (gesture.kind === 'volume') {
        const v = gestureValue(gesture.startVal, dy2, h, VOLUME_MIN, VOLUME_MAX);
        // art.volume setter 会同步 ArtPlayer 自带的音量条 UI
        art.volume = v;
        showHint(`音量 ${Math.round(v * 100)}%`);
      } else {
        const b = gestureValue(gesture.startVal, dy2, h, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
        currentBrightness = b;
        if (art.video) {
          art.video.style.filter = b === BRIGHTNESS_DEFAULT ? '' : `brightness(${b.toFixed(2)})`;
        }
        showHint(`亮度 ${Math.round(b * 100)}%`);
      }
    };
    const onClickCapture = (e: Event) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // ArtPlayer 的 contextmenu 组件只在桌面端初始化（移动端构造函数里跳过 init），
    // 长按倍速因而会连带呼出系统原生菜单/气泡。播放器表面没有可用的原生菜单，统一抑制
    const onContextMenu = (e: Event) => e.preventDefault();
    el?.addEventListener('touchstart', onTouchStart, { passive: false });
    el?.addEventListener('touchend', onTouchEnd);
    el?.addEventListener('touchcancel', onTouchEnd);
    el?.addEventListener('touchmove', onTouchMove, { passive: false });
    el?.addEventListener('click', onClickCapture, true);
    el?.addEventListener('contextmenu', onContextMenu);

    // 卸载与页面隐藏时保存进度
    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') {
        propsRef.current.onPause?.(art.currentTime, art.duration);
      }
    };
    document.addEventListener('visibilitychange', saveOnHide);

    return () => {
      // 卸载前刷一次最终进度，避免丢失最后几秒。
      // 已自然播完的集数不回写，避免覆盖 onEnded 里清除的「已看完」记录
      if (!endedRef.current) {
        try {
          propsRef.current.onPause?.(art.currentTime, art.duration);
        } catch { /* 忽略 */ }
      }
      document.removeEventListener('keydown', shortcuts);
      document.removeEventListener('visibilitychange', saveOnHide);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      el?.removeEventListener('touchstart', onTouchStart);
      el?.removeEventListener('touchend', onTouchEnd);
      el?.removeEventListener('touchcancel', onTouchEnd);
      el?.removeEventListener('touchmove', onTouchMove);
      el?.removeEventListener('click', onClickCapture, true);
      el?.removeEventListener('contextmenu', onContextMenu);
      art.video?.removeEventListener('resize', reportVideoHeight);
      el?.removeEventListener('mousemove', showControlsOnPointerMove);
      el?.removeEventListener('mouseleave', hideControlsOnMouseLeave);
      window.removeEventListener('scroll', onScrollRestoreMini);
      if (miniRaf) window.cancelAnimationFrame(miniRaf);
      if (controlHideTimer) clearTimeout(controlHideTimer);
      restoreCleanupRef.current?.();
      restoreCleanupRef.current = null;
      Artplayer.CONTROL_HIDE_TIME = ART_DEFAULT_CONTROL_HIDE_MS;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      recoveryRef.current?.dispose();
      getVideoPrefetcher().stop();
      releaseLandscapeGuard();
      art.destroy();
      artRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 换集：仅切换 HLS 源，不重建播放器（保留网页全屏等状态） ——
  const firstUrlRef = useRef(true);
  useEffect(() => {
    // 挂载时的首次由创建 effect 的 customType 触发，跳过避免重复加载
    if (firstUrlRef.current) { firstUrlRef.current = false; return; }
    loadEpisode(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // —— 广告过滤开关变化：重建 HLS loader（无需重建整个播放器） ——
  const firstAdFilterRef = useRef(true);
  useEffect(() => {
    if (firstAdFilterRef.current) { firstAdFilterRef.current = false; return; }
    if (artRef.current && hlsRef.current) {
      // 用当前实际媒体地址：代理回退生效时切广告过滤不应跳回直连形式
      loadEpisode(currentMediaUrlRef.current || propsRef.current.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adFilter]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" style={{ WebkitTouchCallout: 'none' }} />
      {showPoster && !error && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{
            backgroundImage: 'url(/player-poster.png)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
          <p className="text-danger text-sm">{error}</p>
          <button className="btn-ghost text-xs" onClick={() => location.reload()}>
            重新加载
          </button>
        </div>
      )}
      {hint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full pointer-events-none animate-fade-in">
          {hint}
        </div>
      )}
      {autoplayNext && !error && (
        <div className="absolute bottom-16 right-3 text-[10px] text-muted bg-black/50 px-2 py-0.5 rounded pointer-events-none">
          自动连播已开启
        </div>
      )}
    </div>
  );
}
