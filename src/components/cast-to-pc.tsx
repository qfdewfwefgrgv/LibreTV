'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';

/**
 * 「投屏到电脑」弹窗。
 * 浏览器无法直接把页面投到另一台电脑（DLNA 需要局域网发现，网页没有该能力），
 * 因此这里提供两条真实可用路径：
 * 1) 复制带当前进度的播放链接，在电脑浏览器打开即可接着看（主路径）；
 * 2) 浏览器支持 Remote Playback API（Chrome / Edge 的 Cast）时，可直接选投屏设备。
 */
export function CastToPcDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [link, setLink] = useState('');
  const [canRemote, setCanRemote] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const video = document.querySelector('video');
    const url = new URL(window.location.href);
    // 带上当前播放进度：电脑端打开后从同一位置续播
    if (video && Number.isFinite(video.currentTime) && video.currentTime > 5) {
      url.searchParams.set('position', String(Math.floor(video.currentTime)));
    }
    setLink(url.toString());
    setCopied(false);
    setCanRemote(
      Boolean(video && (video as HTMLVideoElement & { remote?: unknown }).remote)
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast('播放链接已复制，请在电脑浏览器打开', 'success');
    } catch {
      // 非安全上下文 / 权限被拒：退回到手动选中复制
      toast('复制失败，请长按或手动选中下方链接复制', 'warning');
    }
  };

  const castToDevice = async () => {
    const video = document.querySelector('video') as
      | (HTMLVideoElement & { remote?: { prompt: () => Promise<void> } })
      | null;
    const remote = video?.remote;
    if (!remote) {
      toast('当前浏览器不支持设备投屏，请复制链接到电脑打开', 'warning');
      return;
    }
    try {
      await remote.prompt();
      onClose();
    } catch {
      toast('未选择投屏设备', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="投屏到电脑"
        className="relative bg-surface-raised rounded-xl w-full max-w-md shadow-2xl p-5 animate-slide-up border border-line"
      >
        <h2 className="text-base font-semibold text-content mb-1">投屏到电脑</h2>
        <p className="text-xs text-muted leading-relaxed">
          在电脑浏览器打开下面的链接即可继续播放，进度从当前时间接着走（需能访问本站）。
        </p>

        <div className="mt-3 flex items-stretch gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="input h-9 flex-1 min-w-0 text-xs"
            aria-label="电脑端播放链接"
          />
          <button type="button" className="btn-primary btn-sm shrink-0" onClick={() => void copyLink()}>
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-line bg-card px-3 py-2.5">
          <p className="text-[11px] text-faint leading-relaxed">
            电脑与本机在同一网络时，也可以直接把上面的地址输入电脑浏览器；无需登录同一账号。
          </p>
        </div>

        {canRemote && (
          <button type="button" className="btn-ghost btn-sm w-full mt-3" onClick={() => void castToDevice()}>
            选择投屏设备（Cast / 电视）
          </button>
        )}

        <div className="flex justify-end mt-4">
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
