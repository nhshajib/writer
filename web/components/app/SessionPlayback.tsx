"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { executionText } from "../../../supabase/functions/_shared/drafting";

interface Playback { chunks: string[]; deletions: number[]; schedule: number[]; starts_at: string | null; recorded_actions: number; timing: "planned" }
export function SessionPlayback({ id, pro, recorded }: { id: string; pro: boolean; recorded: number }) {
  const [data, setData] = useState<Playback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  useEffect(() => {
    setData(null); setError(null); setPosition(0); setPlaying(false);
  }, [id, pro]);
  useEffect(() => {
    if (!pro) return;
    let cancelled = false;
    api<{ playback: Playback }>(`drips/${id}/playback`).then(r => { if (!cancelled) setData(r.playback); }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Playback could not be loaded."); });
    return () => { cancelled = true; };
  }, [id, pro, recorded]);
  useEffect(() => {
    if (!playing || !data) return;
    const timer = setInterval(() => setPosition(p => Math.min(p + 1, data.chunks.length)), 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, data, speed]);
  useEffect(() => { if (data && position >= data.chunks.length) setPlaying(false); }, [data, position]);
  const text = useMemo(() => data ? executionText(data.chunks, data.deletions, 0, position) : "", [data, position]);
  if (!pro) return <p className="hint">Replay recorded TypeWit session actions with Pro. Your activity log remains available on every plan. <button type="button" className="link-btn" data-locked="playback">See what Pro adds</button></p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (!data) return <p role="status">Loading session playback…</p>;
  return <div>
    <p className="hint">Read-only playback of TypeWit&apos;s confirmed actions, including temporary corrections. It does not edit your document or reproduce Google&apos;s version-history snapshots. The timeline uses the saved planned schedule.</p>
    {data.chunks.length ? <>
      <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}><button type="button" className="btn btn-secondary btn-sm" onClick={() => { if (position === data.chunks.length) setPosition(0); setPlaying(p => !p); }}>{playing ? "Pause playback" : "Play session"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPlaying(false); setPosition(0); }}>Restart playback</button><label>Playback speed <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1}>1 edit / second</option><option value={4}>4 edits / second</option><option value={16}>16 edits / second</option></select></label></div>
      <label className="label" htmlFor={`playback-${id}`}>Recorded action {position} of {data.chunks.length}</label><input id={`playback-${id}`} type="range" min={0} max={data.chunks.length} value={position} onChange={e => { setPlaying(false); setPosition(Number(e.target.value)); }} style={{ width: "100%" }} />
      <pre className="text-preview" tabIndex={0} aria-label="Session playback text" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "26rem", overflow: "auto" }}>{text || "No text at this point."}</pre>
    </> : <p>No confirmed actions yet. Playback becomes available after text is entered.</p>}
  </div>;
}
