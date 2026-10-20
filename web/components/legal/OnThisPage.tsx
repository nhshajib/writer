"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "On this page": links to each section of a long policy. Built from the page's
 * own headings after it loads, so the full text is always in the page itself.
 */
export function OnThisPage() {
  const ref = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const article = ref.current?.closest("article");
    if (!article) return;
    const headings = [...article.querySelectorAll<HTMLHeadingElement>("h2")];
    setItems(headings.map((h, i) => {
      if (!h.id) h.id = `section-${i + 1}-${(h.textContent ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      return { id: h.id, text: h.textContent ?? "" };
    }));
  }, []);

  return (
    <details ref={ref} className="on-this-page" hidden={items.length === 0}>
      <summary>On this page</summary>
      <ol>{items.map((item) => <li key={item.id}><a href={`#${item.id}`}>{item.text}</a></li>)}</ol>
    </details>
  );
}
