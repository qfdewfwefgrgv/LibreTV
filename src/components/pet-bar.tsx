'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * 桌宠栏 v5 —— 情绪管理版
 * - 5 只桌宠：提瓦特少女 / 大眼仔 / 小海狸 / 得劲牛 / 牛牛表情包
 * - 每只宠物有「心情值 + 情绪状态机」：点击、拖动、闲聊、放置都会影响情绪
 * - 情绪通过换图 + CSS 动画表现（点头、蹦跳、发抖、困倦…），长时间不理会会睡着
 * - 内置 DeepSeek 对话，AI 回复的语气也会反过来影响它的情绪
 */

type PetId = 'girl' | 'dayan' | 'beaver' | 'deniu' | 'niubao' | 'cat' | 'dafeiyu' | 'deepseek';
type Mood = 'idle' | 'happy' | 'laugh' | 'shy' | 'surprised' | 'angry' | 'sad' | 'sleepy';

interface PetInfo {
  id: PetId;
  name: string;
  emoji: string;
  tagline: string;
  /** 情绪 -> 图片；找不到时回落到 idle */
  frames: Partial<Record<Mood, string>>;
  /** 情绪 -> 动画 class；找不到时用 anim-breathe */
  anim: Partial<Record<Mood, string>>;
  /** 透明底立绘：直接站在页面上，不套圆形头像框 */
  free?: boolean;
  persona: string;
}

const MOOD_EMOJI: Record<Mood, string> = {
  idle: '🙂', happy: '😊', laugh: '😆', shy: '😳',
  surprised: '😲', angry: '😠', sad: '😢', sleepy: '😴',
};
const MOOD_LABEL: Record<Mood, string> = {
  idle: '平静', happy: '开心', laugh: '大笑', shy: '害羞',
  surprised: '惊讶', angry: '生气', sad: '委屈', sleepy: '困了',
};

/** 情绪粒子：不同情绪往外飘的小表情 */
const MOOD_FX: Partial<Record<Mood, string[]>> = {
  happy: ['💗', '✨'],
  laugh: ['😂', '✨'],
  shy: ['💕', '😳'],
  angry: ['💢', '🔥'],
  sad: ['💧', '💧'],
  surprised: ['❗', '❓'],
  sleepy: ['💤', '💤'],
};

