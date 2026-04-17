"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface Pub {
  id: string; name: string; location: string;
  visit_count: number; avg_overall: number;
  avg_options: number; avg_atmosphere: number; avg_price: number;
  avg_seating: number; avg_service: number; avg_food: number;
  last_visit: string;
}
interface Visit {
  id: string; pub_name: string; player_name: string; player_emoji: string;
  rating_options: number; rating_atmosphere: number; rating_price: number;
  rating_seating: number; rating_service: number; rating_food: number;
  overall: number; notes: string; visited_at: string;
}
interface Member { id: string; name: string; emoji: string; visit_count: number; }
interface Stats {
  averages: Record<string, number>;
  monthly: Array<{ month: string; visits: number; avg_score: number }>;
  topPubs: Array<{ name: string; score: number; visits: number }>;
  memberStats: Array<{ name: string; emoji: string; visits: number; avg_score: number }>;
}

type Tab = "pubs" | "rate" | "stats" | "members";

const CATEGORIES = [
  { key: "options", label: "Drink Options", icon: "🍺" },
  { key: "atmosphere", label: "Atmosphere", icon: "🎶" },
  { key: "price", label: "Value for Money", icon: "💰" },
  { key: "seating", label: "Seating", icon: "🪑" },
  { key: "service", label: "Service", icon: "🙋" },
  { key: "food", label: "Food", icon: "🍔" },
];

