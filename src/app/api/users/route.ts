import { NextResponse } from 'next/server';
import { sessionIdentityFromRequest } from '@/lib/auth';
import { listUsers } from '@/lib/users';

export const runtime = 'nodejs';

/** GET：用户列表（仅管理员/开发者可见）。兼容 Cookie 与 Authorization: Bearer */
export async function GET(req: Request) {
  const identity = sessionIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'developer') {
    return NextResponse.json({ success: false, error: '没有管理权限' }, { status: 403 });
  }
  const users = listUsers();
  // 返回存储里的最新角色，避免会话里残留被撤销前的管理员身份
  const me = users.find((u) => u.id === identity.sub) ?? null;
  return NextResponse.json({ success: true, users, me: me ?? identity });
}
