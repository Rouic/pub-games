"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Group {
  id: string; code: string; name: string;
  member_count: number; visit_count: number; created_at: string;
}

export default function TrackerHub() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    })
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newName || "Our Pub Crawl" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.push(`/tracker/${d.group.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function join() {
    if (joinCode.length < 4) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", code: joinCode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.push(`/tracker/${d.group.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="center-content" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div className="anim-fade" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🍻</div>
          <h1 style={{
            fontSize: "clamp(1.6rem, 6vw, 2.2rem)", fontWeight: 700, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, var(--neon-amber), var(--neon-green))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: "0.3rem",
          }}>
            Pub Tracker
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Rate pubs with friends. Track your favourites.
          </p>
        </div>

        {/* My groups */}
        {!loading && groups.length > 0 && (
          <div className="anim-slide" style={{ width: "100%" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
              Your trackers
            </div>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => router.push(`/tracker/${g.id}`)}
                className="card card-interactive"
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "1rem",
                  padding: "1rem 1.25rem", marginBottom: "0.5rem", textAlign: "left",
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>🍺</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#fff" }}>{g.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {g.member_count} members · {g.visit_count} visits
                  </div>
                </div>
                <span className="pill live" style={{ fontSize: "0.7rem" }}>{g.code}</span>
              </button>
            ))}
          </div>
        )}

        {/* Create new */}
        <div className="card anim-slide" style={{ width: "100%", animationDelay: "0.1s" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem", textAlign: "center" }}>
            Start a new tracker
          </div>
          <input
            className="input"
            placeholder="Group name (e.g. Friday Night Crew)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ marginBottom: "0.5rem" }}
          />
          <button className="btn btn-primary btn-block" onClick={create} disabled={busy}>
            Create tracker
          </button>
        </div>

        {/* Join */}
        <div className="card anim-slide" style={{ width: "100%", animationDelay: "0.2s" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem", textAlign: "center" }}>
            Join a friend&apos;s tracker
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="input input-code"
              placeholder="CODE"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && join()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={join} disabled={busy || joinCode.length < 4}>Join</button>
          </div>
        </div>

        {error && <div className="anim-shake" style={{ color: "var(--neon-red)", fontSize: "0.88rem", fontWeight: 600 }}>{error}</div>}

        <a href="/" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textDecoration: "none" }}>&larr; Back to games</a>
      </div>
    </div>
  );
}
