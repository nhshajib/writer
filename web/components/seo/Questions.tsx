/**
 * Visible answers to the questions people search for. Deliberately no FAQPage markup: Google shows
 * those rich results only for authoritative government and health sites (see docs/seo-audit.md).
 */
export function Questions({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return <section className="seo-questions" aria-labelledby="questions-title">
    <h2 id="questions-title">Questions</h2>
    {items.map(item => <div key={item.q}><h3>{item.q}</h3><p>{item.a}</p></div>)}
  </section>;
}
