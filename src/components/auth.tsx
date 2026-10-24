'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onUnauthorized, STATUS_QUERY_KEY } from '@/lib/client-api';
import { applyEnvPresets } from '@/lib/subscription-sync';
import type { AuthStatusResponse, SessionUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from './toast';

/**
 * 认证上下文：
 * - 页面加载时查询 /api/status 判断会话有效性；
 * - 任何 API 返回 401/503 时全局打开登录框（客户端 API 层统一触发，不再散落检查）。
 */

type SetupRequired = boolean;

interface AuthContextValue {
  checked: boolean;
  verified: boolean;
  /** 服务器未设置 PASSWORD，需要管理员配置 */
  setupRequired: SetupRequired;
  /** 当前会话身份（访客 / 普通用户 / 管理员 / 开发者） */
  user: SessionUser | null;
  /** /api/status 返回的应用版本（构建时从 package.json 注入） */
  version: string | null;
  openLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  checked: false,
  verified: false,
  setupRequired: false,
  user: null,
  version: null,
  openLogin: () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<AuthStatusResponse['authCapabilities']>();
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 与 Providers 共用同一 query key 与缓存，避免 /api/status 被请求两次
  useEffect(() => {
    let cancelled = false;
    queryClient
      .fetchQuery({ queryKey: STATUS_QUERY_KEY, queryFn: () => api.status() })
      .then((s) => {
        if (cancelled) return;
        setVerified(s.verified);
        setSetupRequired(!s.passwordRequired);
        setVersion(s.version);
        setCapabilities(s.authCapabilities);
        setChecked(true);
        // 已登录时补拉身份（旧 cookie 会是访客身份）
        if (s.verified) {
          api
            .me()
            .then((r) => {
              if (!cancelled) setUser(r.user);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(
    () =>
      onUnauthorized((event) => {
        const setup = (event as CustomEvent).detail === 'setup';
        setSetupRequired(setup);
        setVerified(false);
        setModalOpen(true);
      }),
    []
  );

  const openLogin = useCallback(() => setModalOpen(true), []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setVerified(false);
      setUser(null);
      toast('已退出登录', 'info');
    }
  }, [toast]);

  const handleLoginSuccess = useCallback(
    async (identity: SessionUser | null) => {
      setVerified(true);
      setUser(identity);
      setSetupRequired(false);
      setModalOpen(false);
      // 登录前以 401 失败的查询（如豆瓣推荐）需要重新拉取
      queryClient.invalidateQueries();
      toast('验证成功', 'success');
      // 预置订阅（DEFAULT_SUBSCRIPTIONS）的首屏同步发生在登录之前，会 401 静默失败，
      // 这里用缓存中的 /api/status 补跑一次（缓存缺失时回落为一次请求）
      try {
        const cached = queryClient.getQueryData<AuthStatusResponse>(STATUS_QUERY_KEY);
        const status =
          cached ??
          (await queryClient.fetchQuery<AuthStatusResponse>({
            queryKey: STATUS_QUERY_KEY,
            queryFn: () => api.status(),
            staleTime: 0,
          }));
        if (status) await applyEnvPresets(status);
      } catch {
        // 补拉预置数据失败不影响登录后的正常使用
      }
    },
    [toast, queryClient]
  );

  return (
    <AuthContext.Provider value={{ checked, verified, setupRequired, user, version, openLogin, logout }}>
      {children}
      {modalOpen && (
        <LoginModal
          setupRequired={setupRequired}
          capabilities={capabilities}
          onSuccess={handleLoginSuccess}
          onClose={() => setModalOpen(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

type LoginTab = 'code' | 'password' | 'register' | 'guest';
type ContactChannel = 'email' | 'sms';

const TABS: { key: LoginTab; label: string }[] = [
  { key: 'guest', label: '访客登录' },
  { key: 'code', label: '验证码登录' },
  { key: 'password', label: '密码登录' },
  { key: 'register', label: '注册' },
];

function LoginModal({
  setupRequired,
  capabilities,
  onSuccess,
  onClose,
}: {
  setupRequired: boolean;
  capabilities?: AuthStatusResponse['authCapabilities'];
  onSuccess: (user: SessionUser | null) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<LoginTab>('guest');
  const [channel, setChannel] = useState<ContactChannel>('email');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  /** 验证码发送后是否处于「开发模式」（未配置真实通道，验证码已打印到服务端日志） */
  const [devMode, setDevMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reloadCaptcha = useCallback(async () => {
    try {
      const c = await api.captcha();
      setCaptchaId(c.id);
      setCaptchaImage(c.image);
      setCaptchaInput('');
    } catch {
      setCaptchaImage('');
    }
  }, []);

  useEffect(() => {
    reloadCaptcha();
  }, [reloadCaptcha]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [tab, channel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 发送验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const captchaMissing = () => {
    if (!captchaInput.trim()) {
      setError('请输入右侧图片验证码');
      return true;
    }
    if (!captchaId) {
      setError('验证码已失效，请点击图片刷新');
      return true;
    }
    return false;
  };

  const sendCode = async () => {
    if (sending || countdown > 0) return;
    setError('');
    if (captchaMissing()) return;
    if (!target.trim()) {
      setError(channel === 'email' ? '请输入邮箱地址' : '请输入手机号');
      return;
    }
    setSending(true);
    try {
      const r = await api.sendCode(channel, target.trim(), captchaId, captchaInput);
      setDevMode(Boolean(r.devMode));
      if (r.devMode) {
        toast(`验证码已生成，请查看服务端终端日志输出`, 'info');
      } else {
        toast(`验证码已发送至 ${target.trim()}，5 分钟内有效`, 'success');
      }
      setCountdown(60);
      await reloadCaptcha();
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败');
      reloadCaptcha();
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    if (loading) return;
    setError('');
    // 访客登录只校验口令，不需要图形验证码
    if (tab !== 'guest' && captchaMissing()) return;

    if (tab === 'code') {
      if (!target.trim()) return setError(channel === 'email' ? '请输入邮箱地址' : '请输入手机号');
      if (!/^\d{6}$/.test(code.trim())) return setError('请输入 6 位数字验证码');
    }
    if (tab === 'password' || tab === 'register') {
      if (!username.trim()) return setError('请输入用户名');
    }
    if ((tab === 'password' || tab === 'register' || tab === 'guest') && !password) {
      return setError('请输入密码');
    }
    if (tab === 'register' && password !== confirm) return setError('两次输入的密码不一致');

    setLoading(true);
    try {
      if (tab === 'code') {
        const r = await api.loginByCode(channel, target.trim(), code.trim(), captchaId, captchaInput);
        onSuccess(r.user ?? null);
        return;
      }
      if (tab === 'guest') {
        const r = await api.login(password);
        onSuccess(r.user ?? { sub: 'guest', username: '访客', role: 'guest' });
        return;
      }
      if (tab === 'password') {
        const r = await api.loginAccount(username.trim(), password, captchaId, captchaInput);
        onSuccess(r.user ?? null);
        return;
      }
      const r = await api.register(
        username.trim(),
        password,
        captchaId,
        captchaInput,
        email.trim() ? { email: email.trim() } : undefined
      );
      onSuccess(r.user ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      setError(msg === '需要登录' ? '密码错误' : msg);
      setPassword('');
      setConfirm('');
      setCode('');
      reloadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const deviceLogin = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const r = await api.loginByDevice();
      toast('本机免密登录成功', 'success');
      onSuccess(r.user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '本机登录失败');
    } finally {
      setLoading(false);
    }
  };

  const oauthNotice = (label: '微信' | 'QQ') => {
    const enabled = label === '微信' ? capabilities?.wechat : capabilities?.qq;
    if (enabled) {
      toast(`${label}登录已配置凭据，接入流程将在下一版本开放`, 'info');
      return;
    }
    const keys = label === '微信' ? 'WECHAT_APP_ID / WECHAT_APP_SECRET' : 'QQ_APP_ID / QQ_APP_KEY';
    toast(`${label}登录未开通：需配置 ${keys}，且开放平台回调域名需已备案`, 'info');
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 animate-fade-in px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-surface-raised rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={setupRequired ? '需要配置密码' : '登录 / 注册'}
      >
        {setupRequired ? (
          <>
            <h2 className="text-lg font-semibold text-content mb-3">需要配置密码</h2>
            <p className="text-sm text-muted leading-relaxed">
              为确保安全，必须设置 <code className="text-accent">PASSWORD</code> 环境变量才能使用本服务。
              请联系管理员在部署配置中添加该变量后重启服务。
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-content">登录 / 注册</h2>
                <p className="text-xs text-muted mt-1">访客输入 libretv 即可进入，也可使用账号或本机免密</p>
              </div>
              <button
                className="p-1.5 rounded-full text-muted hover:text-content hover:bg-hover"
                onClick={onClose}
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex rounded-lg bg-chip p-0.5 mb-4">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setError('');
                  }}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-sm transition-colors',
                    tab === t.key ? 'bg-surface text-accent font-medium shadow-sm' : 'text-muted hover:text-content'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="space-y-3"
            >
              {tab === 'code' && (
                <>
                  <div className="flex rounded-lg bg-chip p-0.5">
                    {(['email', 'sms'] as ContactChannel[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setChannel(c);
                          setTarget('');
                          setError('');
                          setDevMode(false);
                        }}
                        className={cn(
                          'flex-1 rounded-md py-1 text-xs transition-colors',
                          channel === c
                            ? 'bg-surface text-accent font-medium shadow-sm'
                            : 'text-muted hover:text-content'
                        )}
                      >
                        {c === 'email' ? '邮箱验证码' : '手机验证码'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type={channel === 'email' ? 'email' : 'tel'}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="input flex-1"
                      placeholder={channel === 'email' ? 'name@example.com' : '11 位手机号'}
                      autoComplete={channel === 'email' ? 'email' : 'tel'}
                    />
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={sending || countdown > 0}
                      className="btn-ghost btn-sm shrink-0 whitespace-nowrap min-w-[104px]"
                    >
                      {sending ? '发送中…' : countdown > 0 ? `${countdown} 秒后重发` : '获取验证码'}
                    </button>
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="input w-full tracking-[0.4em] text-center"
                    placeholder="6 位验证码"
                    autoComplete="one-time-code"
                  />
                  {!(channel === 'email' ? capabilities?.email : capabilities?.sms) && (
                    <p className="text-xs text-faint">
                      {channel === 'email'
                        ? '未配置邮件服务，验证码已打印到服务端终端日志（配置 SMTP_* 后自动改为真实发送）。'
                        : '未配置短信服务，验证码已打印到服务端终端日志（配置 TENCENT_SMS_* 后自动改为真实发送）。'}
                    </p>
                  )}
                  {devMode && (
                    <p className="text-xs text-accent">
                      验证码已生成，请查看服务端终端输出的 [OTP] 日志，5 分钟内有效。
                    </p>
                  )}
                </>
              )}

              {(tab === 'password' || tab === 'register') && (
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input w-full"
                  placeholder="用户名"
                  autoComplete="username"
                />
              )}

              {tab === 'register' && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full"
                  placeholder="邮箱（选填，用于找回账号）"
                  autoComplete="email"
                />
              )}

              {(tab === 'password' || tab === 'register') && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full"
                  placeholder="密码"
                  autoComplete={tab === 'password' ? 'current-password' : 'new-password'}
                />
              )}
              {tab === 'register' && (
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input w-full"
                  placeholder="确认密码"
                  autoComplete="new-password"
                />
              )}

              {tab === 'guest' && (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input w-full"
                    placeholder="访客口令（默认 libretv）"
                    autoComplete="off"
                  />
                  <p className="text-xs text-faint">输入 libretv 即可进入，无需注册。</p>
                </>
              )}

              {/* 图形验证码：仅验证码/密码/注册登录需要 */}
              {tab !== 'guest' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  className="input flex-1 uppercase"
                  placeholder="图片验证码"
                  maxLength={4}
                  autoComplete="off"
                />
                {captchaImage ? (
                  <button
                    type="button"
                    onClick={reloadCaptcha}
                    title="点击刷新验证码"
                    className="shrink-0 rounded-md overflow-hidden ring-1 ring-line hover:ring-accent/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={captchaImage} alt="验证码，点击刷新" width={120} height={44} className="block h-11 w-[120px]" />
                  </button>
                ) : (
                  <button type="button" onClick={reloadCaptcha} className="btn-ghost btn-sm shrink-0">
                    获取验证码图片
                  </button>
                )}
              </div>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? '处理中…' : tab === 'register' ? '注册并登录' : '登录'}
              </button>
            </form>

            <div className="flex items-center gap-2 my-4">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] text-faint">其他方式</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={deviceLogin}
                disabled={loading}
                className="btn-ghost w-full !border-accent/40 !text-accent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 3h6a2 2 0 012 2v14a2 2 0 01-2 2H9a2 2 0 01-2-2V5a2 2 0 012-2z"
                  />
                  <path strokeLinecap="round" strokeWidth={1.8} d="M11 18h2" />
                </svg>
                本机一键登录
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => oauthNotice('微信')} className="btn-ghost w-full">
                  微信登录
                </button>
                <button type="button" onClick={() => oauthNotice('QQ')} className="btn-ghost w-full">
                  QQ 登录
                </button>
                <button type="button" onClick={() => oauthNotice('微信')} className="btn-ghost w-full">
                  微信扫码登录
                </button>
                <button type="button" onClick={() => oauthNotice('QQ')} className="btn-ghost w-full">
                  QQ 扫码登录
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <span className="text-[11px] text-faint">登录即表示同意仅用于本站访问</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