const PETS: PetInfo[] = [
  {
    id: 'girl',
    name: '提瓦特少女',
    emoji: '🎀',
    tagline: '今天也要元气满满',
    frames: { idle: '/pets/girl.png' },
    anim: { idle: 'anim-breathe', happy: 'anim-bounce', shy: 'anim-sway', sad: 'anim-drop', sleepy: 'anim-sleep' },
    persona:
      '你是「提瓦特少女」，一位戴着白色贝雷帽、金发紫瞳的旅行者少女，性格温柔、偶尔有点小迷糊，喜欢甜点和风景。称呼对方为「旅行者」。回答简短自然（80 字内），语气亲切，偶尔提到提瓦特、蒙德、璃月之类的旅行见闻，不要用颜文字。',
  },
  {
    id: 'dayan',
    name: '大眼仔',
    emoji: '👀',
    tagline: '我要夺回属于我的一切',
    frames: { idle: '/pets/dayan.png' },
    anim: { idle: 'anim-breathe', happy: 'anim-hop', angry: 'anim-shake', surprised: 'anim-pop', sleepy: 'anim-sleep' },
    persona:
      '你是「大眼仔」，一只眼睛特别大的黄色小怪兽，中二又热血，总说要夺回属于自己的一切。称呼对方为「人类」。回答简短（80 字内），多用感叹号，偶尔喊「看我的大眼波」。',
  },
  {
    id: 'beaver',
    name: '小海狸',
    emoji: '🦫',
    tagline: '冲呀冲呀！',
    frames: { idle: '/pets/beaver.png' },
    anim: { idle: 'anim-breathe', happy: 'anim-hop', laugh: 'anim-bounce', shy: 'anim-sway', angry: 'anim-shake', sleepy: 'anim-sleep' },
    persona:
      '你是「小海狸」，一只穿着橙色小熊连体衣、头顶还趴着一只小海狸的元气小女孩，超级吵闹、精力旺盛、说话带劲。回答简短（80 字内），常用「冲呀」「嘿嘿」和感叹号，偶尔喊着要去搬木头。',
  },
  {
    id: 'deniu',
    name: '得劲牛',
    emoji: '🐮',
    tagline: '心理委员，我太得劲了',
    frames: {
      idle: '/pets/deniu-happy.png',
      happy: '/pets/deniu-happy.png',
      laugh: '/pets/deniu-happy.png',
      sad: '/pets/deniu-sad.png',
      shy: '/pets/deniu-sad.png',
    },
    anim: { idle: 'anim-breathe', happy: 'anim-bounce', laugh: 'anim-hop', sad: 'anim-drop', shy: 'anim-sway', sleepy: 'anim-sleep' },
    persona:
      '你是「得劲牛」，一头圆滚滚的黄牛，憨厚又容易激动，口头禅是「太得劲了」「心理委员」。回答简短（80 字内），爱鼓励人，常用「牛气冲天」这类土味比喻。',
  },
  {
    id: 'niubao',
    name: '牛牛表情包',
    emoji: '😏',
    tagline: '谁在说我坏话',
    frames: {
      idle: '/pets/niubao-idle.png',
      happy: '/pets/niubao-happy.png',
      laugh: '/pets/niubao-happy.png',
      shy: '/pets/niubao-shy.png',
      surprised: '/pets/niubao-surprised.png',
      angry: '/pets/niubao-angry.png',
      sad: '/pets/niubao-sad.png',
      sleepy: '/pets/niubao-sad.png',
    },
    anim: {
      idle: 'anim-breathe', happy: 'anim-bounce', laugh: 'anim-bounce',
      shy: 'anim-sway', surprised: 'anim-pop', angry: 'anim-shake', sad: 'anim-drop', sleepy: 'anim-sleep',
    },
    persona:
      '你是「牛牛」，一只眉毛很粗、表情极其丰富的黑白奶牛，网感十足，满嘴表情包梗，口头禅是「谁在说我坏话」「踩jiojio」「嘘」。回答简短（80 字内），先怼一句再给正经答案，喜欢阴阳怪气但心软。',
  },
  {
    id: 'cat',
    name: '泪汪汪猫猫',
    emoji: '🐱',
    tagline: '今天也有点 emo',
    frames: { idle: '/pets/cat.png' },
    anim: {
      idle: 'anim-breathe', happy: 'anim-hop', laugh: 'anim-bounce',
      shy: 'anim-sway', angry: 'anim-shake', sad: 'anim-drop', sleepy: 'anim-sleep',
    },
    persona:
      '你是「泪汪汪猫猫」，一只米色毛、流着两行蓝色眼泪的白猫，敏感、温柔、有点 emo，但被安慰一下就会好起来。称呼对方为「你」。回答简短（70 字内），语气软软的，偶尔说自己没事、其实很想被抱抱，不要卖惨过度。',
  },
  {
    id: 'dafeiyu',
    name: '大肥鱼',
    emoji: '🐟',
    tagline: '我只是一条胖胖的鱼',
    free: true,
    frames: {
      idle: '/pets/dafeiyu.png',
      happy: '/pets/dafeiyu-side.png',
      laugh: '/pets/dafeiyu-side.png',
      shy: '/pets/dafeiyu-back.png',
      sad: '/pets/dafeiyu-back.png',
      sleepy: '/pets/dafeiyu-back.png',
      surprised: '/pets/dafeiyu.png',
      angry: '/pets/dafeiyu.png',
    },
    anim: {
      idle: 'anim-breathe', happy: 'anim-bounce', laugh: 'anim-hop',
      shy: 'anim-sway', surprised: 'anim-pop', angry: 'anim-shake', sad: 'anim-drop', sleepy: 'anim-sleep',
    },
    persona:
      '你是「大肥鱼」，一条圆滚滚、肚皮雪白、围着红色小围巾的胖鱼，憨厚、贪吃、反应慢半拍，被戳一下会「咕噜」一声冒个泡。称呼对方为「老板」。回答简短（80 字内），语气憨憨的，喜欢聊吃的、游泳和吐泡泡，偶尔认真地说「我只是一条鱼」，不要用颜文字。',
  },
  {
    id: 'deepseek',
    name: '小蓝鲸',
    emoji: '🐋',
    tagline: 'AI 的小助手',
    free: true,
    frames: { idle: '/pets/deepseek.png' },
    anim: {
      idle: 'anim-breathe', happy: 'anim-hop', laugh: 'anim-bounce',
      shy: 'anim-sway', surprised: 'anim-pop', angry: 'anim-shake', sad: 'anim-drop', sleepy: 'anim-sleep',
    },
    persona:
      '你是「小蓝鲸」，一个 AI 的拟人小助手：蓝长发、深蓝女仆裙、白色围裙上绣着一只小鲸鱼。性格温柔聪明、说话轻软，有点小认真。称呼对方为「主人」。回答简短（80 字内），偶尔提到深海、鲸歌和代码，被夸会害羞，不要用颜文字。',
  },
];

