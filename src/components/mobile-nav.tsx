'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from './auth';
import { ChangePassword } from './change-password';
import { Drawer } from './drawer';
import { HistoryPanel } from './history-panel';
import { Icon, type IconName } from './icon';
import { requestShowDownloadManager } from './download-manager';
import { SourceManagerDrawer } from './source-manager';

/**
 * 手机底部导航（md 以上隐藏）：
 * 电影 / 短视频 / 音乐 / 直播 / 游戏 / 漫画 / 我的 —— 均分，窄屏也不换行；
 * 「我的」用右侧抽屉承载 登录信息 / 修改密码 / 历史记录 / 下载 / 设置 / 关于。
 */

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: '电影', icon: 'film' },
  { href: '/short', label: '短视频', icon: 'playCircle' },
  { href: '/music', label: '音乐', icon: 'music' },
  { href: '/live', label: '直播', icon: 'live' },
  { href: '/game', label: '游戏', icon: 'playCircle' },
  { href: '/comic', label: '漫画', icon: 'book' },
];

const ROLE_LABEL: Record<string, string> = {
  guest: '访客',
  user: '普通用户',
  admin: '管理员',
  developer: '开发者',
};

export function MobileNav() {
  const pathname = usePathname();
  const [hash, setHash] = useState('');
  const [meOpen, setMeOpen] = useState(false);

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const isDuanju = pathname === '/short' && hash === '#duanju';
  // 播放页是全屏播放器：底栏会压住进度条与全屏按钮，直接不渲染
  const hidden = pathname.startsWith('/watch');

  if (hidden) return null;

  return (
    <>
      <nav
        aria-label="手机底部导航"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-[58px] max-w-lg items-stretch px-1">
          {TABS.map((tab) => {
            const base = tab.href.split('#')[0];
            const active =
              tab.href.endsWith('#duanju')
                ? isDuanju
                : pathname === base && !isDuanju;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors',
                  active ? 'text-accent' : 'text-muted active:bg-hover'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={cn(
                    'absolute top-0 h-0.5 w-7 rounded-full bg-accent transition-opacity',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon name={tab.icon} className="h-[22px] w-[22px]" />
                <span className="text-[11px] leading-none">{tab.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMeOpen(true)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-muted active:bg-hover"
            aria-haspopup="dialog"
            aria-expanded={meOpen}
          >
            <Icon name="user" className="h-[22px] w-[22px]" />
            <span className="text-[11px] leading-none">我的</span>
          </button>
        </div>
      </nav>

      <MeDrawer open={meOpen} onClose={() => setMeOpen(false)} />
    </>
  );
}

function MeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { checked, verified, user, openLogin, logout } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const name = user?.username || '未登录';
  const role = user?.role || 'guest';
  const isGuest = role === 'guest';

  const close = () => {
    onClose();
    setPwdOpen(false);
  };

  return (
    <>
      <Drawer open={open} onClose={close} title="我的" width="max-w-sm">
        {/* 身份卡 */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-3">
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold',
              verified ? 'bg-accent/15 text-accent' : 'bg-chip text-muted'
            )}
          >
            {verified ? name.slice(0, 1).toUpperCase() : '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-content">{checked ? name : '加载中…'}</p>
            <p className="text-[11px] text-faint">
              {verified ? ROLE_LABEL[role] ?? role : '登录后可同步历史记录与下载'}
            </p>
          </div>
          {!verified && (
            <button
              className="btn-primary btn-sm shrink-0"
              onClick={() => {
                close();
                openLogin();
              }}
            >
              登录
            </button>
          )}
        </div>

        {/* 账号 */}
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-card">
          <Row
            icon="user"
            label="登录信息"
            value={verified ? (isGuest ? '访客' : name) : '未登录'}
            detail={verified ? <LoginInfo /> : undefined}
          />
          {verified && !isGuest && (
            <Row icon="edit" label="修改密码" onClick={() => setPwdOpen((v) => !v)} expanded={pwdOpen} expandable />
          )}
        </div>
        {pwdOpen && verified && !isGuest && (
          <div className="mt-2 rounded-xl border border-line bg-surface-raised p-3">
            <ChangePassword onDone={() => setPwdOpen(false)} />
          </div>
        )}

        {/* 功能 */}
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-card">
          <Row
            icon="clock"
            label="历史记录"
            onClick={() => {
              close();
              setHistoryOpen(true);
            }}
          />
          <Row
            icon="download"
            label="下载"
            onClick={() => {
              if (!verified) {
                close();
                openLogin();
                return;
              }
              close();
              requestShowDownloadManager();
            }}
          />
          <Row
            icon="gear"
            label="设置"
            onClick={() => {
              close();
              setSettingsOpen(true);
            }}
          />
          <Row
            icon="alert"
            label="关于"
            href="/about"
            onClick={close}
          />
        </div>

        {verified && (
          <button
            className="mt-3 w-full rounded-xl border border-line px-3 py-2.5 text-sm text-danger transition-colors hover:bg-hover"
            onClick={async () => {
              close();
              await logout();
            }}
          >
            退出登录
          </button>
        )}
      </Drawer>

      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <SourceManagerDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

/** 登录信息详情：账号 / 角色 / 绑定邮箱与手机号 */
function LoginInfo() {
  const { user } = useAuth();
  if (!user) return null;
  const items: { label: string; value: string }[] = [
    { label: '账号', value: user.username },
    { label: '身份', value: ROLE_LABEL[user.role] ?? user.role },
  ];
  if (user.email) items.push({ label: '邮箱', value: user.email });
  if (user.phone) items.push({ label: '手机号', value: user.phone });
  return (
    <dl className="space-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3">
          <dt className="text-[11px] text-faint">{item.label}</dt>
          <dd className="truncate text-[11px] text-muted">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 抽屉里的功能行：可作按钮，也可作链接 */
function Row({
  icon,
  label,
  value,
  href,
  onClick,
  expandable,
  expanded,
  detail,
}: {
  icon: IconName;
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  expandable?: boolean;
  expanded?: boolean;
  detail?: React.ReactNode;
}) {
  const content = (
    <>
      <Icon name={icon} className="h-4 w-4 shrink-0 text-muted" />
      <span className="flex-1 text-left text-sm text-content">{label}</span>
      {value && <span className="max-w-[8rem] truncate text-xs text-faint">{value}</span>}
      {expandable && (
        <Icon
          name="chevronDown"
          className={cn('h-3.5 w-3.5 text-faint transition-transform', expanded && 'rotate-180')}
        />
      )}
    </>
  );

  const bodyClass = 'flex w-full items-center gap-2.5 px-3 py-2.5 text-left';
  return (
    <div className="border-b border-line last:border-b-0">
      {href ? (
        <Link href={href} onClick={onClick} className={cn(bodyClass, 'hover:bg-hover')}>
          {content}
        </Link>
      ) : onClick ? (
        <button onClick={onClick} className={cn(bodyClass, 'hover:bg-hover')}>
          {content}
        </button>
      ) : (
        <div className={bodyClass}>{content}</div>
      )}
      {detail && <div className="px-3 pb-2.5">{detail}</div>}
    </div>
  );
}
