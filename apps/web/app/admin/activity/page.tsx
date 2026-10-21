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
  const [filter, setFilter] = useState("");

  const filteredEntries = entries.filter((entry) => {
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return true;
    return [entry.request, entry.visitorId, entry.region?.name, entry.region?.country]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });

  const loadActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/activity", {
        headers: { Authorization: `Bearer ${token.trim()}` },
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
        <h1>Activity log</h1>
        <span>Questions and selected weather locations. Coordinates are approximate and records are kept for 30 days.</span>
      </header>
      <form className="activity-admin-access" onSubmit={loadActivity}>
        <label htmlFor="activity-admin-token">Admin token</label>
        <input id="activity-admin-token" type="password" autoComplete="current-password" value={token} onChange={(event) => setToken(event.target.value)} required />
        <button type="submit" disabled={loading}>{loading ? "Loading…" : "Load activity"}</button>
      </form>
      {error && <p className="activity-admin-error" role="alert">{error}</p>}
      {entries.length > 0 && <div className="activity-admin-toolbar">
        <label htmlFor="activity-filter">{filteredEntries.length} of {entries.length} records</label>
        <input id="activity-filter" type="search" placeholder="Filter by request, visitor, or place" value={filter} onChange={(event) => setFilter(event.target.value)} />
      </div>}
      <section className="activity-admin-list" aria-live="polite">
        {filteredEntries.map((entry) => (
          <article className="activity-admin-entry" key={entry.id}>
            <div className="activity-admin-entry-meta">
              <span className={`activity-admin-badge${/location (fetched|selected)/i.test(entry.request) ? " location" : ""}`}>
                {/location (fetched|selected)/i.test(entry.request) ? "Location" : "Question"}
              </span>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              <span>Visitor {entry.visitorId.slice(0, 8)}</span>
            </div>
            <p>{entry.request}</p>
            {entry.region ? <div className="activity-admin-place">
              <div>
                <strong>{entry.region.name}{entry.region.country ? `, ${entry.region.country}` : ""}</strong>
                <small>{entry.region.latitude.toFixed(2)}, {entry.region.longitude.toFixed(2)} · approximate coordinates</small>
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${entry.region.latitude},${entry.region.longitude}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
            </div> : <small className="activity-admin-no-place">No location attached</small>}
          </article>
        ))}
        {entries.length === 0 && !loading && !error && <p className="activity-admin-empty">Enter your admin token to load activity records.</p>}
        {entries.length > 0 && filteredEntries.length === 0 && <p className="activity-admin-empty">No records match that filter.</p>}
      </section>
      <style jsx>{`
        .activity-admin { max-width: 900px; margin: 0 auto; padding: 32px 20px 60px; color: #263b31; font-family: Arial, sans-serif; }
        header p { color: #9a6749; font-size: 12px; font-weight: 700; letter-spacing: .12em; }
        h1 { margin: 7px 0; font-size: clamp(27px, 5vw, 38px); }
        header span { display: block; max-width: 650px; color: #637169; font-size: 14px; line-height: 1.6; }
        .activity-admin-access { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin: 24px 0 18px; }
        .activity-admin-access label { grid-column: 1 / -1; font-size: 13px; font-weight: 700; }
        input { min-width: 0; padding: 12px; border: 1px solid #cbd4c9; border-radius: 8px; font: inherit; }
        button { padding: 0 16px; border: 0; border-radius: 8px; color: white; background: #315c46; font: inherit; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: .65; }
        .activity-admin-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px 0; color: #687a70; font-size: 13px; }
        .activity-admin-toolbar input { width: min(100%, 360px); }
        .activity-admin-entry { margin-top: 12px; padding: 18px; border: 1px solid #e0e6dd; border-radius: 14px; background: #fffefa; box-shadow: 0 5px 18px #263b310a; }
        .activity-admin-entry-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #718078; font-size: 12px; }
        .activity-admin-badge { padding: 4px 9px; border-radius: 999px; color: #315c46; background: #eaf2e9; font-size: 11px; font-weight: 700; }
        .activity-admin-badge.location { color: #765924; background: #f7efdc; }
        .activity-admin-entry p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
        .activity-admin-place { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px; border-radius: 10px; background: #f4f7f0; }
        .activity-admin-place strong, .activity-admin-place small { display: block; }
        .activity-admin-place small, .activity-admin-no-place { margin-top: 4px; color: #687a70; font-size: 12px; }
        .activity-admin-place a { flex: 0 0 auto; color: #315c46; font-size: 13px; font-weight: 700; text-decoration: none; }
        .activity-admin-place a:hover { text-decoration: underline; }
        .activity-admin-error { color: #9d332d; }
        .activity-admin-empty { color: #718078; }
        @media (max-width: 520px) { .activity-admin-access { grid-template-columns: 1fr; } .activity-admin-access label { grid-column: auto; } button { min-height: 46px; } .activity-admin-toolbar, .activity-admin-place { align-items: stretch; flex-direction: column; } .activity-admin-toolbar input { width: 100%; } .activity-admin-entry-meta { flex-wrap: wrap; justify-content: flex-start; } }
      `}</style>
    </main>
  );
}
