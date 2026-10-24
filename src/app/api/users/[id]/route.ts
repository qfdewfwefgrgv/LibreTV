import { NextResponse } from 'next/server';
import { sessionIdentityFromRequest } from '@/lib/auth';
import { ensureDeveloper, findById, setUserRole } from '@/lib/users';

export const runtime = 'nodejs';

/** PATCH：设置用户角色（developer 可改任意非开发者；admin 可把普通用户设为管理员）。兼容 Cookie 与 Bearer */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = sessionIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  if (identity.role !== 'admin' && identity.role !== 'developer') {
    return NextResponse.json({ success: false, error: '没有管理权限' }, { status: 403 });
  }

  const { id } = await ctx.params;
  let role: 'user' | 'admin' = 'user';
  try {
    const body = (await req.json()) as { role?: string };
    if (body.role === 'admin' || body.role === 'user') role = body.role;
    else return NextResponse.json({ success: false, error: '角色只能是 user 或 admin' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }

  // 会话里的身份可能是旧的（被降级前的角色），以存储中的当前角色为准
  ensureDeveloper();
  const operator = findById(identity.sub) ?? {
    id: identity.sub,
    username: identity.username,
    role: identity.role,
    passwordHash: '',
    salt: '',
    createdAt: 0,
  };

  const result = setUserRole(id, role, operator);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ success: true, user: result.user });
}
