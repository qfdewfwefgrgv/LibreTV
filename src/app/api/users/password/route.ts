import { NextResponse } from 'next/server';
import { sessionIdentityFromRequest } from '@/lib/auth';
import { changeUserPassword } from '@/lib/users';

export const runtime = 'nodejs';

/** PUT：登录用户自助修改密码（需要当前密码校验）。兼容 Cookie 与 Bearer */
export async function PUT(req: Request) {
  const identity = sessionIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
  if (identity.role === 'guest') {
    return NextResponse.json({ success: false, error: '访客登录没有密码，请先注册账号' }, { status: 403 });
  }

  let oldPassword = '';
  let newPassword = '';
  try {
    const body = (await req.json()) as { oldPassword?: string; newPassword?: string };
    oldPassword = String(body.oldPassword ?? '');
    newPassword = String(body.newPassword ?? '');
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }
  if (!oldPassword) return NextResponse.json({ success: false, error: '请输入当前密码' }, { status: 400 });

  const result = changeUserPassword(identity.sub, oldPassword, newPassword);
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
