'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/**
 * 自助修改密码：三个输入（当前密码 / 新密码 / 确认新密码）。
 * 成功后清空表单；访客会话没有密码，调用方应自行隐藏（服务端也会返回 403）。
 */
export function ChangePassword({ onDone }: { onDone?: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      setMsg({ type: 'err', text: '请输入当前密码' });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: 'err', text: '新密码至少 6 位' });
      return;
    }
    if (newPassword !== confirm) {
      setMsg({ type: 'err', text: '两次输入的新密码不一致' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
      setMsg({ type: 'ok', text: '密码已更新，下次登录请使用新密码' });
      onDone?.();
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : '修改失败，请稍后再试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <input
        type="password"
        className="input w-full"
        placeholder="当前密码"
        autoComplete="current-password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
      />
      <input
        type="password"
        className="input w-full"
        placeholder="新密码（至少 6 位）"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <input
        type="password"
        className="input w-full"
        placeholder="确认新密码"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {msg && (
        <p
          className={cn(
            'text-xs',
            msg.type === 'ok' ? 'text-success' : 'text-danger'
          )}
          role={msg.type === 'err' ? 'alert' : undefined}
        >
          {msg.text}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? '提交中…' : '确认修改'}
      </button>
    </form>
  );
}
