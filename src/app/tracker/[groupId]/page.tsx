"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import AccountSheet from "@/components/AccountSheet";

interface Pub {
  id: string; name: string; location: string; lat: number | null; lng: number | null;
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
interface HistoryVisit {
  id: string; player_name: string; player_emoji: string;
  rating_options: number; rating_atmosphere: number; rating_price: number;
  rating_seating: number; rating_service: number; rating_food: number;
  overall: number; notes: string; visited_at: string; created_at: string;
}
interface BeerLog {
  id: string; beer_name: string; brewery: string; price_pint: number;
  player_name: string; player_emoji: string; notes: string; created_at: string;
}
interface Member { id: string; name: string; emoji: string; visit_count: number; }
interface Stats {
  averages: Record<string, number>;
  monthly: Array<{ month: string; visits: number; avg_score: number }>;
  topPubs: Array<{ name: string; score: number; visits: number }>;
  memberStats: Array<{ name: string; emoji: string; visits: number; avg_score: number }>;
}
interface BeerSuggestion { id: string; name: string; brewery: string; }

type Tab = "pubs" | "rate" | "stats" | "map" | "members";

const CATEGORIES = [
  { key: "options", label: "Drink Options", icon: "🍺" },
  { key: "atmosphere", label: "Atmosphere", icon: "🎶" },
  { key: "price", label: "Value for Money", icon: "💰" },
  { key: "seating", label: "Seating", icon: "🪑" },
  { key: "service", label: "Service", icon: "🙋" },
  { key: "food", label: "Food", icon: "🍔" },
];

// ── Stars ──
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
        >&#11088;</button>
      ))}
    </div>
  );
}

// ── ScoreBar ──
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
        {value ? Number(value).toFixed(1) : "\u2014"}
      </span>
    </div>
  );
}

