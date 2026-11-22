'use client';

import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls, { type HlsConfig } from 'hls.js';
import { Spinner } from './states';
import { prefersTouchPointer } from '@/lib/touch-pointer';
import { createLandscapeGuard } from '@/lib/force-landscape';
import { ART_DEFAULT_CONTROL_HIDE_MS, TOUCH_CONTROL_HIDE_MS } from '@/lib/control-hide';

/**
 * 直播播放器：与点播 player-shell 完全独立。
 * - 引擎分发：.m3u8 → hls.js（直播参数）；.flv → mpegts.js（动态加载，按需 ~150KB）；
 *   mp4/webm 等原生容器 → <video> 直接播放；
 * - 无扩展名的地址（如 /channel/xxx?token=...）默认按 HLS 处理，
 *   HLS 直连与代理均失败后**回退原生播放**一次（覆盖"内容是 MP4 却无 .m3u8 后缀"的源）；
 * - 每级直连失败自动切换到 /api/live/stream 代理通道重试一次；
 * - 直播态 UI：无进度条、无倍速、无截图、无连播。
 */

/** 代理地址前缀（新旧形式 /api/live/stream/… 与 /api/live/stream?url=… 的共同前缀，用于防二次代理） */
const STREAM_PROXY_PREFIX = '/api/live/stream';
/** 代理地址（查询串形式：路径里的 %2F 会被 EdgeOne 等网关归一化，查询串不受影响） */
const STREAM_PROXY_BASE = '/api/live/stream?url=';

export function isFlvUrl(url: string): boolean {
  return /\.flv(\?|$)/i.test(url);
}

/** 浏览器原生可播的直链容器（非 HLS/FLV） */
const NATIVE_MEDIA_RE = /\.(mp4|m4v|webm|ogv|ogg|mov)(\?|$)/i;

type Engine = 'hls' | 'flv' | 'native';

function engineOf(url: string): Engine {
  if (isFlvUrl(url)) return 'flv';
  if (NATIVE_MEDIA_RE.test(url)) return 'native';
  return 'hls';
}

function proxyUrl(url: string): string {
  return STREAM_PROXY_BASE + encodeURIComponent(url);
}

interface LivePlayerProps {
  /** 上游直播流地址（直连优先，失败自动走代理） */
  url: string;
  title: string;
  /** 回放模式：显示进度条/倍速，不使用直播追帧参数 */
  isReplay?: boolean;
  /** 上一台/下一台：传入时注册为播放器控制条按钮（全屏内也可操作） */
  onPrevChannel?: () => void;
  onNextChannel?: () => void;
}

