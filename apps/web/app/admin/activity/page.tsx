"use client";

import { FormEvent, useState } from "react";

type Entry = {
  id: string;
  at: string;
  visitorId: string;
  request: string;
  region: { name: string; country: string; latitude: number; longitude: number } | null;
};

export default function ActivityAdminPage() {
  const [token, setToken] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activity", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Admin token was not accepted. Check ACTIVITY_ADMIN_TOKEN on the VM."
          : "Activity records could not be loaded.");
      }
      if (!data || typeof data !== "object" || !("entries" in data) || !Array.isArray(data.entries)) {
        throw new Error("Activity response was invalid.");
      }
      setEntries(data.entries as Entry[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Activity records could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="activity-admin">
      <header>
        <p>FIELDWISE · ADMIN</p>
        <h1>Shared activity</h1>
        <span>Only questions shared by users who opted in appear here. Locations are approximate; records are kept for 30 days.</span>
      </header>
      <form className="activity-admin-access" onSubmit={loadActivity}>
        <label htmlFor="activity-admin-token">Admin token</label>
        <input id="activity-admin-token" type="password" autoComplete="current-password" value={token} onChange={(event) => setToken(event.target.value)} required />
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "View shared requests"}</button>
      </form>
      {error && <p className="activity-admin-error" role="alert">{error}</p>}
      <section className="activity-admin-list" aria-live="polite">
        {entries.map((entry) => (
          <article className="activity-admin-entry" key={entry.id}>
            <div className="activity-admin-entry-meta">
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              <span>Visitor {entry.visitorId.slice(0, 8)}</span>
            </div>
            <p>{entry.request}</p>
            <small>{entry.region
              ? `${entry.region.name}${entry.region.country ? `, ${entry.region.country}` : ""} · approx. ${entry.region.latitude.toFixed(2)}, ${entry.region.longitude.toFixed(2)}`
              : "No weather region selected"}</small>
          </article>
        ))}
        {entries.length === 0 && !loading && !error && <p className="activity-admin-empty">Enter your admin token to view shared requests.</p>}
      </section>
      <style jsx>{`
        .activity-admin { max-width: 850px; margin: 0 auto; padding: 32px 20px 60px; color: #263b31; font-family: Arial, sans-serif; }
        header p { color: #9a6749; font-size: 12px; font-weight: 700; letter-spacing: .12em; }
        h1 { margin: 7px 0; font-size: clamp(27px, 5vw, 38px); }
        header span { display: block; max-width: 650px; color: #637169; font-size: 14px; line-height: 1.6; }
        .activity-admin-access { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin: 24px 0; }
        .activity-admin-access label { grid-column: 1 / -1; font-size: 13px; font-weight: 700; }
        input { min-width: 0; padding: 12px; border: 1px solid #cbd4c9; border-radius: 8px; font: inherit; }
        button { padding: 0 16px; border: 0; border-radius: 8px; color: white; background: #315c46; font: inherit; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: .65; }
        .activity-admin-entry { margin-top: 12px; padding: 16px; border: 1px solid #e0e6dd; border-radius: 12px; background: #fffefa; }
        .activity-admin-entry-meta { display: flex; justify-content: space-between; gap: 12px; color: #718078; font-size: 12px; }
        .activity-admin-entry p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
        .activity-admin-entry small { color: #687a70; }
        .activity-admin-error { color: #9d332d; }
        .activity-admin-empty { color: #718078; }
        @media (max-width: 520px) { .activity-admin-access { grid-template-columns: 1fr; } .activity-admin-access label { grid-column: auto; } button { min-height: 46px; } .activity-admin-entry-meta { flex-direction: column; gap: 4px; } }
      `}</style>
    </main>
  );
}