// ── RadarChart ──
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
      {[0.2, 0.4, 0.6, 0.8, 1].map((s) => (
        <polygon key={s} fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={0.5}
          points={Array.from({ length: n }, (_, i) => {
            const a = (Math.PI * 2 * i) / n - Math.PI / 2;
            return `${cx + Math.cos(a) * r * s},${cy + Math.sin(a) * r * s}`;
          }).join(" ")}
        />
      ))}
      {data.map((_, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="var(--border)" strokeWidth="0.5" />;
      })}
      <polygon points={path.replace("Z", "").replace(/[ML]/g, " ").trim()} fill="rgba(34,211,238,0.2)" stroke="#22d3ee" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#22d3ee" />
          <text x={cx + Math.cos(p.angle) * (r + 16)} y={cy + Math.sin(p.angle) * (r + 16)}
            textAnchor="middle" dominantBaseline="middle" fill="var(--text-dim)" fontSize="8" fontFamily="system-ui"
          >{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Sparkline for rating history ──
function Sparkline({ values, width = 120, height = 32, color = "#22d3ee" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 5);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={i === pts.length - 1 ? color : "var(--bg-card)"} stroke={color} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ══════════════════════════════════════════
// ══ Main component ══════════════════════
// ══════════════════════════════════════════
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
  const [player, setPlayer] = useState<{ id: string; name: string; emoji: string; hasClaimed?: boolean } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  // Rating form
  const [pubName, setPubName] = useState("");
  const [pubLocation, setPubLocation] = useState("");
  const [ratings, setRatings] = useState({ options: 0, atmosphere: 0, price: 0, seating: 0, service: 0, food: 0 });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingPubId, setExistingPubId] = useState<string | null>(null);

  // Pub autocomplete
  const [pubSearch, setPubSearch] = useState("");
  const [pubSuggestions, setPubSuggestions] = useState<Array<{ id: string; name: string; location: string }>>([]);
  const [showPubDropdown, setShowPubDropdown] = useState(false);

  // Beer tracking on Rate tab
  const [beerName, setBeerName] = useState("");
  const [beerBrewery, setBeerBrewery] = useState("");
  const [beerPrice, setBeerPrice] = useState("");
  const [beerSuggestions, setBeerSuggestions] = useState<BeerSuggestion[]>([]);
  const [showBeerDropdown, setShowBeerDropdown] = useState(false);
  const [existingBeerId, setExistingBeerId] = useState<string | null>(null);

  // Geolocation
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Pub history (expandable)
  const [expandedPub, setExpandedPub] = useState<string | null>(null);
  const [pubHistory, setPubHistory] = useState<HistoryVisit[]>([]);
  const [pubBeers, setPubBeers] = useState<BeerLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

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

  useEffect(() => {
    fetchData();
    fetch("/api/auth").then((r) => r.json()).then((d) => { if (d.player) setPlayer(d.player); }).catch(() => {});
  }, [fetchData]);
  useEffect(() => { if (tab === "stats") fetchStats(); }, [tab, fetchStats]);

  // Pub autocomplete search
  useEffect(() => {
    if (!pubSearch.trim() || existingPubId) { setPubSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tracker/${groupId}/pubs?q=${encodeURIComponent(pubSearch)}`);
        const d = await res.json();
        setPubSuggestions(d.pubs ?? []);
        setShowPubDropdown((d.pubs ?? []).length > 0);
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [pubSearch, groupId, existingPubId]);

  // Beer autocomplete search
  useEffect(() => {
    if (!beerName.trim() || existingBeerId) { setBeerSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tracker/${groupId}/beers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search", term: beerName }),
        });
        const d = await res.json();
        setBeerSuggestions(d.beers ?? []);
        setShowBeerDropdown((d.beers ?? []).length > 0);
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [beerName, groupId, existingBeerId]);

  // Fetch pub history
  async function fetchPubHistory(pubId: string) {
    if (expandedPub === pubId) { setExpandedPub(null); return; }
    setExpandedPub(pubId);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tracker/${groupId}/pubs?pubId=${pubId}`);
      const d = await res.json();
      setPubHistory(d.visits ?? []);
      setPubBeers(d.beers ?? []);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }

  // Geolocation
  function getLocation() {
    if (!navigator.geolocation) { showToast("Geolocation not supported"); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude);
        setGeoLng(pos.coords.longitude);
        setGeoLoading(false);
        showToast("Location captured!");
      },
      () => { setGeoLoading(false); showToast("Could not get location"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

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
          lat: !existingPubId ? geoLat : undefined,
          lng: !existingPubId ? geoLng : undefined,
          ...ratings,
          notes,
        }),
      });
      const visitData = await res.json();
      if (!res.ok) throw new Error(visitData.error);

      // If beer was entered, log it too
      if (beerName.trim() || existingBeerId) {
        await fetch(`/api/tracker/${groupId}/beers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "log",
            beerId: existingBeerId,
            beerName: beerName.trim(),
            brewery: beerBrewery.trim(),
            pubId: visitData.pubId,
            visitId: visitData.visitId,
            pricePint: beerPrice,
          }),
        });
      }

      showToast("Rating saved!");
      setPubName(""); setPubLocation(""); setNotes(""); setPubSearch("");
      setRatings({ options: 0, atmosphere: 0, price: 0, seating: 0, service: 0, food: 0 });
      setExistingPubId(null);
      setBeerName(""); setBeerBrewery(""); setBeerPrice(""); setExistingBeerId(null);
      setGeoLat(null); setGeoLng(null);
      setTab("pubs");
      fetchData();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error"); }
    finally { setSubmitting(false); }
  }

  // ── Map initialization ──
  useEffect(() => {
    if (tab !== "map" || !mapRef.current || mapInstanceRef.current) return;
    const pubsWithCoords = pubs.filter((p) => p.lat && p.lng);
    if (pubsWithCoords.length === 0) return;

    // Dynamically load Leaflet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L as any;
      if (!L || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      pubsWithCoords.forEach((p) => {
        if (!p.lat || !p.lng) return;
        const ll: [number, number] = [p.lat, p.lng];
        bounds.push(ll);
        const score = p.avg_overall ? Number(p.avg_overall).toFixed(1) : "?";
        const color = Number(p.avg_overall) >= 4 ? "#22d3ee" : Number(p.avg_overall) >= 3 ? "#fbbf24" : "#f87171";
        L.marker(ll)
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui;min-width:120px">` +
            `<strong style="font-size:14px">${p.name}</strong>` +
            (p.location ? `<br><span style="color:#888;font-size:12px">${p.location}</span>` : "") +
            `<br><span style="font-size:18px;font-weight:700;color:${color}">${score}</span>` +
            `<span style="font-size:12px;color:#888"> /5 (${p.visit_count} visits)</span>` +
            `</div>`
          );
      });

      if (bounds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
      }

      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as Record<string, unknown> & { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tab, pubs]);

  if (loading) {
    return <div className="page"><div className="center-content"><div className="anim-pulse" style={{ fontSize: "2rem" }}>🍻</div></div></div>;
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "pubs", label: "Pubs", icon: "🍺" },
    { key: "rate", label: "Rate", icon: "⭐" },
    { key: "stats", label: "Stats", icon: "📊" },
    { key: "map", label: "Map", icon: "📍" },
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
            {" \u00b7 "}{members.length} members \u00b7 {pubs.length} pubs
          </div>
        </div>
        {player && (
          <button className="player-chip" style={{ cursor: "pointer", fontSize: "0.78rem", padding: "0.35rem 0.75rem" }} onClick={() => setAccountOpen(true)}>
            <span>{player.emoji}</span>
            <span style={{ fontWeight: 600, color: "#fff" }}>{player.name}</span>
            {player.hasClaimed ? (
              <span style={{ fontSize: "0.6rem", color: "var(--neon-green)" }}>&#10003;</span>
            ) : (
              <span style={{ fontSize: "0.55rem", opacity: 0.4, background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 4px" }}>save</span>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.2rem", marginBottom: "1rem", background: "var(--bg-card)", borderRadius: "var(--r)", padding: "0.25rem", border: "1px solid var(--border)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "0.55rem 0.25rem", border: "none", borderRadius: "var(--r-sm)",
              background: tab === t.key ? "var(--neon-green)" : "transparent",
              color: tab === t.key ? "#000" : "var(--text-dim)",
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: "0.75rem", cursor: "pointer", transition: "all 0.15s",
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
                      {p.avg_overall ? Number(p.avg_overall).toFixed(1) : "\u2014"}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{p.visit_count} visit{Number(p.visit_count) !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {CATEGORIES.map((c) => {
                  const val = p[`avg_${c.key}` as keyof Pub] as number;
                  return <ScoreBar key={c.key} label={c.label} icon={c.icon} value={val} />;
                })}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    className="btn btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => { setExistingPubId(p.id); setPubName(p.name); setPubLocation(p.location); setTab("rate"); }}
                  >
                    Rate again
                  </button>
                  {Number(p.visit_count) > 1 && (
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => fetchPubHistory(p.id)}
                    >
                      {expandedPub === p.id ? "Hide history" : "History"}
                    </button>
                  )}
                </div>

                {/* Expanded history */}
                {expandedPub === p.id && (
                  <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                    {historyLoading ? (
                      <div className="anim-pulse" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading history...</div>
                    ) : (
                      <>
                        {/* Sparkline of overall ratings over time */}
                        {pubHistory.length >= 2 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>Trend</span>
                            <Sparkline values={pubHistory.map((v) => Number(v.overall) || 0)} width={160} height={28} />
                          </div>
                        )}

                        {/* Visit list */}
                        {pubHistory.map((v, i) => (
                          <div key={v.id} style={{
                            padding: "0.6rem 0",
                            borderTop: i ? "1px solid var(--border)" : "none",
                            display: "flex", gap: "0.5rem", alignItems: "flex-start",
                          }}>
                            <span style={{ fontSize: "1rem" }}>{v.player_emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.82rem" }}>{v.player_name}</span>
                                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-amber)", fontSize: "0.85rem" }}>{Number(v.overall).toFixed(1)}</span>
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{new Date(v.visited_at).toLocaleDateString()}</div>
                              {v.notes && <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.2rem" }}>{v.notes}</div>}
                            </div>
                          </div>
                        ))}

                        {/* Beer logs for this pub */}
                        {pubBeers.length > 0 && (
                          <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>Beers logged</div>
                            {pubBeers.map((b) => (
                              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", fontSize: "0.8rem" }}>
                                <span>🍺</span>
                                <span style={{ fontWeight: 600, color: "#fff", flex: 1 }}>{b.beer_name}{b.brewery ? ` (${b.brewery})` : ""}</span>
                                {b.price_pint && <span style={{ fontFamily: "var(--mono)", color: "var(--neon-green)", fontWeight: 700 }}>&pound;{Number(b.price_pint).toFixed(2)}</span>}
                                <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{b.player_emoji}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ Rate Tab ═══ */}
      {tab === "rate" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>
            {existingPubId ? `Rate ${pubName} again` : "Rate a pub"}
          </h2>

          {/* Pub selection */}
          {!existingPubId && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  placeholder="Search or type a pub name..."
                  value={pubSearch || pubName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPubSearch(v);
                    setPubName(v);
                    setExistingPubId(null);
                  }}
                  onFocus={() => { if (pubSuggestions.length) setShowPubDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowPubDropdown(false), 200)}
                  style={{ marginBottom: showPubDropdown ? 0 : "0.5rem" }}
                />
                {showPubDropdown && pubSuggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                    background: "var(--bg-raised)", border: "1px solid var(--border-hi)",
                    borderRadius: "0 0 var(--r-sm) var(--r-sm)", maxHeight: 180, overflowY: "auto",
                  }}>
                    {pubSuggestions.map((s) => (
                      <button
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setExistingPubId(s.id);
                          setPubName(s.name);
                          setPubLocation(s.location);
                          setPubSearch("");
                          setShowPubDropdown(false);
                        }}
                        style={{
                          display: "block", width: "100%", padding: "0.6rem 0.75rem",
                          background: "none", border: "none", borderTop: "1px solid var(--border)",
                          textAlign: "left", cursor: "pointer", color: "#fff", fontSize: "0.85rem",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        {s.location && <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.75rem" }}>{s.location}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input className="input" placeholder="Location (optional)" value={pubLocation} onChange={(e) => setPubLocation(e.target.value)} style={{ marginBottom: "0.5rem" }} />

              {/* Geolocation button */}
              <button
                className="btn btn-ghost btn-sm btn-block"
                onClick={getLocation}
                disabled={geoLoading}
                style={{ marginBottom: "0.25rem" }}
              >
                {geoLoading ? "Getting location..." : geoLat ? `📍 Location set (${geoLat.toFixed(4)}, ${geoLng?.toFixed(4)})` : "📍 Use my location"}
              </button>
            </div>
          )}

          {/* Star ratings */}
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
            placeholder="Notes (optional) \u2014 what did you think?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ marginTop: "1rem", minHeight: "3.5rem", resize: "vertical" }}
          />

          {/* Beer section */}
          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
              🍺 What are you drinking? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                placeholder="Beer name"
                value={beerName}
                onChange={(e) => { setBeerName(e.target.value); setExistingBeerId(null); }}
                onFocus={() => { if (beerSuggestions.length) setShowBeerDropdown(true); }}
                onBlur={() => setTimeout(() => setShowBeerDropdown(false), 200)}
                style={{ marginBottom: showBeerDropdown ? 0 : "0.5rem" }}
              />
              {showBeerDropdown && beerSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                  background: "var(--bg-raised)", border: "1px solid var(--border-hi)",
                  borderRadius: "0 0 var(--r-sm) var(--r-sm)", maxHeight: 140, overflowY: "auto",
                }}>
                  {beerSuggestions.map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setExistingBeerId(s.id);
                        setBeerName(s.name);
                        setBeerBrewery(s.brewery || "");
                        setShowBeerDropdown(false);
                      }}
                      style={{
                        display: "block", width: "100%", padding: "0.5rem 0.75rem",
                        background: "none", border: "none", borderTop: "1px solid var(--border)",
                        textAlign: "left", cursor: "pointer", color: "#fff", fontSize: "0.85rem",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      {s.brewery && <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.75rem" }}>{s.brewery}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="input" placeholder="Brewery (optional)" value={beerBrewery} onChange={(e) => setBeerBrewery(e.target.value)} style={{ flex: 1 }} />
              <input
                className="input"
                placeholder="Price/pint"
                value={beerPrice}
                onChange={(e) => setBeerPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                style={{ width: "5.5rem", textAlign: "center", fontFamily: "var(--mono)" }}
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: "1rem" }} onClick={submitRating} disabled={submitting || (!pubName.trim() && !existingPubId)}>
            {submitting ? "Saving..." : "Save Rating"}
          </button>
          {existingPubId && (
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: "0.5rem" }} onClick={() => { setExistingPubId(null); setPubName(""); setPubLocation(""); setPubSearch(""); }}>
              Rate a different pub instead
            </button>
          )}
        </div>
      )}

      {/* ═══ Stats Tab ═══ */}
      {tab === "stats" && stats && (
        <div>
          <div className="card" style={{ padding: "1.25rem", marginBottom: "0.75rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>Overall Profile</h3>
            <RadarChart data={CATEGORIES.map((c) => ({
              label: c.icon,
              value: Number(stats.averages?.[`avg_${c.key}`] ?? 0),
            }))} />
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {stats.averages?.total_visits ?? 0} visits \u00b7 {stats.averages?.unique_pubs ?? 0} pubs \u00b7 {stats.averages?.active_raters ?? 0} raters
              </span>
            </div>
          </div>

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

          {stats.memberStats.length > 0 && (
            <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>👥 Most Active</h3>
              {stats.memberStats.map((m, i) => (
                <div key={m.name} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: "1.1rem" }}>{m.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{m.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.visits} visits</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-green)" }}>{m.avg_score ?? "\u2014"}</span>
                </div>
              ))}
            </div>
          )}

          {/* Monthly trend */}
          {stats.monthly.length > 0 && (
            <div className="card" style={{ padding: "1rem" }}>
              <h3 style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>📅 Monthly</h3>
              {stats.monthly.slice(0, 6).map((m) => (
                <div key={m.month} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.4rem 0" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--text-muted)", width: "4.5rem" }}>{m.month}</span>
                  <div style={{ flex: 1, height: 6, background: "var(--bg-raised)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Number(m.visits) * 10)}%`, background: "var(--neon-green)", borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.8rem", color: "#fff", width: "2.5rem", textAlign: "right" }}>
                    {m.visits}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--neon-amber)", width: "2rem", textAlign: "right" }}>
                    {m.avg_score ?? "\u2014"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Map Tab ═══ */}
      {tab === "map" && (
        <div>
          {pubs.filter((p) => p.lat && p.lng).length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📍</div>
              <p style={{ color: "var(--text-dim)" }}>No pub locations yet. Use &quot;Use my location&quot; when rating a new pub!</p>
            </div>
          ) : (
            <div
              ref={mapRef}
              style={{
                width: "100%", height: "calc(100dvh - 10rem)",
                borderRadius: "var(--r)", overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
      )}

      {/* ═══ Members Tab ═══ */}
      {tab === "members" && (
        <div>
          <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", marginBottom: "0.5rem" }}>Invite friends</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>Share this code \u2014 they enter it on the Pub Tracker page</p>
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

      {/* Recent activity (on pubs tab) */}
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

      {/* Account sheet */}
      {player && (
        <AccountSheet player={player} open={accountOpen} onClose={() => setAccountOpen(false)} onUpdated={(p) => setPlayer(p as typeof player)} />
      )}
    </div>
  );
}
