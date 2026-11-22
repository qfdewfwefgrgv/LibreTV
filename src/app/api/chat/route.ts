import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEEPSEEK_UPSTREAM = 'https://api.deepseek.com/chat/completions';
const ALIYUN_BASE = (process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
const ALIYUN_UPSTREAM = `${ALIYUN_BASE}/chat/completions`;
const ALIYUN_MODEL = process.env.ALIYUN_CHAT_MODEL || 'qwen-plus';
const DEEPSEEK_MODEL = 'deepseek-chat';

type Provider = 'aliyun' | 'deepseek';

interface Route {
  provider: Provider;
  key: string;
  upstream: string;
  model: string;
}

/** 阿里云百炼优先；未配置时回落到 DeepSeek（服务器 Key 或浏览器临时 Key） */
function pickRoute(req: NextRequest): Route | null {
  const aliyunKey = process.env.ALIYUN_API_KEY || '';
  if (aliyunKey) {
    return { provider: 'aliyun', key: aliyunKey, upstream: ALIYUN_UPSTREAM, model: ALIYUN_MODEL };
  }
  const key = process.env.DEEPSEEK_API_KEY || req.headers.get('x-deepseek-key') || '';
  if (!key) return null;
  return { provider: 'deepseek', key, upstream: DEEPSEEK_UPSTREAM, model: DEEPSEEK_MODEL };
}

/**
 * GET /api/chat —— 告诉前端服务器是否已配置公共 Key、当前使用的模型
 * POST /api/chat —— 代理对话（阿里云百炼通义千问 / DeepSeek），Key 只放在服务器环境变量
 */
export async function GET() {
  const route = pickRoute(new NextRequest('http://localhost/api/chat'));
  return Response.json(
    {
      serverKey: Boolean(process.env.ALIYUN_API_KEY || process.env.DEEPSEEK_API_KEY),
      provider: route?.provider ?? null,
      model: route?.model ?? null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  let body: { messages?: unknown; temperature?: number; max_tokens?: number } | null = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '请求格式错误' }, { status: 400 });
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: '缺少 messages' }, { status: 400 });
  }

  const route = pickRoute(req);
  if (!route) {
    return Response.json({ error: '未配置 API Key' }, { status: 401 });
  }

  const rawTemp = typeof body.temperature === 'number' ? body.temperature : 1.15;
  try {
    const upstream = await fetch(route.upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${route.key}`,
      },
      body: JSON.stringify({
        model: route.model,
        messages: body.messages,
        // 通义千问对高温更敏感，收一点避免胡言乱语
        temperature: route.provider === 'aliyun' ? Math.min(rawTemp, 0.9) : rawTemp,
        max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 320,
        stream: false,
      }),
      cache: 'no-store',
    });

    if (upstream.status === 429) {
      return Response.json({ error: '对话请求太频繁，请稍后再试' }, { status: 429 });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-chat-provider': route.provider,
      },
    });
  } catch {
    return Response.json({ error: '上游请求失败' }, { status: 502 });
  }
}
