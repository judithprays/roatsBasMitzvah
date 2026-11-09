import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);
const setMessage = (id, message) => { $(id).textContent = message; };

function requireSupabase() {
  if (!supabase) {
    throw new Error("The site is not connected to Supabase yet. Add your project URL and anon key in app.js.");
  }
}

$("rsvp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const attending = form.get("attending") === "yes";
  const payload = {
    name: form.get("name").trim(),
    email: form.get("email").trim(),
    phone: form.get("phone").trim(),
    attending,
    guest_count: Number(form.get("guest_count"))
  };
  try {
    requireSupabase();
    const { error } = await supabase.from("rsvps").insert(payload);
    if (error) throw error;
    event.currentTarget.reset();
    setMessage("rsvp-message", "Your RSVP is in. Thank you!");
  } catch (error) { setMessage("rsvp-message", error.message); }
});

$("song-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    requireSupabase();
    const { error } = await supabase.from("song_submissions").insert({
      name: form.get("name").trim(), song: form.get("song").trim()
    });
    if (error) throw error;
    event.currentTarget.reset();
    setMessage("song-message", "Song submitted! Roat's playlist just got better.");
  } catch (error) { setMessage("song-message", error.message); }
});

let recorder;
let chunks = [];
let audioBlob;
let audioUrl;
let recordingStream;
let stopTimer;
let elapsedTimer;
let startedAt = 0;
let seconds = 0;
const MAX_SECONDS = 30;
const MIN_SECONDS = 15;

function updateClock() {
  $("recording-time").innerHTML = `00:${String(seconds).padStart(2, "0")} <span>/ 00:30</span>`;
}
function resetRecording() {
  clearTimeout(stopTimer); clearInterval(elapsedTimer);
  if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
  recordingStream = null; recorder = null; chunks = []; audioBlob = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  $("preview-audio").hidden = true; $("preview-audio").removeAttribute("src");
  $("record-button").disabled = false; $("record-button").classList.remove("is-recording");
  $("record-label").textContent = "START RECORDING";
  $("stop-button").disabled = true; $("submit-voice").disabled = true; $("discard-voice").disabled = true;
  seconds = 0; updateClock();
}
$("record-button").addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error("In-browser recording isn't supported in this browser. Try the latest version of Safari or Chrome.");
    }
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(recordingStream);
    chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      audioUrl = URL.createObjectURL(audioBlob);
      $("preview-audio").src = audioUrl; $("preview-audio").hidden = false;
      $("submit-voice").disabled = seconds < MIN_SECONDS;
      $("discard-voice").disabled = false;
      $("record-label").textContent = "RECORD AGAIN";
      recordingStream?.getTracks().forEach(track => track.stop());
      recordingStream = null;
      if (seconds < MIN_SECONDS) setMessage("voice-message", "Please record at least 15 seconds.");
      else setMessage("voice-message", "Listen back, then submit when you're happy with it.");
    };
    recorder.start();
    startedAt = Date.now(); seconds = 0; updateClock();
    $("record-button").classList.add("is-recording"); $("record-label").textContent = "RECORDING…";
    $("stop-button").disabled = false; $("submit-voice").disabled = true; $("discard-voice").disabled = true;
    elapsedTimer = setInterval(() => { seconds = Math.min(MAX_SECONDS, Math.floor((Date.now() - startedAt) / 1000)); updateClock(); }, 250);
    stopTimer = setTimeout(() => stopRecording(), MAX_SECONDS * 1000);
  } catch (error) { setMessage("voice-message", error.message); }
});
function stopRecording() {
  if (recorder?.state === "recording") {
    clearInterval(elapsedTimer); clearTimeout(stopTimer);
    seconds = Math.min(MAX_SECONDS, Math.floor((Date.now() - startedAt) / 1000)); updateClock();
    recorder.stop();
    $("record-button").classList.remove("is-recording"); $("stop-button").disabled = true;
  }
}
$("stop-button").addEventListener("click", stopRecording);
$("discard-voice").addEventListener("click", () => { resetRecording(); setMessage("voice-message", "Ready for another take."); });
$("submit-voice").addEventListener("click", async () => {
  const name = $("voice-name").value.trim();
  if (!name) { setMessage("voice-message", "Please add your name first."); return; }
  if (!audioBlob || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    setMessage("voice-message", "Please record a message between 15 and 30 seconds."); return;
  }
  $("submit-voice").disabled = true;
  try {
    requireSupabase();
    const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("voice-messages").upload(path, audioBlob, {
      contentType: audioBlob.type, upsert: false
    });
    if (uploadError) throw uploadError;
    const { error } = await supabase.from("voice_messages").insert({
      name, storage_path: path, duration_seconds: seconds
    });
    if (error) {
      await supabase.storage.from("voice-messages").remove([path]);
      throw error;
    }
    $("voice-name").value = "";
    resetRecording();
    setMessage("voice-message", "Your message is saved. Roat will hear it at the party!");
  } catch (error) {
    $("submit-voice").disabled = false;
    setMessage("voice-message", error.message);
  }
});
updateClock();
