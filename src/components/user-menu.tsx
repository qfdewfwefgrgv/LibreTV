'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = {
  guest: '访客',
  user: '普通用户',
  admin: '管理员',
  developer: '开发者',
};

/** 顶栏用户入口：显示当前身份，管理员/开发者可进入用户管理 */
export function UserMenu() {
  const { verified, user, openLogin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!verified) {
    return (
      <button
        onClick={openLogin}
        className="px-2.5 py-1.5 rounded-md text-sm text-accent hover:bg-hover transition-colors"
      >
        登录
      </button>
    );
  }

  const name = user?.username || '访客';
  const role = user?.role || 'guest';
  const isManager = role === 'admin' || role === 'developer';

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-hover transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`当前身份：${ROLE_LABEL[role] ?? role}`}
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
            role === 'developer'
              ? 'bg-accent2/15 text-accent2'
              : role === 'admin'
                ? 'bg-accent/15 text-accent'
                : 'bg-chip text-muted'
          )}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline max-w-[6rem] truncate text-sm text-content">{name}</span>
        <Icon name="chevronDown" className={cn('w-3 h-3 text-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-line bg-surface shadow-xl p-2 z-50 animate-fade-in"
        >
          <div className="px-2 py-1.5 mb-1 border-b border-line">
            <p className="text-sm text-content truncate">{name}</p>
            <p className="text-[11px] text-faint">{ROLE_LABEL[role] ?? role}</p>
          </div>
          {isManager && (
            <Link
              href="/admin/users"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-2 py-1.5 rounded-md text-sm text-muted hover:text-accent hover:bg-hover"
            >
              用户管理
            </Link>
          )}
          <button
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
            }}
            className="w-full text-left px-2 py-1.5 rounded-md text-sm text-muted hover:text-danger hover:bg-hover"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
