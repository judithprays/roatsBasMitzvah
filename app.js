// Paste the deployed Google Apps Script web app URL here after setup.
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx78EWiMxap6DAg5SIWL9fX9BO0bodsGOaHaQfzMZAODX8hCIpZ284RRJ0AJh-U84E9/exec";

const $ = (id) => document.getElementById(id);
const setMessage = (id, message) => { $(id).textContent = message; };
let toastTimer;
function showToast(message, isError = false) {
  const toast = $("site-toast");
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4800);
}

document.querySelectorAll(".bulbs").forEach((row) => {
  for (let i = 0; i < 25; i++) {
    const bulb = document.createElement("span");
    bulb.className = "bulb";
    bulb.style.animationDelay = `${(i % 7) * 0.17}s`;
    row.append(bulb);
  }
});

function submitToGoogle(action, fields, messageId, successMessage) {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_SCRIPT_URL) {
      reject(new Error("The invitation is not connected yet. The family still needs to finish the Google setup."));
      return;
    }
    const requestId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frameName = "google-submit-" + requestId.replace(/[^a-zA-Z0-9_-]/g, "");
    const frame = document.createElement("iframe");
    frame.name = frameName;
    frame.hidden = true;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = GOOGLE_SCRIPT_URL;
    form.target = frameName;
    form.hidden = true;

    const values = { action, ...fields, website: "", request_id: requestId };
    Object.entries(values).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = String(value ?? "");
      form.append(input);
    });

    let finished = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      form.remove();
      frame.remove();
    };
    const onMessage = (event) => {
      if (!event.data || event.data.requestId !== requestId || typeof event.data.ok !== "boolean") return;
      if (finished) return;
      finished = true;
      cleanup();
      if (event.data.ok) {
        const confirmation = event.data.message || successMessage || "Saved!";
        if (messageId) setMessage(messageId, confirmation);
        showToast(confirmation);
        resolve(event.data);
      } else {
        const error = event.data.message || "Something went wrong. Please try again.";
        if (messageId) setMessage(messageId, error);
        showToast(error, true);
        reject(new Error(error));
      }
    };
    window.addEventListener("message", onMessage);
    document.body.append(frame, form);
    form.submit();
    // A timeout prevents a stuck form from leaving the UI disabled forever.
    window.setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      const error = "We couldn't confirm the submission. Please check your connection and try again.";
      if (messageId) setMessage(messageId, error);
      showToast(error, true);
      reject(new Error(error));
    }, 25000);
  });
}

$("rsvp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    name: form.get("name").trim(),
    email: form.get("email").trim(),
    phone: form.get("phone").trim(),
    attending: form.get("attending"),
    guest_count: Number(form.get("guest_count"))
  };
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  showToast("Sending your RSVP…");
  try {
    await submitToGoogle("rsvp", payload, "rsvp-message");
    event.currentTarget.reset();
  } catch (error) { setMessage("rsvp-message", error.message); }
  finally { button.disabled = false; }
});

$("song-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = { name: form.get("name").trim(), song: form.get("song").trim() };
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await submitToGoogle("song", payload, "song-message");
    event.currentTarget.reset();
  } catch (error) { setMessage("song-message", error.message); }
  finally { button.disabled = false; }
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
  clearTimeout(stopTimer);
  clearInterval(elapsedTimer);
  if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
  recordingStream = null;
  recorder = null;
  chunks = [];
  audioBlob = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  $("preview-audio").hidden = true;
  $("preview-audio").removeAttribute("src");
  $("record-button").disabled = false;
  $("record-button").classList.remove("is-recording");
  $("record-label").textContent = "START RECORDING";
  $("stop-button").disabled = true;
  $("submit-voice").disabled = true;
  $("discard-voice").disabled = true;
  seconds = 0;
  updateClock();
}
$("record-button").addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error("In-browser recording isn't supported here. Try the latest version of Safari or Chrome.");
    }
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(recordingStream);
    chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      audioUrl = URL.createObjectURL(audioBlob);
      $("preview-audio").src = audioUrl;
      $("preview-audio").hidden = false;
      $("submit-voice").disabled = seconds < MIN_SECONDS;
      $("discard-voice").disabled = false;
      $("record-label").textContent = "RECORD AGAIN";
      recordingStream?.getTracks().forEach(track => track.stop());
      recordingStream = null;
      setMessage("voice-message", seconds < MIN_SECONDS
        ? "Please record at least 15 seconds."
        : "Listen back, then submit when you're happy with it.");
    };
    recorder.start();
    startedAt = Date.now();
    seconds = 0;
    updateClock();
    $("record-button").classList.add("is-recording");
    $("record-label").textContent = "RECORDING…";
    $("stop-button").disabled = false;
    $("submit-voice").disabled = true;
    $("discard-voice").disabled = true;
    elapsedTimer = setInterval(() => {
      seconds = Math.min(MAX_SECONDS, Math.floor((Date.now() - startedAt) / 1000));
      updateClock();
    }, 250);
    stopTimer = setTimeout(stopRecording, MAX_SECONDS * 1000);
  } catch (error) { setMessage("voice-message", error.message); }
});
function stopRecording() {
  if (recorder?.state === "recording") {
    clearInterval(elapsedTimer);
    clearTimeout(stopTimer);
    seconds = Math.min(MAX_SECONDS, Math.floor((Date.now() - startedAt) / 1000));
    updateClock();
    recorder.stop();
    $("record-button").classList.remove("is-recording");
    $("stop-button").disabled = true;
  }
}
$("stop-button").addEventListener("click", stopRecording);
$("discard-voice").addEventListener("click", () => {
  resetRecording();
  setMessage("voice-message", "Ready for another take.");
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Couldn't read the recording. Please try again."));
    reader.readAsDataURL(blob);
  });
}
$("submit-voice").addEventListener("click", async () => {
  const name = $("voice-name").value.trim();
  if (!name) { setMessage("voice-message", "Please add your name first."); return; }
  if (!audioBlob || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    setMessage("voice-message", "Please record a message between 15 and 30 seconds.");
    return;
  }
  $("submit-voice").disabled = true;
  try {
    const audioBase64 = await blobToBase64(audioBlob);
    await submitToGoogle("voice", {
      name,
      duration_seconds: seconds,
      content_type: audioBlob.type || "audio/webm",
      audio_base64: audioBase64
    }, "voice-message");
    $("voice-name").value = "";
    resetRecording();
  } catch (error) {
    $("submit-voice").disabled = false;
    setMessage("voice-message", error.message);
  }
});
updateClock();