function Stars({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => !readonly && onChange?.(n)}
          style={{
            background: "none", border: "none", cursor: readonly ? "default" : "pointer",
            fontSize: "1.3rem", padding: 0, filter: n <= value ? "none" : "grayscale(1) opacity(0.3)",
            transition: "transform 0.15s",
            transform: n <= value ? "scale(1.1)" : "scale(1)",
          }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

function ScoreBar({ label, icon, value, max = 5 }: { label: string; icon: string; value: number; max?: number }) {
  const pct = value ? (value / max) * 100 : 0;
  const color = value >= 4 ? "#22d3ee" : value >= 3 ? "#fbbf24" : value >= 2 ? "#f97316" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.4rem 0" }}>
      <span style={{ fontSize: "1rem", width: "1.5rem", textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", width: "6rem" }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "var(--bg-raised)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.85rem", color: "#fff", width: "2rem", textAlign: "right" }}>
        {value ? value.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function RadarChart({ data, size = 180 }: { data: Array<{ label: string; value: number }>; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = data.length;
  const points = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = (d.value || 0) / 5;
    return { x: cx + Math.cos(angle) * r * val, y: cy + Math.sin(angle) * r * val, label: d.label, angle };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {[0.2, 0.4, 0.6, 0.8, 1].map((s) => (
        <polygon key={s} fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={0.5}
          points={Array.from({ length: n }, (_, i) => {
            const a = (Math.PI * 2 * i) / n - Math.PI / 2;
            return `${cx + Math.cos(a) * r * s},${cy + Math.sin(a) * r * s}`;
          }).join(" ")}
        />
      ))}
      {/* Axes */}
      {data.map((_, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="var(--border)" strokeWidth="0.5" />;
      })}
      {/* Data polygon */}
      <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="rgba(34,211,238,0.2)" stroke="#22d3ee" strokeWidth="2" />
      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#22d3ee" />
          <text
            x={cx + Math.cos(p.angle) * (r + 16)}
            y={cy + Math.sin(p.angle) * (r + 16)}
            textAnchor="middle" dominantBaseline="middle"
            fill="var(--text-dim)" fontSize="8" fontFamily="system-ui"
          >{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function TrackerGroup() {
  const params = useParams();
  const groupId = params.groupId as string;
  const [tab, setTab] = useState<Tab>("pubs");
  const [group, setGroup] = useState<Record<string, string> | null>(null);
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Rating form
  const [pubName, setPubName] = useState("");
  const [pubLocation, setPubLocation] = useState("");
  const [ratings, setRatings] = useState({ options: 0, atmosphere: 0, price: 0, seating: 0, service: 0, food: 0 });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingPubId, setExistingPubId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker/${groupId}`);
      const d = await res.json();
      if (d.group) setGroup(d.group);
      setPubs(d.pubs ?? []);
      setVisits(d.recentVisits ?? []);
      setMembers(d.members ?? []);
      setPlayerId(d.playerId ?? "");
    } catch { /* retry */ }
    setLoading(false);
  }, [groupId]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker/${groupId}/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === "stats") fetchStats(); }, [tab, fetchStats]);

  async function submitRating() {
    if (!pubName.trim() && !existingPubId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tracker/${groupId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubId: existingPubId,
          pubName: pubName.trim(),
          pubLocation: pubLocation.trim(),
          ...ratings,
          notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Rating saved!");
      setPubName(""); setPubLocation(""); setNotes("");
      setRatings({ options: 0, atmosphere: 0, price: 0, seating: 0, service: 0, food: 0 });
      setExistingPubId(null);
      setTab("pubs");
      fetchData();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
    finally { setSubmitting(false); }
  }

  if (loading) {
    return <div className="page"><div className="center-content"><div className="anim-pulse" style={{ fontSize: "2rem" }}>🍻</div></div></div>;
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "pubs", label: "Pubs", icon: "🍺" },
    { key: "rate", label: "Rate", icon: "⭐" },
    { key: "stats", label: "Stats", icon: "📊" },
    { key: "members", label: "Crew", icon: "👥" },
  ];

  return (
    <div className="page" style={{ padding: "0.75rem", paddingBottom: "4.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <a href="/tracker" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "1.2rem" }}>&larr;</a>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: 0 }}>{group?.name ?? "Tracker"}</h1>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Code: <span style={{ fontFamily: "var(--mono)", color: "var(--neon-amber)", fontWeight: 700 }}>{group?.code}</span>
            {" · "}{members.length} members · {pubs.length} pubs
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", background: "var(--bg-card)", borderRadius: "var(--r)", padding: "0.25rem", border: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "0.6rem 0.5rem", border: "none", borderRadius: "var(--r-sm)",
              background: tab === t.key ? "var(--neon-green)" : "transparent",
              color: tab === t.key ? "#000" : "var(--text-dim)",
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: "0.8rem", cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Pubs Tab ═══ */}
      {tab === "pubs" && (
        <div>
          {pubs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🍺</div>
              <p style={{ color: "var(--text-dim)" }}>No pubs rated yet. Hit the Rate tab to add your first!</p>
            </div>
          ) : (
            pubs.map((p) => (
              <div key={p.id} className="card" style={{ marginBottom: "0.75rem", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <h3 style={{ fontWeight: 700, color: "#fff", fontSize: "1rem", margin: 0 }}>{p.name}</h3>
                    {p.location && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{p.location}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--neon-amber)" }}>
                      {p.avg_overall?.toFixed(1) ?? "—"}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{p.visit_count} visit{Number(p.visit_count) !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {CATEGORIES.map((c) => {
                  const val = p[`avg_${c.key}` as keyof Pub] as number;
                  return <ScoreBar key={c.key} label={c.label} icon={c.icon} value={val} />;
                })}
                <button
                  className="btn btn-sm"
                  style={{ marginTop: "0.5rem", width: "100%" }}
                  onClick={() => { setExistingPubId(p.id); setPubName(p.name); setPubLocation(p.location); setTab("rate"); }}
                >
                  Rate this pub again
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ Rate Tab ═══ */}
      {tab === "rate" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>
            {existingPubId ? `Rate ${pubName} again` : "Rate a new pub"}
          </h2>
          {!existingPubId && (
            <>
              <input className="input" placeholder="Pub name" value={pubName} onChange={(e) => setPubName(e.target.value)} style={{ marginBottom: "0.5rem" }} />
              <input className="input" placeholder="Location (optional)" value={pubLocation} onChange={(e) => setPubLocation(e.target.value)} style={{ marginBottom: "1rem" }} />
            </>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {CATEGORIES.map((c) => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.88rem", color: "var(--text-dim)" }}>{c.icon} {c.label}</span>
                <Stars value={ratings[c.key as keyof typeof ratings]} onChange={(v) => setRatings((p) => ({ ...p, [c.key]: v }))} />
              </div>
            ))}
          </div>
          <textarea
            className="input"
            placeholder="Notes (optional) — what did you think?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ marginTop: "1rem", minHeight: "4rem", resize: "vertical" }}
          />
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: "1rem" }} onClick={submitRating} disabled={submitting || (!pubName.trim() && !existingPubId)}>
            {submitting ? "Saving..." : "Save Rating"}
          </button>
          {existingPubId && (
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: "0.5rem" }} onClick={() => { setExistingPubId(null); setPubName(""); setPubLocation(""); }}>
              Rate a different pub instead
            </button>
          )}
        </div>
      )}

      {/* ═══ Stats Tab ═══ */}
      {tab === "stats" && stats && (
        <div>
          {/* Radar chart */}
          <div className="card" style={{ padding: "1.25rem", marginBottom: "0.75rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>Overall Profile</h3>
            <RadarChart data={CATEGORIES.map((c) => ({
              label: c.icon,
              value: Number(stats.averages?.[`avg_${c.key}`] ?? 0),
            }))} />
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {stats.averages?.total_visits ?? 0} visits · {stats.averages?.unique_pubs ?? 0} pubs · {stats.averages?.active_raters ?? 0} raters
              </span>
            </div>
          </div>

          {/* Top pubs leaderboard */}
          {stats.topPubs.length > 0 && (
            <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>🏆 Top Pubs</h3>
              {stats.topPubs.map((p, i) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontWeight: 700, color: i === 0 ? "var(--neon-amber)" : "var(--text-muted)", width: "1.25rem" }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{p.name}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-amber)" }}>{p.score}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{p.visits} visits</span>
                </div>
              ))}
            </div>
          )}

          {/* Member leaderboard */}
          {stats.memberStats.length > 0 && (
            <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>👥 Most Active</h3>
              {stats.memberStats.map((m, i) => (
                <div key={m.name} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: "1.1rem" }}>{m.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{m.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.visits} visits</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-green)" }}>{m.avg_score ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Members Tab ═══ */}
      {tab === "members" && (
        <div>
          <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>Invite friends</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Share this code — they enter it on the Pub Tracker page</p>
            <div className="room-code" style={{ fontSize: "2rem" }}>{group?.code}</div>
          </div>
          {members.map((m) => (
            <div key={m.id} className="card" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{m.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#fff" }}>{m.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.visit_count} ratings</div>
              </div>
              {m.id === playerId && <span className="pill live">You</span>}
            </div>
          ))}
        </div>
      )}

      {/* Recent activity (always visible at bottom on pubs tab) */}
      {tab === "pubs" && visits.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
            Recent activity
          </div>
          {visits.slice(0, 5).map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0", borderTop: "1px solid var(--border)" }}>
              <span>{v.player_emoji}</span>
              <span style={{ fontSize: "0.8rem", color: "#fff", fontWeight: 600, flex: 1 }}>{v.player_name}</span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>rated</span>
              <span style={{ fontSize: "0.8rem", color: "var(--neon-amber)", fontWeight: 600 }}>{v.pub_name}</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "#fff" }}>{v.overall}/5</span>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