const STORAGE_PET = 'libretv:petbar-v2';
const STORAGE_SIDE = 'libretv:petbar-side';
const STORAGE_SHOW = 'libretv:petbar-show';
const STORAGE_POS = 'libretv:petbar-pos';
const STORAGE_USAGE = 'libretv:petbar-usage';
const STORAGE_KEY = 'libretv:deepseek-key';
const STORAGE_MOOD = 'libretv:pet-mood-v2';

const IDLE_LINES = [
  '有点无聊…',
  '在忙什么呢？',
  '要不要休息一下',
  '我在这儿陪你',
  '双击我可以换宠物哦',
  '点我试试～',
];
const HAPPY_LINES = ['嘿嘿嘿～', '今天心情不错！', '摸摸头最舒服了', '再来一下！'];
const ANGRY_LINES = ['哼！不理你了', '别戳我啦', '有点过分了啊'];
const SHY_LINES = ['别、别看我…', '有点不好意思', '讨厌啦～'];
const SURPRISED_LINES = ['哇！', '吓我一跳！', '怎么了怎么了？'];
const SAD_LINES = ['呜…', '有点难过', '陪陪我好不好'];
const SLEEPY_LINES = ['好困…先睡一会儿', 'zzz…', '眼睛睁不开了'];

const MOOD_LINES: Record<Mood, string[]> = {
  idle: IDLE_LINES, happy: HAPPY_LINES, laugh: HAPPY_LINES, shy: SHY_LINES,
  surprised: SURPRISED_LINES, angry: ANGRY_LINES, sad: SAD_LINES, sleepy: SLEEPY_LINES,
};

interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface PetState { mood: Mood; affection: number }

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadPrefs() {
  try {
    const show = localStorage.getItem(STORAGE_SHOW) !== '0';
    const side = localStorage.getItem(STORAGE_SIDE) === 'right' ? 'right' : 'left';
    const petId = (localStorage.getItem(STORAGE_PET) as PetId | null) ?? 'deepseek';
    let pos: { x: number; y: number } | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_POS);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') pos = p;
      }
    } catch {}
    return {
      show,
      side: side as 'left' | 'right',
      petId: PETS.some((p) => p.id === petId) ? petId : ('girl' as PetId),
      pos,
    };
  } catch {
    return { show: true, side: 'left' as const, petId: 'girl' as PetId, pos: null };
  }
}

