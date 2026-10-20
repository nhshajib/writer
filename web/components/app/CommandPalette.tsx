"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { formatRelative, useDashboard } from "@/lib/dashboard";
import { STATE_LABEL, stateOf } from "@/lib/types";

interface Item {
  key: string;
  group: "Go to" | "Sessions";
  label: string;
  hint?: string;
  href: string;
  icon: () => React.JSX.Element;
}

const PAGES: Omit<Item, "group">[] = [
  { key: "new", label: "New session", hint: "Start entering text", href: "/app/new", icon: Icon.plus },
  { key: "home", label: "Home", href: "/app", icon: Icon.home },
  { key: "sessions", label: "Sessions", href: "/app/sessions", icon: Icon.list },
  { key: "documents", label: "Documents", href: "/app/documents", icon: Icon.doc },
  { key: "billing", label: "Plan & usage", href: "/app/billing", icon: Icon.card },
  { key: "settings", label: "Settings", href: "/app/settings", icon: Icon.gear },
  { key: "help", label: "Help & support", href: "/support/", icon: Icon.help },
];

/** Search sessions and jump anywhere: the search box in the top bar, or Ctrl+K / ⌘K. */
export function CommandPalette() {
  const { drips } = useDashboard();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function open() {
    setQuery("");
    setActive(0);
    if (!dialog.current?.open) dialog.current?.showModal();
    input.current?.focus();
  }

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({ ...p, group: "Go to" as const }));
    const sessions = drips
      .filter((d) => !q || (d.document_title ?? "Untitled document").toLowerCase().includes(q))
      .slice(0, q ? 8 : 5)
      .map((d) => ({
        key: d.id,
        group: "Sessions" as const,
        label: d.document_title ?? "Untitled document",
        hint: `${STATE_LABEL[stateOf(d)]} · ${d.progress.percent}% · ${formatRelative(d.created_at)}`,
        href: `/app/session?id=${d.id}`,
        icon: Icon.activity,
      }));
    return q ? [...sessions, ...pages] : [...pages, ...sessions];
  }, [drips, query]);

  function go(item: Item | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  }

  const groups = (["Sessions", "Go to"] as const).filter((g) => items.some((i) => i.group === g));
  const ordered = query.trim() ? groups : [...groups].reverse();

  return (
    <>
      <button type="button" className="search-btn" onClick={open} aria-keyshortcuts="Control+K Meta+K" aria-label="Search sessions and pages">
        <Icon.search /><span>Search sessions and pages</span><kbd aria-hidden="true">{mac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <dialog ref={dialog} className="palette" aria-label="Search" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="palette-input">
          <Icon.search />
          <input ref={input} type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list"
            aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined} aria-label="Search sessions and pages"
            placeholder="Search sessions and pages…" value={query} onKeyDown={onKeyDown}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }} />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" aria-label="Results">
          {items.length === 0 && <li className="palette-empty" role="presentation">Nothing matches &ldquo;{query}&rdquo;.</li>}
          {ordered.map((group) => (
            <li key={group} role="presentation">
              <p className="palette-group" aria-hidden="true">{group}</p>
              <ul role="presentation">
                {items.filter((i) => i.group === group).map((item) => {
                  const index = items.indexOf(item);
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.key} id={`palette-${item.key}`} role="option" aria-selected={index === active}
                      onMouseMove={() => setActive(index)} onClick={() => go(item)}>
                      <ItemIcon />
                      <span className="palette-label">{item.label}</span>
                      {item.hint && <span className="palette-hint">{item.hint}</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
