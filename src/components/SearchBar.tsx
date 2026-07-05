"use client";

// Marketplace search input with debounced typeahead suggestions.
// Plain <form action> does NOT get basePath prefixing (that caused searches to
// escape to the WordPress /search page) — navigation goes through the router.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface Suggestion {
  type: "product" | "store";
  label: string;
  sub: string;
  href: string;
}

export function SearchBar({
  variant = "header",
  placeholder = "Search products, brands, batches…",
}: {
  variant?: "header" | "hero";
  placeholder?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      try {
        const res = await fetch(`/marketplace/api/search/suggest?q=${encodeURIComponent(q.trim())}`, {
          signal: ctl.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { suggestions: Suggestion[] };
        setItems(body.suggestions);
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted or offline — keep previous items */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(href?: string) {
    setOpen(false);
    if (href) {
      router.push(href);
    } else if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      go(active >= 0 ? items[active]?.href : undefined);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const isHero = variant === "hero";

  return (
    <div ref={boxRef} className={isHero ? "relative flex max-w-xl gap-2" : "relative hidden md:block"}>
      <div className={isHero ? "relative flex-1" : "relative"}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search marketplace"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={
            isHero
              ? "w-full rounded-xl border border-ink-600 bg-ink-900/80 py-3.5 pl-10 pr-4 text-sm text-mist-100 placeholder:text-mist-400 focus:border-jade-500 focus:outline-none"
              : "w-64 rounded-lg border border-ink-600 bg-ink-800 py-2 pl-9 pr-3 text-sm text-mist-100 placeholder:text-mist-400 focus:border-jade-500 focus:outline-none"
          }
        />
        {open && items.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-2xl shadow-black/50"
          >
            {items.map((s, i) => (
              <li key={`${s.type}-${s.href}`} role="option" aria-selected={i === active}>
                <Link
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                    i === active ? "bg-ink-700 text-mist-100" : "text-mist-200 hover:bg-ink-800"
                  }`}
                >
                  <span className="truncate">{s.label}</span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-mist-400">
                    {s.sub}
                  </span>
                </Link>
              </li>
            ))}
            <li className="border-t border-ink-700">
              <button
                onClick={() => go()}
                className="w-full px-4 py-2.5 text-left text-sm font-semibold text-jade-300 hover:bg-ink-800"
              >
                Search “{q.trim()}” →
              </button>
            </li>
          </ul>
        )}
      </div>
      {isHero && (
        <button
          onClick={() => go()}
          className="rounded-lg bg-jade-500 px-6 py-3 text-base font-semibold text-ink-950 transition-colors hover:bg-jade-400"
        >
          Search
        </button>
      )}
    </div>
  );
}