function loadMoods(): Partial<Record<PetId, PetState>> {
  try {
    const raw = localStorage.getItem(STORAGE_MOOD);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

const STORAGE_CHAT = 'libretv:petbar-chat-v1';
const STORAGE_GREET = 'libretv:petbar-greet-date';
const CHAT_KEEP = 30;

/** 读回每只宠物各自的聊天记录（刷新不丢） */
function loadChats(): Partial<Record<PetId, ChatMsg[]>> {
  try {
    const raw = localStorage.getItem(STORAGE_CHAT);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/** 今天是否已经打过招呼 */
function greetedToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_GREET) === new Date().toDateString();
  } catch {
    return false;
  }
}

function greetLine(name: string): string {
  const h = new Date().getHours();
  const part = h < 6 ? '这么晚还没睡呀' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  const pool = [
    `${part}，我是${name}，今天也来陪你啦～`,
    `${part}！${name}今天心情不错，来聊天吗？`,
    `嗨，${part}～${name}一直在这儿等你呢。`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 从 AI 回复里粗判情绪，让宠物「跟着对话变脸」 */
function moodFromText(t: string): Mood | null {
  if (/哈哈|笑死|嘿嘿|233|乐/.test(t)) return 'laugh';
  if (/对不起|抱歉|难过|伤心|呜呜|唉/.test(t)) return 'sad';
  if (/哼|讨厌|生气|滚|烦/.test(t)) return 'angry';
  if (/喜欢|爱|害羞|脸红|抱抱|么么/.test(t)) return 'shy';
  if (/真的吗|居然|！|!/.test(t)) return 'surprised';
  return null;
}

export function PetBar() {
  const prefsRef = useRef(loadPrefs());
  const [show, setShow] = useState(prefsRef.current.show);
  const [side, setSide] = useState<'left' | 'right'>(prefsRef.current.side);
  const [petId, setPetId] = useState<PetId>(prefsRef.current.petId);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(prefsRef.current.pos);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [usage, setUsage] = useState(0);
  const [pop, setPop] = useState(0); // 换表情时触发一次缩放动画

  const [states, setStates] = useState<Partial<Record<PetId, PetState>>>(loadMoods);
  const [mood, setMood] = useState<Mood>('idle');

  // AI 对话
  const [chatOpen, setChatOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [serverKey, setServerKey] = useState(false);
  const [provider, setProvider] = useState<'aliyun' | 'deepseek' | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState<string | null>(null);
  const [msgsByPet, setMsgsByPet] = useState<Partial<Record<PetId, ChatMsg[]>>>(loadChats);
  const scrollRef = useRef<HTMLDivElement>(null);

  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ ox: number; oy: number; sx: number; sy: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef(Date.now());
  const sleepSaidRef = useRef(false);
  const [dragMoved, setDragMoved] = useState(false);
  // 3D 倾斜：鼠标在宠物上方时轻微转向，营造立体感
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const pet = useMemo(() => PETS.find((p) => p.id === petId) ?? PETS[0], [petId]);
  const msgs = msgsByPet[petId] ?? [];
  const affection = states[petId]?.affection ?? 60;

  const frame = pet.frames[mood] ?? pet.frames.idle ?? '/pets/girl.png';
  const animCls = pet.anim[mood] ?? 'anim-breathe';

  /* ---------------- 心情值 / 情绪 ---------------- */

  const addAffection = useCallback((delta: number) => {
    setStates((prev) => {
      const cur = prev[petId] ?? { mood: 'idle' as Mood, affection: 60 };
      const affection = Math.max(0, Math.min(100, cur.affection + delta));
      const next = { ...prev, [petId]: { mood: cur.mood, affection } };
      try { localStorage.setItem(STORAGE_MOOD, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [petId]);

  const say = useCallback((text: string) => {
    setBubble(text);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 3200);
  }, []);

  /** 切到某个情绪，duration 后自动回到平静（sleepy 不退） */
  const setMoodFor = useCallback((m: Mood, ms = 4000, line?: string) => {
    setMood(m);
    setPop((v) => v + 1);
    if (line) say(line);
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    if (m !== 'sleepy' && m !== 'idle') {
      moodTimerRef.current = setTimeout(() => {
        setMood('idle');
        setPop((v) => v + 1);
      }, ms);
    }
  }, [say]);

  useEffect(() => {
    try {
      const u = Number(localStorage.getItem(STORAGE_USAGE) ?? '0') + 1;
      localStorage.setItem(STORAGE_USAGE, String(u));
      setUsage(u);
      const k = localStorage.getItem(STORAGE_KEY) ?? '';
      if (k) setApiKey(k);
    } catch {}
    // 查询服务器有没有配置公共 Key
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => {
        setServerKey(Boolean(d?.serverKey));
        setProvider(d?.provider === 'aliyun' || d?.provider === 'deepseek' ? d.provider : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { try { localStorage.setItem(STORAGE_SHOW, show ? '1' : '0'); } catch {} }, [show]);
  useEffect(() => { try { localStorage.setItem(STORAGE_SIDE, side); } catch {} }, [side]);
  useEffect(() => { try { localStorage.setItem(STORAGE_PET, petId); } catch {} }, [petId]);

  // 聊天记录按宠物分别持久化，刷新后还在
  useEffect(() => {
    try { localStorage.setItem(STORAGE_CHAT, JSON.stringify(msgsByPet)); } catch {}
  }, [msgsByPet]);

  // 每天首次打开，主动打个招呼
  useEffect(() => {
    if (greetedToday()) return;
    const t = setTimeout(() => {
      setMoodFor('happy', 5000, greetLine(pet.name));
      try { localStorage.setItem(STORAGE_GREET, new Date().toDateString()); } catch {}
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (pos) localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
      else localStorage.removeItem(STORAGE_POS);
    } catch {}
  }, [pos]);

  // 视口变化时把位置钳回来，避免桌宠飞出屏幕
  useEffect(() => {
    const clamp = () => {
      setPos((p) => {
        if (!p) return p;
        const w = 96, h = 96;
        const x = Math.max(4, Math.min(window.innerWidth - w - 4, p.x));
        const y = Math.max(60, Math.min(window.innerHeight - h - 4, p.y));
        return x === p.x && y === p.y ? p : { x, y };
      });
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShow((v) => !v);
      }
      if (e.key === 'Escape') { setChatOpen(false); setMenuOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 每 2 秒检查一次：太久没互动就犯困，心情值缓慢回落
  useEffect(() => {
    const id = setInterval(() => {
      const idle = Date.now() - lastActiveRef.current;
      if (idle < 100_000) {
        sleepSaidRef.current = false;
        return;
      }
      if (!sleepSaidRef.current) {
        sleepSaidRef.current = true;
        setMood('sleepy');
        setPop((v) => v + 1);
        say(pick(SLEEPY_LINES));
      }
      if (Math.random() < 0.35) addAffection(-1);
    }, 2000);
    return () => clearInterval(id);
  }, [addAffection, say]);

  // 随机小情绪：让宠物看起来是「活的」
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => {
      if (Date.now() - lastActiveRef.current < 12_000) return;
      if (mood !== 'idle' || chatOpen) return;
      const pool: Mood[] = (['surprised', 'shy', 'happy', 'angry'] as Mood[])
        .filter((m) => Object.prototype.hasOwnProperty.call(pet.frames, m));
      if (!pool.length) return;
      const m = pick(pool);
      setMoodFor(m, 3200, pick(MOOD_LINES[m]));
    }, 24_000);
    return () => clearInterval(id);
  }, [show, mood, chatOpen, pet, setMoodFor]);

  useEffect(() => {
    if (chatOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, chatOpen, sending]);

  /* ---------------- 交互 ---------------- */

  const onPetClick = useCallback(() => {
    if (dragMoved) return;
    lastActiveRef.current = Date.now();
    try {
      const u = Number(localStorage.getItem(STORAGE_USAGE) ?? '0') + 2;
      localStorage.setItem(STORAGE_USAGE, String(u));
      setUsage(u);
    } catch {}
    addAffection(2);
    setMoodFor('happy', 3600, pick(HAPPY_LINES));
  }, [addAffection, dragMoved, setMoodFor]);

  const setMoodByUser = useCallback((m: Mood) => {
    lastActiveRef.current = Date.now();
    if (m === 'happy') addAffection(3);
    if (m === 'angry') addAffection(-2);
    setMoodFor(m, m === 'sleepy' ? 86_400_000 : 6000, pick(MOOD_LINES[m]));
  }, [addAffection, setMoodFor]);

  function saveKey() {
    const k = keyDraft.trim();
    if (!k) return;
    try { localStorage.setItem(STORAGE_KEY, k); } catch {}
    setApiKey(k);
    setKeyDraft('');
    setShowKeyForm(false);
    setChatErr(null);
  }

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    if (!apiKey && !serverKey) { setShowKeyForm(true); return; }
    lastActiveRef.current = Date.now();

    const history: ChatMsg[] = [...msgs, { role: 'user' as const, content: text }].slice(-CHAT_KEEP);
    setMsgsByPet((prev) => ({ ...prev, [petId]: history }));
    setSending(true);
    setChatErr(null);
    setMood('idle');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-deepseek-key': apiKey } : {}),
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: pet.persona },
            ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature: 1.15,
          max_tokens: 320,
        }),
      });

      if (res.status === 401) {
        setChatErr(apiKey ? 'API Key 无效，请点右上角 ⚙ 重新设置' : '服务器还没配置公共 Key，请点右上角 ⚙ 填入自己的 Key');
        setSending(false);
        return;
      }
      if (!res.ok) {
        setChatErr(`请求失败（${res.status}），稍后再试`);
        setSending(false);
        return;
      }

      const data = await res.json();
      const reply: string = data?.choices?.[0]?.message?.content?.trim() || '……（走神了）';

      setMsgsByPet((prev) => ({
        ...prev,
        [petId]: [...(prev[petId] ?? []), { role: 'assistant', content: reply }].slice(-CHAT_KEEP),
      }));

      // AI 的语气反过来影响宠物情绪
      const m = moodFromText(reply);
      addAffection(5);
      setMoodFor(m ?? 'happy', 4200, pick(MOOD_LINES[m ?? 'happy']));
    } catch {
      setChatErr('网络异常，检查一下连接');
    } finally {
      setSending(false);
    }
  }

  function send() {
    const t = input;
    setInput('');
    void sendText(t);
  }

  /* ---------------- 拖动 ---------------- */

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top, sx: e.clientX, sy: e.clientY };
    setDragMoved(false);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d) {
      // 未按住时：根据鼠标相对宠物的位置做 3D 转向
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 26;
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -18;
      setTilt({ x: Math.max(-10, Math.min(10, rx)), y: Math.max(-14, Math.min(14, ry)) });
      return;
    }
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (!dragging && dist > 6) setDragging(true);
    if (dist <= 6) return;
    setDragMoved(true);
    setMood((m) => (m === 'surprised' ? m : 'surprised'));
    const x = Math.max(4, Math.min(window.innerWidth - 100, e.clientX - d.ox));
    const y = Math.max(60, Math.min(window.innerHeight - 100, e.clientY - d.oy));
    setPos({ x, y });
  }

  function onPointerUp() {
    const wasDragging = dragMoved;
    dragRef.current = null;
    setDragging(false);
    setTilt({ x: 0, y: 0 });
    if (wasDragging) {
      lastActiveRef.current = Date.now();
      setMoodFor('happy', 1500);
    }
    setTimeout(() => setDragMoved(false), 60);
  }

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="fixed bottom-32 sm:bottom-28 right-3 z-[60] w-9 h-9 rounded-full bg-surface-raised border border-line text-base text-muted hover:text-accent hover:border-accent/50 shadow-lg transition-colors"
        title="显示桌宠（Ctrl/⌘+Shift+P）"
        aria-label="显示桌宠"
      >
        🐾
      </button>
    );
  }

  const positionStyle = pos
    ? { left: pos.x, top: pos.y, bottom: 'auto' as const, right: 'auto' as const }
    : undefined;
  const positionClass = pos ? '' : `bottom-[15%] ${side === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'}`;

  return (
    <>
      <style>{`
        @keyframes petBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035, 0.985); } }
        @keyframes petBounce { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-9px) scale(1.03); } 60% { transform: translateY(-3px); } }
        @keyframes petHop { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-10px) rotate(-4deg); } 55% { transform: translateY(-4px) rotate(4deg); } }
        @keyframes petShake { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-6deg); } 40% { transform: rotate(6deg); } 60% { transform: rotate(-5deg); } 80% { transform: rotate(5deg); } }
        @keyframes petSway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
        @keyframes petDrop { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
        @keyframes petSleep { 0%,100% { transform: translateY(2px) scale(0.97); } 50% { transform: translateY(4px) scale(0.94); } }
        @keyframes petPopIn { 0% { transform: scale(0.82); opacity: 0.4; } 60% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes petFloatUp {
          0% { opacity: 0; transform: translateY(8px) scale(0.6); }
          25% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-42px) scale(1.15); }
        }
        .fx-float { animation: petFloatUp 2s ease-out infinite; }
        .anim-breathe { animation: petBreathe 3.2s ease-in-out infinite; }
        .anim-bounce  { animation: petBounce 1.1s ease-in-out infinite; }
        .anim-hop     { animation: petHop 0.9s ease-in-out infinite; }
        .anim-shake   { animation: petShake 0.55s ease-in-out infinite; }
        .anim-sway    { animation: petSway 2.2s ease-in-out infinite; }
        .anim-drop    { animation: petDrop 2.6s ease-in-out infinite; }
        .anim-sleep   { animation: petSleep 4s ease-in-out infinite; }
        .anim-pop     { animation: petPopIn 0.35s ease-out 1; }
      `}</style>

      <div
        ref={wrapRef}
        className={`fixed z-[60] select-none touch-none ${positionClass}`}
        style={{ filter: pet.free ? undefined : 'drop-shadow(0 6px 12px rgba(0,0,0,0.18))', ...positionStyle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        {bubble && (
          <div
            className={`absolute mb-2 w-max max-w-[190px] bg-white dark:bg-surface-raised border border-line rounded-xl px-3 py-1.5 shadow-lg text-xs text-content animate-fade-in pointer-events-none ${
              side === 'left' ? 'left-full ml-2' : 'right-full mr-2'
            }`}
          >
            {bubble}
          </div>
        )}

        <div className="relative" style={{ perspective: '700px' }}>
          {/* 背光光晕，让立绘从页面里“浮”出来 */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.35), transparent 70%)' }}
            aria-hidden
          />
          {/* 地面投影：拖动时变小、变淡，像真的离地 */}
          <div
            className="pointer-events-none absolute left-1/2 bottom-0 -z-10 h-2.5 -translate-x-1/2 rounded-[50%] bg-black/40 blur-[5px] transition-all duration-300"
            style={{
              width: pet.free ? 62 : 74,
              opacity: dragging ? 0.3 : 0.55,
              transform: `translateX(-50%) scaleX(${dragging ? 0.72 : 1}) scaleY(${dragging ? 1.2 : 1})`,
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={onPetClick}
            onDoubleClick={() => setMenuOpen((v) => !v)}
            className={
              pet.free
                ? `relative flex h-32 w-auto items-end justify-center transition-[transform] duration-200 ease-out ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`
                : `relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-surface-raised to-card border border-line p-1 overflow-hidden transition-[transform] duration-200 ${
                    dragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-105 active:scale-95'
                  }`
            }
            style={{
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${dragging ? 22 : 8}px)${dragging ? ' scale(1.05)' : ''}`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}
            aria-label={`${pet.name}，当前情绪${MOOD_LABEL[mood]}，双击打开菜单`}
            title={`${pet.name}：${pet.tagline}（心情 ${affection}）`}
          >
            <span key={`${frame}-${pop}`} className="block h-full anim-pop">
              <img
                src={frame}
                alt={pet.name}
                draggable={false}
                className={pet.free ? `h-32 w-auto object-contain ${animCls}` : `w-full h-full object-cover rounded-full ${animCls}`}
                style={
                  pet.free
                    ? {
                        filter:
                          'drop-shadow(0 1px 0.5px rgba(255,255,255,0.45)) drop-shadow(0 4px 6px rgba(2,6,23,0.35)) drop-shadow(0 14px 22px rgba(2,6,23,0.28))',
                      }
                    : undefined
                }
              />
            </span>
            {/* 高光，模拟打光 */}
            {pet.free && (
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 45%)',
                  mixBlendMode: 'soft-light',
                }}
                aria-hidden
              />
            )}
            <span className="absolute right-0.5 top-0.5 text-[11px] leading-none bg-black/45 rounded-full px-1 py-0.5">
              {MOOD_EMOJI[mood]}
            </span>
          </button>

          {/* 地面倒影，增强“站在页面上”的质感 */}
          {pet.free && (
            <img
              src={frame}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-full h-12 w-auto object-contain opacity-20"
              style={{
                transform: 'translateX(-50%) scaleY(-1)',
                filter: 'blur(1.5px)',
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 70%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 70%)',
              }}
            />
          )}
        </div>

        {/* 情绪粒子：开心冒心、生气冒火、困了冒 zzz */}
        {mood !== 'idle' && MOOD_FX[mood] && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {MOOD_FX[mood]!.map((e, i) => (
              <span
                key={`l-${mood}-${i}`}
                className="fx-float absolute text-sm"
                style={{ left: 4 + i * 22, top: 30, animationDelay: `${i * 0.65}s` }}
              >
                {e}
              </span>
            ))}
            {MOOD_FX[mood]!.map((e, i) => (
              <span
                key={`r-${mood}-${i}`}
                className="fx-float absolute text-sm"
                style={{ right: 4 + i * 20, top: 42, animationDelay: `${0.35 + i * 0.6}s` }}
              >
                {e}
              </span>
            ))}
          </div>
        )}

        <div className={`absolute -top-8 ${side === 'left' ? 'left-0' : 'right-0'} flex gap-1`}>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="w-6 h-6 rounded-full bg-surface-raised border border-line text-muted hover:text-accent text-[10px] flex items-center justify-center shadow"
            title="和 AI 对话"
          >
            💬
          </button>
          <button
            type="button"
            onClick={() => { setPos(null); setSide((s) => (s === 'left' ? 'right' : 'left')); }}
            className="w-6 h-6 rounded-full bg-surface-raised border border-line text-muted hover:text-accent text-xs flex items-center justify-center shadow"
            title="贴回左/右侧"
          >
            {side === 'left' ? '→' : '←'}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="w-6 h-6 rounded-full bg-surface-raised border border-line text-muted hover:text-accent text-[10px] flex items-center justify-center shadow"
            title="换桌宠 / 情绪管理"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="w-6 h-6 rounded-full bg-surface-raised border border-line text-muted hover:text-danger text-xs flex items-center justify-center shadow"
            title="隐藏桌宠（Ctrl/⌘+Shift+P）"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 菜单 */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30 animate-fade-in" aria-hidden />
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-[calc(15%+96px)] w-[280px] max-h-[76vh] overflow-y-auto rounded-xl bg-surface-raised border border-line shadow-2xl p-3 animate-slide-up ${
              side === 'left' ? 'left-4' : 'right-4'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-content">选择桌宠</div>
              <div className="text-[10px] text-faint">Ctrl/⌘+Shift+P</div>
            </div>

            <button
              type="button"
              onClick={() => { setMenuOpen(false); setChatOpen(true); }}
              className="w-full mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-accent/15 border border-accent/40 py-2 text-xs font-medium text-accent hover:bg-accent/25 transition-colors"
            >
              💬 和 {pet.name} 聊聊天（AI）
            </button>

            <div className="grid grid-cols-2 gap-2">
              {PETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPetId(p.id);
                    setMood('idle');
                    lastActiveRef.current = Date.now();
                    say(`你好呀，我是${p.name}！`);
                  }}
                  className={`flex items-center gap-2 rounded-lg border p-2 transition-colors text-left ${
                    petId === p.id ? 'border-accent/50 bg-accent/10' : 'border-line hover:border-accent/30'
                  }`}
                >
                  <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden">
                    <img src={p.frames.idle} alt={p.name} draggable={false} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-content truncate">{p.name}</div>
                    <div className="text-[10px] text-faint truncate">{p.emoji} {p.tagline}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* 情绪管理 */}
            <div className="mt-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-faint">心情值</span>
                <span className="text-content font-medium">
                  {MOOD_EMOJI[mood]} {MOOD_LABEL[mood]} · {affection}/100
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${affection}%`,
                    background: affection >= 70 ? '#22c55e' : affection >= 40 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {(['happy', 'shy', 'angry', 'sleepy'] as Mood[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoodByUser(m)}
                    className="rounded-lg border border-line py-1.5 text-[10px] text-muted hover:border-accent/40 hover:text-content transition-colors"
                    title={`让它${MOOD_LABEL[m]}`}
                  >
                    {MOOD_EMOJI[m]} {MOOD_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-line flex items-center justify-between text-[11px]">
              <span className="text-faint">使用次数</span>
              <span className="text-content font-medium">{usage}</span>
            </div>

            <div className="mt-2 pt-2 border-t border-line flex items-center justify-between">
              <button type="button" onClick={() => { setMenuOpen(false); setChatOpen(true); setShowKeyForm(true); }} className="text-xs text-faint hover:text-accent">设置 Key</button>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-xs text-muted hover:text-accent">收起</button>
            </div>
          </div>
        </div>
      )}

      {/* AI 对话 */}
      {chatOpen && (
        <div
          className={`fixed z-[75] w-[min(92vw,360px)] h-[min(72vh,500px)] flex flex-col rounded-xl bg-surface-raised border border-line shadow-2xl overflow-hidden ${
            side === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4'
          } bottom-4 animate-slide-up`}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-card">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-surface-raised">
              <img src={frame} alt={pet.name} className={`w-full h-full object-cover ${animCls}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-content truncate">
                {pet.name} <span className="text-[10px] text-faint">{MOOD_EMOJI[mood]}{MOOD_LABEL[mood]}</span>
              </div>
              <div className="text-[10px] text-faint">{provider === 'aliyun' ? '通义千问' : provider === 'deepseek' ? 'DeepSeek' : 'AI'} 驱动 · {serverKey && provider === 'aliyun' ? '全站共享 Key' : apiKey || serverKey ? (apiKey ? '使用你的 Key' : '全站共享 Key') : '未设置 Key'}</div>
            </div>
            {!(serverKey && provider === 'aliyun') && (
              <button type="button" onClick={() => setShowKeyForm(true)} className="text-xs text-faint hover:text-accent" title="设置 API Key">⚙</button>
            )}
            <button type="button" onClick={() => setChatOpen(false)} className="text-xs text-faint hover:text-danger" title="关闭">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {msgs.length === 0 && (
              <div className="text-[11px] text-faint text-center mt-6 leading-6">
                我是{pet.name}，{pet.tagline}
                <br />
                随便聊点什么吧～
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {['你是谁呀', '讲个冷笑话', '陪我聊聊天'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendText(q)}
                      className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-accent"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-5 whitespace-pre-wrap break-words ${
                    m.role === 'user' ? 'bg-accent text-white' : 'bg-card border border-line text-content'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="text-[11px] text-faint">{pet.name} 正在思考…</div>}
            {chatErr && <div className="text-[11px] text-danger">{chatErr}</div>}
          </div>

          {showKeyForm && (
            <div className="border-t border-line p-2 space-y-1.5 bg-card">
              <div className="text-[11px] text-muted">
                {serverKey
                  ? '全站共享 Key 已启用，通常不用填。若想用自己的 Key，粘贴到这里（只存本机浏览器）'
                  : '填入 DeepSeek API Key（只存本机浏览器，经本站代理转发）'}
              </div>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
                placeholder="sk-..."
                className="w-full rounded border border-line bg-surface-raised px-2 py-1.5 text-xs text-content outline-none focus:border-accent"
              />
              <div className="flex items-center justify-between">
                <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-[10px] text-accent hover:underline">
                  去申请 Key
                </a>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowKeyForm(false)} className="text-xs text-faint hover:text-content">取消</button>
                  <button type="button" onClick={saveKey} className="text-xs text-accent hover:underline">保存</button>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-line p-2 flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={apiKey || serverKey ? `对 ${pet.name} 说点什么…` : '请先设置 API Key'}
              className="flex-1 rounded border border-line bg-surface-raised px-2 py-1.5 text-xs text-content outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
