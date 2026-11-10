import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const $ = (id) => document.getElementById(id);
const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
let cachedRsvps = [];
let cachedSongs = [];

function message(id, text) { $(id).textContent = text; }
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function csv(rows, columns) {
  const quote = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  return [columns.map(c => quote(c.label)).join(","), ...rows.map(row => columns.map(c => quote(row[c.key])).join(","))].join("\r\n");
}
function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function renderRsvps(rows) {
  $("rsvp-list").innerHTML = rows.length ? `<table><thead><tr><th>NAME</th><th>RESPONSE</th><th>GUESTS</th><th>EMAIL</th><th>PHONE</th><th>WHEN</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td><span class="status ${r.attending ? "yes" : "no"}">${r.attending ? "YES" : "NO"}</span></td><td>${r.guest_count}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml(r.phone)}</td><td>${dateLabel(r.created_at)}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">No RSVPs yet. They will show up here as guests respond.</p>';
}
function renderSongs(rows) {
  $("song-list").innerHTML = rows.length ? `<table><thead><tr><th>FROM</th><th>SONG / LINK</th><th>SUBMITTED</th></tr></thead><tbody>${rows.map(r => {
    const raw = String(r.song || "");
    const safe = escapeHtml(raw);
    const link = /^https?:\/\//i.test(raw) ? `<a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer">${safe}</a>` : safe;
    return `<tr><td>${escapeHtml(r.name)}</td><td>${link}</td><td>${dateLabel(r.created_at)}</td></tr>`;
  }).join("")}</tbody></table>` : '<p class="empty">No songs yet. Every submission will appear here.</p>';
}
async function renderVoices(rows) {
  if (!rows.length) { $("voice-list").innerHTML = '<p class="empty">No voice messages yet.</p>'; return; }
  $("voice-list").innerHTML = rows.map(r => `<article class="voice-row"><div><strong>${escapeHtml(r.name)}</strong><span>${r.duration_seconds}s · ${dateLabel(r.created_at)}</span></div><button class="quiet-button" data-audio-path="${escapeHtml(r.storage_path)}">PLAY / DOWNLOAD ↓</button></article>`).join("");
  $("voice-list").querySelectorAll("[data-audio-path]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true; button.textContent = "PREPARING…";
    const { data, error } = await supabase.storage.from("voice-messages").createSignedUrl(button.dataset.audioPath, 60 * 10, { download: true });
    if (error) { button.disabled = false; button.textContent = "TRY AGAIN"; message("dashboard-message", error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener");
    button.disabled = false; button.textContent = "PLAY / DOWNLOAD ↓";
  }));
}
async function loadDashboard() {
  message("dashboard-message", "Loading responses…");
  const [rsvps, songs, voices] = await Promise.all([
    supabase.from("rsvps").select("*").order("created_at", { ascending: false }),
    supabase.from("song_submissions").select("*").order("created_at", { ascending: false }),
    supabase.from("voice_messages").select("*").order("created_at", { ascending: false })
  ]);
  const failed = [rsvps, songs, voices].find(result => result.error);
  if (failed) { message("dashboard-message", failed.error.message); return; }
  cachedRsvps = rsvps.data || []; cachedSongs = songs.data || [];
  const yes = cachedRsvps.filter(r => r.attending);
  $("yes-count").textContent = yes.length;
  $("guest-count").textContent = yes.reduce((sum, r) => sum + Number(r.guest_count || 0), 0);
  $("no-count").textContent = cachedRsvps.filter(r => !r.attending).length;
  $("song-count").textContent = cachedSongs.length;
  renderRsvps(cachedRsvps); renderSongs(cachedSongs); await renderVoices(voices.data || []);
  message("dashboard-message", "Up to date · " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
}
async function showSession(session) {
  $("login-panel").hidden = !!session;
  $("dashboard").hidden = !session;
  if (session) await loadDashboard();
}
if (!supabase) {
  message("login-message", "Add your Supabase URL and publishable key in supabase-config.js first.");
} else {
  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email").trim();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    message("login-message", error ? error.message : "Check your email for your private sign-in link.");
  });
  $("sign-out").addEventListener("click", async () => { await supabase.auth.signOut(); });
  document.querySelectorAll("[data-export]").forEach(button => button.addEventListener("click", () => {
    const isRsvp = button.dataset.export === "rsvps";
    const columns = isRsvp
      ? [{ key: "name", label: "Name" }, { key: "attending", label: "Attending" }, { key: "guest_count", label: "Guest count" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "created_at", label: "Submitted" }]
      : [{ key: "name", label: "Name" }, { key: "song", label: "Song" }, { key: "created_at", label: "Submitted" }];
    downloadCsv(isRsvp ? "roat-rsvps.csv" : "roat-song-requests.csv", csv(isRsvp ? cachedRsvps : cachedSongs, columns));
  }));
  supabase.auth.onAuthStateChange((_event, session) => { showSession(session); });
  supabase.auth.getSession().then(({ data }) => showSession(data.session));
}
