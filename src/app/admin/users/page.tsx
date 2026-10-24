'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { useAuth } from '@/components/auth';
import { useToast } from '@/components/toast';
import { api } from '@/lib/client-api';
import type { ManagedUser } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = {
  user: '普通用户',
  admin: '管理员',
  developer: '开发者',
};

/** 用户管理：管理员/开发者可把普通用户设为管理员（开发者账号不可被修改） */
export default function AdminUsersPage() {
  const { checked, verified, user, openLogin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = user?.role === 'admin' || user?.role === 'developer';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.listUsers();
      setUsers(r.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (checked && verified && canManage) load();
  }, [checked, verified, canManage, load]);

  const changeRole = async (u: ManagedUser) => {
    const next = u.role === 'admin' ? 'user' : 'admin';
    setBusyId(u.id);
    try {
      await api.setUserRole(u.id, next);
      toast(next === 'admin' ? `已将 ${u.username} 设为管理员` : `已取消 ${u.username} 的管理员`, 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-content">用户管理</h1>
          <p className="mt-1 text-sm text-muted">
            管理员可以把普通用户设为管理员；开发者账号（developer）的角色不可修改。
          </p>
        </div>

        {!checked ? (
          <p className="text-sm text-faint py-10 text-center">正在检查登录状态…</p>
        ) : !verified ? (
          <div className="border border-dashed border-line rounded-xl p-10 text-center">
            <p className="text-sm text-muted mb-3">需要登录后才能访问用户管理</p>
            <button className="btn-primary" onClick={openLogin}>
              去登录
            </button>
          </div>
        ) : !canManage ? (
          <div className="border border-dashed border-line rounded-xl p-10 text-center">
            <p className="text-sm text-muted">当前账号没有管理权限（仅管理员与开发者可访问）</p>
          </div>
        ) : error ? (
          <div className="border border-dashed border-line rounded-xl p-10 text-center">
            <p className="text-sm text-danger mb-3">{error}</p>
            <button className="btn-ghost" onClick={load}>
              重试
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-chip text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">用户名</th>
                  <th className="px-4 py-2.5 font-medium">角色</th>
                  <th className="px-4 py-2.5 font-medium">注册时间</th>
                  <th className="px-4 py-2.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-faint">
                      加载中…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-faint">
                      还没有注册用户
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="px-4 py-2.5 text-content">
                        {u.username}
                        {u.id === user?.sub && <span className="ml-1.5 text-[11px] text-faint">（你）</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'tag',
                            u.role === 'developer'
                              ? 'bg-accent2/15 text-accent2'
                              : u.role === 'admin'
                                ? 'bg-accent/15 text-accent'
                                : 'bg-chip text-muted'
                          )}
                        >
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {u.role === 'developer' ? (
                          <span className="text-xs text-faint">不可修改</span>
                        ) : (
                          <button
                            className="btn-ghost btn-sm"
                            disabled={busyId === u.id || u.id === user?.sub}
                            title={u.id === user?.sub ? '不能修改自己的角色' : undefined}
                            onClick={() => changeRole(u)}
                          >
                            {busyId === u.id ? '处理中…' : u.role === 'admin' ? '取消管理员' : '设为管理员'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
