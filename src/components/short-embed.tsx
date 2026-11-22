type Platform = {
  name: string;
  badge: string;
  desc: string;
  href: string;
  brand: string;
  tint: string;
};

function ArrowUpRight() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

/**
 * 这些平台（抖音/快手/B站/红果）会拦截站内 iframe 并强制自家登录/客户端，
 * 嵌在弹层里只会白屏且拖慢页面，所以这里统一用新窗口直开平台网页版。
 */
export function ShortSections({ platforms }: { platforms: Platform[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {platforms.map((p) => (
        <a
          key={p.name}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group card p-4 hover:border-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold"
              style={{ background: p.tint, color: p.brand }}
            >
              {p.name.slice(0, 1)}
            </span>
            <span className="text-faint opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-content">{p.name}</h2>
              <span className="text-[10px] tracking-wide text-faint">{p.badge}</span>
            </div>
            <p className="mt-1 text-xs text-muted leading-relaxed">{p.desc}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