export function LivePlayer({
  url,
  title,
  isReplay = false,
  onPrevChannel,
  onNextChannel,
}: LivePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mpegtsRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(true);
  // 缓冲不足/网络抖动导致的等待提示（video waiting 事件触发）
  const [buffering, setBuffering] = useState(false);
  // 手动重试计数：变化时重建整个播放器实例（比 location.reload() 轻得多）
  const [retryNonce, setRetryNonce] = useState(0);
  // 起播前的品牌占位图（与点播 player-shell 共用 /player-poster.png），实际开始播放后隐藏
  const [showPoster, setShowPoster] = useState(true);
  // 换台 OSD：切台后短暂显示频道名（键盘换台/控制条换台时的视觉反馈，全屏内同样可见）
  const [osdTitle, setOsdTitle] = useState('');
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // url 变化即换台：显示频道名 2.5s
  useEffect(() => {
    if (!url) return;
    setOsdTitle(title);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => setOsdTitle(''), 2500);
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, [url, title]);

  const channelCbRef = useRef<{ prev?: () => void; next?: () => void }>({});
  channelCbRef.current = { prev: onPrevChannel, next: onNextChannel };

  const showHint = (text: string) => {
    setHint(text);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHint(''), 2500);
  };

  useEffect(() => {
    if (!containerRef.current || !url) return;
    setError('');
    setLoading(true);
    setShowPoster(true);

    let playbackStarted = false;
    let disposed = false;
    let destroyed = false;
    /** 原生播放注册的 error 监听清理函数（切台/销毁时调用） */
    let nativeCleanup: (() => void) | null = null;
    /** video waiting/playing 监听清理（统一覆盖所有引擎：HLS/FLV/Native） */
    let videoBufferingCleanup: (() => void) | null = null;

    /** 给 video 元素挂 waiting/playing 监听，统一驱动 buffering 状态。cleanupEngines 负责清理 */
    const setupVideoBufferingListener = (video: HTMLVideoElement) => {
      if (videoBufferingCleanup) return; // 已有，不重复挂
      const onWaiting = () => setBuffering(true);
      const onPlaying = () => setBuffering(false);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);
      videoBufferingCleanup = () => {
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
      };
    };

    const cleanupEngines = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (mpegtsRef.current) {
        try { mpegtsRef.current.pause(); } catch { /* 忽略 */ }
        try { mpegtsRef.current.destroy(); } catch { /* 忽略 */ }
        mpegtsRef.current = null;
      }
      if (nativeCleanup) {
        try { nativeCleanup(); } catch { /* 忽略 */ }
        nativeCleanup = null;
      }
      if (videoBufferingCleanup) {
        try { videoBufferingCleanup(); } catch { /* 忽略 */ }
        videoBufferingCleanup = null;
      }
      setBuffering(false);
    };

    /**
     * 原生播放：mp4/webm 等容器交给 <video> 直接播放。
     * 也作为 HLS 两级都失败后的兜底——覆盖"地址没有 .m3u8 后缀但内容其实是 MP4"的源。
     * 直连失败（CORS/混合内容）时再走一次代理。
     */
    const setupNative = (
      video: HTMLVideoElement,
      mediaUrl: string,
      allowProxyFallback: boolean,
      failMessage?: string
    ) => {
      cleanupEngines();
      const onError = () => {
        video.removeEventListener('error', onError);
        nativeCleanup = null;
        if (disposed || destroyed) return;
        if (allowProxyFallback && !mediaUrl.startsWith(STREAM_PROXY_PREFIX)) {
          showHint('直连失败，改用代理重试...');
          setupNative(video, proxyUrl(url), false, failMessage);
          return;
        }
        setError(failMessage || '该地址不是可播放的直播流（内容可能是文件或错误提示）');
      };
      video.addEventListener('error', onError);
      nativeCleanup = () => video.removeEventListener('error', onError);
      setupVideoBufferingListener(video);
      video.src = mediaUrl;
      video.load();
      video.play().catch(() => {
        // 浏览器自动播放策略拦截带声起播：回退静音起播（直播惯例），用户自行点开声音
        try { (artRef.current as unknown as { muted?: boolean }).muted = true; } catch { video.muted = true; }
        video.play().catch(() => {});
      });
    };

    /** HLS 直播参数：
     * - 加大缓冲（maxBufferLength 60s / maxMaxBufferLength 120s）—— 覆盖常见网络抖动；
     * - 监听 frag 加载耗时做码率自适应（慢了自动降级到最低可用码率）；
     * - 非致命 frag 错误静默重试 + 累积，超过阈值主动降级；
     * - video waiting/playing 事件 → buffering 状态 → UI 显示"缓冲中..."overlay。
     */
    const setupHls = (video: HTMLVideoElement, mediaUrl: string, stage: 'direct' | 'proxy') => {
      cleanupEngines();
      let liveNetRetryCount = 0;
      let mediaRecoverCount = 0;
      let slowFragCount = 0;
      let currentAutoLevel = -1;
      let fragStartTs = 0;
      const hlsConfig: Partial<HlsConfig> = {
        debug: false,
        enableWorker: true,
        // 回放：按点播处理，不追直播边缘、允许更大缓冲
        ...(isReplay
          ? { backBufferLength: 60, maxBufferLength: 45, maxMaxBufferLength: 90 }
          : {
              liveSyncDurationCount: 3,
              lowLatencyMode: false,
              backBufferLength: 30,
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
            }),
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 600,
        abrEwmaDefaultEstimate: 2000000,
        abrEwmaFastLive: 5,
        abrEwmaSlowLive: 10,
      };
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.loadSource(mediaUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, manifestData) => {
        // H.265 检测：大量国内 IPTV 源为 HEVC 编码，Chromium 内核通常无法软解
        const videoCodecs = (manifestData.levels || []).map((l) => l.videoCodec || '').join(',');
        if (/hvc1|hev1|hevc/i.test(videoCodecs)) {
          const support = video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"');
          if (!support) {
            showHint('该频道为 H.265 编码，当前浏览器可能无法解码，建议用 Edge/Safari');
          }
        }
        // 多码率 manifest：启用 abr 自适应（hls.js 默认启用，但显式设置更安全）
        if ((manifestData.levels?.length ?? 0) > 1) {
          hls.currentLevel = -1; // AUTO
        }
        video.play().catch(() => {
        // 浏览器自动播放策略拦截带声起播：回退静音起播（直播惯例），用户自行点开声音
        try { (artRef.current as unknown as { muted?: boolean }).muted = true; } catch { video.muted = true; }
        video.play().catch(() => {});
      });
      });

      hls.on(Hls.Events.FRAG_LOADING, () => { fragStartTs = performance.now(); });
      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (!isReplay && fragStartTs) {
          const elapsed = performance.now() - fragStartTs;
          // 分片时长通常 4s-10s，加载超过 1.5s 说明网络在变慢
          if (elapsed > 1500) slowFragCount++;
          else slowFragCount = Math.max(0, slowFragCount - 1);
          // 连续 3 个慢分片 → 强制降级到最低码率（避免等卡死再动）
          if (slowFragCount >= 3 && currentAutoLevel !== hls.levels.length - 1) {
            currentAutoLevel = hls.levels.length - 1;
            hls.currentLevel = currentAutoLevel;
            showHint('网络较慢，已自动切换到低码率');
            slowFragCount = 0;
          }
        }
      });

      // 统一的 video waiting/playing 监听（由各引擎共享）
      setupVideoBufferingListener(video);

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (disposed || destroyed) return;
        const httpCode = data.response?.code;
        const codeHint = httpCode ? `（HTTP ${httpCode}）` : '';
        if (!data.fatal) return;
        // 媒体错误：起播前后统一尝试恢复，次数受限防止无限 recover 循环
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRecoverCount < 2) {
            mediaRecoverCount++;
            hls.recoverMediaError();
            return;
          }
          setError('直播流解码失败，可能该频道编码不受当前浏览器支持，请尝试其他频道');
          return;
        }
        if (!playbackStarted) {
          if (
            stage === 'direct' &&
            !mediaUrl.startsWith(STREAM_PROXY_PREFIX) &&
            (data.details === 'manifestLoadError' || data.type === Hls.ErrorTypes.NETWORK_ERROR)
          ) {
            showHint('直连失败，改用代理重试...');
            // 直播 manifest 重写需要本站前缀，交给代理通道
            setupHls(video, proxyUrl(url), 'proxy');
            return;
          }
          // HLS 直连与代理均失败：可能是"无 .m3u8 后缀但内容是 MP4"的源，回退原生播放
          showHint('HLS 解析失败，尝试原生播放...');
          setupNative(video, url, true, `直播流加载失败${codeHint}，可能该频道已失效，请尝试其他频道`);
          return;
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // 播放中网络抖动：尝试恢复拉流；连续失败达到阈值则报错退出
          liveNetRetryCount++;
          if (liveNetRetryCount > 5) {
            setError(`直播流中断${codeHint}，该源可能已失效，请尝试其他频道`);
            return;
          }
          hls.startLoad();
        }
      });
    };

    const setupFlv = async (
      video: HTMLVideoElement,
      mediaUrl: string,
      allowProxyFallback: boolean
    ) => {
      cleanupEngines();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let Mpegts: any;
      try {
        Mpegts = (await import('mpegts.js')).default;
      } catch {
        setError('FLV 播放模块加载失败，请检查网络后重试');
        return;
      }
      if (disposed || destroyed) return;
      if (!Mpegts.getFeatureList().mseLivePlayback) {
        setError('当前浏览器不支持 FLV 直播播放');
        return;
      }
      const player = Mpegts.createPlayer(
        {
          type: 'flv',
          isLive: true,
          url: mediaUrl,
        },
        {
          enableWorker: false,
          enableStashBuffer: false,
          stashInitialSize: 128,
          liveBufferLatencyChasing: true,
          lazyLoad: false,
        }
      );
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      setupVideoBufferingListener(video);
      player.load();
      player.on(Mpegts.Events.ERROR, (errType: string) => {
        if (disposed || destroyed) return;
        if (!playbackStarted && allowProxyFallback && !mediaUrl.startsWith(STREAM_PROXY_PREFIX)) {
          showHint('直连失败，改用代理重试...');
          void setupFlv(video, proxyUrl(url), false);
          return;
        }
        setError(`直播流加载失败（${errType}），请尝试其他频道`);
      });
      player.play().catch(() => {});
    };

    const engine = engineOf(url);
    // 上一台/下一台：注册到播放器控制条（普通态与全屏均可见），未传不显示
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls: any[] = [];
    const channelBtnSvg = (path: string) =>
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="${path}"/></svg>`;
    if (onPrevChannel) {
      controls.push({
        name: 'prev-channel',
        position: 'left',
        index: 0,
        html: channelBtnSvg('M11 19l-7-7 7-7m8 14l-7-7 7-7'),
        tooltip: '上一台',
        click: () => channelCbRef.current.prev?.(),
      });
    }
    if (onNextChannel) {
      controls.push({
        name: 'next-channel',
        position: 'left',
        index: 1,
        html: channelBtnSvg('M13 5l7 7-7 7M5 5l7 7-7 7'),
        tooltip: '下一台',
        click: () => channelCbRef.current.next?.(),
      });
    }
    // 触屏没有 hover，原生 3 秒自动隐藏会让直播控制栏（上一台/下一台）点不到
    // （issue #937）：触屏常驻、由点按视频 toggle 收起；桌面行为不变
    const touchPointer = prefersTouchPointer();
    if (touchPointer) Artplayer.CONTROL_HIDE_TIME = TOUCH_CONTROL_HIDE_MS;

    const art = new Artplayer({
      container: containerRef.current,
      url,
      // 原生容器统一用 'mp4'（仅用于选择处理函数，实际容器由浏览器嗅探）
      type: engine === 'flv' ? 'flv' : engine === 'native' ? 'mp4' : 'm3u8',
      volume: 0.9,
      autoplay: true,
      // —— 直播态：关闭点播专属能力 ——
      pip: true,
      screenshot: false,
      setting: false,
      playbackRate: isReplay,
      aspectRatio: false,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: false,
      hotkey: false,
      mutex: true,
      backdrop: true,
      playsInline: true,
      airplay: true,
      theme: '#2563eb',
      controls,
      lang: navigator.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en',
      moreVideoAttr: { playsInline: true },
      customType: {
        m3u8: (video: HTMLVideoElement) => {
          setupHls(video, url, 'direct');
        },
        flv: (video: HTMLVideoElement) => {
          void setupFlv(video, url, true);
        },
        mp4: (video: HTMLVideoElement) => {
          setupNative(video, url, true);
        },
      },
    });
    artRef.current = art;
    // 全屏（原生全屏 / 网页全屏）时：手机与平板强制横屏，桌面不处理
    const releaseLandscapeGuard = createLandscapeGuard(
      () => (art as unknown as { template?: { $player?: HTMLElement } }).template?.$player ?? null
    );
    art.on('video:loadedmetadata', () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (art as any).title = title;
      } catch { /* 忽略 */ }
    });
    art.on('video:playing', () => {
      playbackStarted = true;
      setLoading(false);
      setShowPoster(false);
      setError('');
    });
    art.on('video:error', () => {
      // mpegts 走自身 ERROR 事件；这里兜底其它未知错误
      if (!mpegtsRef.current) setError('视频播放失败，请尝试其他频道');
    });
    art.on('ready', () => {
      // 直播隐藏进度条（ArtPlayer 无原生 isLive 开关）；回放保留进度条
      if (isReplay) return;
      try {
        const progress = art.controls?.progress as HTMLElement | undefined;
        if (progress) progress.style.display = 'none';
      } catch { /* 忽略 */ }
    });

    // 15s 内未起播则提示
    const startTimer = setTimeout(() => {
      if (!playbackStarted && !disposed && !destroyed) {
        setError('频道加载超时，可能该源已失效，请尝试其他频道');
      }
    }, 30000);

    return () => {
      disposed = true;
      clearTimeout(startTimer);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      cleanupEngines();
      releaseLandscapeGuard();
      art.destroy();
      artRef.current = null;
      // CONTROL_HIDE_TIME 是全局 static：恢复库默认值，避免影响后续挂载的其它播放器
      if (touchPointer) Artplayer.CONTROL_HIDE_TIME = ART_DEFAULT_CONTROL_HIDE_MS;
      destroyed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, retryNonce, isReplay]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* 起播前的品牌占位图 */}
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
      {/* 直播/回放标识 */}
      {!error && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full pointer-events-none">
          {isReplay ? (
            <span className="text-[10px] font-semibold text-accent tracking-wider">回放</span>
          ) : (
            <>
              <span className="live-dot" />
              <span className="text-[10px] font-semibold text-white tracking-wider">LIVE</span>
            </>
          )}
        </div>
      )}
      {/* 换台 OSD：频道名（全屏内同样可见） */}
      {osdTitle && !error && (
        <div className="absolute top-3 left-3 flex items-center max-w-[70%] bg-black/60 px-3 py-1.5 rounded-full pointer-events-none animate-fade-in">
          <span className="text-sm font-medium text-white truncate">{osdTitle}</span>
        </div>
      )}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Spinner size="lg" tone="onDark" />
        </div>
      )}
      {/* 播放中缓冲耗尽提示：不遮画面，仅显示小 Spinner + 文字 */}
      {buffering && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm">
            <Spinner size="sm" tone="onDark" />
            <span className="text-xs text-white/90">缓冲中…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
          <p className="text-danger text-sm px-4 text-center">{error}</p>
          <button
            className="btn-ghost text-xs !bg-white/10 !text-white !border-white/20"
            onClick={() => {
              // 重建播放器实例即可，无需整页刷新
              setError('');
              setHint('');
              setRetryNonce((n) => n + 1);
            }}
          >
            重新加载
          </button>
        </div>
      )}
      {hint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full pointer-events-none animate-fade-in">
          {hint}
        </div>
      )}
    </div>
  );
}
