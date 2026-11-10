// Set this to the deployed Apps Script web app URL (same URL used in app.js).
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx78EWiMxap6DAg5SIWL9fX9BO0bodsGOaHaQfzMZAODX8hCIpZ284RRJ0AJh-U84E9/exec";
const $ = (id) => document.getElementById(id);
let dashboardData = { rsvps: [], songs: [], voices: [] };

function api(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_SCRIPT_URL) return reject(new Error("Google backend URL has not been added yet."));
    const callback = "googleCallback_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, ...params, callback });
    const cleanup = () => { delete window[callback]; script.remove(); };
    window[callback] = (data) => { cleanup(); data?.ok ? resolve(data) : reject(new Error(data?.error || "Request failed.")); };
    script.onerror = () => { cleanup(); reject(new Error("Couldn't reach the Google backend. Check the deployment URL.")); };
    script.src = GOOGLE_SCRIPT_URL + "?" + query.toString();
    document.body.append(script);
  });
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function cell(value) {
  const td = document.createElement("td");
  td.textContent = value == null ? "" : String(value);
  return td;
}
function renderTable(target, rows, fields) {
  const body = $(target);
  body.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = cell("Nothing here yet.");
    td.colSpan = fields.length;
    tr.append(td);
    body.append(tr);
    return;
  }
  rows.slice().reverse().forEach(row => {
    const tr = document.createElement("tr");
    fields.forEach(field => tr.append(cell(field.format ? field.format(row[field.key]) : row[field.key])));
    body.append(tr);
  });
}
function renderDashboard(data) {
  dashboardData = data;
  const yes = data.rsvps.filter(row => row[4] === "Yes");
  const no = data.rsvps.filter(row => row[4] === "No");
  $("yes-count").textContent = yes.length;
  $("guest-count").textContent = yes.reduce((sum, row) => sum + (Number(row[5]) || 0), 0);
  $("no-count").textContent = no.length;
  $("song-count").textContent = data.songs.length;
  renderTable("rsvp-rows", data.rsvps, [
    { key: 1 }, { key: 2 }, { key: 3 }, { key: 4 }, { key: 5 },
    { key: 0, format: formatDate }
  ]);
  renderTable("song-rows", data.songs, [
    { key: 1 }, { key: 2 }, { key: 0, format: formatDate }
  ]);
  const list = $("voice-list");
  list.replaceChildren();
  if (!data.voices.length) {
    const p = document.createElement("p");
    p.textContent = "No voice messages yet.";
    list.append(p);
  }
  data.voices.slice().reverse().forEach(voice => {
    const card = document.createElement("article");
    card.className = "voice-card";
    const title = document.createElement("strong");
    title.textContent = voice.name + " · " + voice.duration + " sec";
    const date = document.createElement("p");
    date.textContent = formatDate(voice.timestamp);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = voice.driveUrl;
    const link = document.createElement("a");
    link.href = voice.driveUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "OPEN / DOWNLOAD ORIGINAL ↗";
    card.append(title, date, audio, link);
    list.append(card);
  });
  $("login-panel").hidden = true;
  $("data-panel").hidden = false;
  $("sign-out").hidden = false;
}
async function refreshDashboard() {
  const token = sessionStorage.getItem("roatAdminToken");
  if (!token) return;
  try {
    const data = await api("adminData", { token });
    renderDashboard(data);
  } catch (error) {
    sessionStorage.removeItem("roatAdminToken");
    $("login-message").textContent = error.message;
    $("data-panel").hidden = true;
    $("login-panel").hidden = false;
    $("sign-out").hidden = true;
  }
}
$("send-code").addEventListener("click", async () => {
  $("send-code").disabled = true;
  $("login-message").textContent = "Sending sign-in code…";
  try {
    await api("sendCode");
    $("code-form").hidden = false;
    $("login-message").textContent = "Check themallingers@gmail.com for your six-digit code.";
  } catch (error) { $("login-message").textContent = error.message; }
  finally { $("send-code").disabled = false; }
});
$("code-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const result = await api("verifyCode", { code: $("admin-code").value.trim() });
    sessionStorage.setItem("roatAdminToken", result.token);
    await refreshDashboard();
  } catch (error) { $("login-message").textContent = error.message; }
  finally { button.disabled = false; }
});
$("sign-out").addEventListener("click", () => {
  sessionStorage.removeItem("roatAdminToken");
  $("data-panel").hidden = true;
  $("login-panel").hidden = false;
  $("sign-out").hidden = true;
  $("code-form").hidden = true;
  $("login-message").textContent = "Signed out.";
});
function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
$("export-rsvps").addEventListener("click", () => downloadCsv("roat-rsvps.csv", [
  ["Timestamp", "Name", "Email", "Phone", "Attending", "Guest Count"],
  ...dashboardData.rsvps
]));
$("export-songs").addEventListener("click", () => downloadCsv("roat-song-requests.csv", [
  ["Timestamp", "Name", "Song"],
  ...dashboardData.songs
]));
refreshDashboard();
