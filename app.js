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

function checkSubmission(requestId, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const callbackName = "__submission_" + requestId.replace(/[^a-zA-Z0-9_]/g, "");
    const started = Date.now();
    let timer;
    const script = document.createElement("script");
    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };
    window[callbackName] = (result) => {
      if (result?.pending) {
        if (Date.now() - started >= timeoutMs) {
          cleanup();
          reject(new Error("We couldn't confirm the submission. Please try again."));
          return;
        }
        window.setTimeout(poll, 700);
        return;
      }
      cleanup();
      if (result?.ok) resolve(result);
      else reject(new Error(result?.message || result?.error || "We couldn't save that submission. Please try again."));
    };
    const poll = () => {
      script.src = `${GOOGLE_SCRIPT_URL}?action=submissionStatus&request_id=${encodeURIComponent(requestId)}&callback=${callbackName}&_=${Date.now()}`;
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("We couldn't confirm the submission. Please try again."));
    };
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("We couldn't confirm the submission. Please try again."));
    }, timeoutMs);
    document.head.append(script);
    poll();
  });
}

async function submitToGoogle(action, fields, messageId, successMessage) {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("The invitation is not connected yet. The family still needs to finish the Google setup.");
  }
  const requestId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const values = { action, ...fields, website: "", request_id: requestId };
  const body = new URLSearchParams();
  Object.entries(values).forEach(([name, value]) => body.set(name, String(value ?? "")));

  // no-cors allows the browser to POST to Apps Script without trying to frame its response.
  await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body
  });

  const result = await checkSubmission(requestId);
  const confirmation = result.message || successMessage || "Saved!";
  if (messageId) setMessage(messageId, confirmation);
  showToast(confirmation);
  return result;
}

$("rsvp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    name: form.get("name").trim(),
    email: form.get("email").trim(),
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
let elapsedTimer;
let startedAt = 0;
let seconds = 0;
const MAX_RECORDING_SECONDS = 30;

function updateClock() {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  $("recording-time").textContent = `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
function resetRecording() {
  clearInterval(elapsedTimer);
  if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
  recordingStream = null;
  recorder = null;
  chunks = [];
  audioBlob = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  $("preview-audio").removeAttribute("src");
  $("voice-review").hidden = true;
  $("record-controls").hidden = false;
  $("record-button").hidden = false;
  $("record-button").disabled = false;
  $("record-button").classList.remove("is-recording");
  $("record-label").textContent = "START RECORDING";
  $("stop-button").hidden = true;
  $("stop-button").disabled = true;
  $("submit-voice").disabled = true;
  $("voice-name").value = "";
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
      $("record-controls").hidden = true;
      $("voice-review").hidden = false;
      $("submit-voice").disabled = seconds === 0;
      recordingStream?.getTracks().forEach(track => track.stop());
      recordingStream = null;
      setMessage("voice-message", "Listen back, then submit when you're happy with it.");
    };
    recorder.start();
    startedAt = Date.now();
    seconds = 0;
    updateClock();
    $("record-button").classList.add("is-recording");
    $("record-label").textContent = "RECORDING…";
    $("stop-button").hidden = false;
    $("stop-button").disabled = false;
    $("submit-voice").disabled = true;
    elapsedTimer = setInterval(() => {
      seconds = Math.floor((Date.now() - startedAt) / 1000);
      updateClock();
      if (seconds >= MAX_RECORDING_SECONDS) stopRecording();
    }, 250);
  } catch (error) { setMessage("voice-message", error.message); }
});
function stopRecording() {
  if (recorder?.state === "recording") {
    clearInterval(elapsedTimer);
    seconds = Math.floor((Date.now() - startedAt) / 1000);
    updateClock();
    recorder.stop();
    $("record-button").classList.remove("is-recording");
    $("stop-button").hidden = true;
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
  if (!name) { setMessage("voice-message", "Please add your name first."); $("voice-name").focus(); return; }
  if (!audioBlob || seconds === 0) {
    setMessage("voice-message", "Please record a message before submitting.");
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


// Scroll-driven opening: portrait reveal with responsive invitation-card entrance.
(() => {
  const scene = document.querySelector(".hero-image-scene");
  const frame = scene?.querySelector(".hero-image");
  const image = frame?.querySelector("img");
  const card = document.querySelector(".hero-details .hero-copy");
  if (!scene || !frame || !image || !card) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  const mobile = window.matchMedia("(max-width: 600px)");
  let raf = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const ease = value => value * value * (3 - 2 * value);

  function update() {
    raf = 0;
    const viewportH = window.visualViewport?.height || window.innerHeight;
    const sceneTop = scene.getBoundingClientRect().top;
    const distanceIntoScene = viewportH - 20 - sceneTop;
    const progress = clamp(distanceIntoScene / (viewportH * 1.2), 0, 1);

    if (mobile.matches) {
      // Reveal the portrait first, using the card's exact rendered height so
      // the two surfaces lock together without a size mismatch.
      const reveal = ease(clamp(progress / 0.45, 0, 1));
      const height = card.getBoundingClientRect().height || viewportH * 0.56;
      const startTop = viewportH - 20;
      const centeredTop = (viewportH - height) / 2;
      const top = startTop + (centeredTop - startTop) * reveal;
      frame.style.top = top + "px";
      frame.style.width = (60 + 40 * reveal) + "vw";
      frame.style.height = height + "px";
      frame.style.borderRadius = "0";
      image.style.transform = "scale(1.04)";

      // Hold the portrait completely still after it locks into place.
      // Only then does the card begin its entrance, overlaying the image
      // at exactly the same width and height.
      const cardProgress = ease(clamp((progress - 0.50) / 0.50, 0, 1));
      const cardTop = (viewportH - height) / 2;
      const cardY = cardTop + (viewportH - cardTop) * (1 - cardProgress);
      card.style.height = height + "px";
      card.style.boxSizing = "border-box";
      card.style.transform = "translateY(" + cardY + "px)";
      card.style.opacity = "0.7";
      return;
    }

    // Desktop: portrait rises, opens to full width, then takes over the viewport.
    const travelProgress = ease(clamp(progress / 0.45, 0, 1));
    const zoomProgress = ease(clamp((travelProgress - 0.5) / 0.5, 0, 1));
    const portraitHeight = 20 + (viewportH * 0.56 - 20) * zoomProgress;
    const portraitTop = (viewportH - portraitHeight) * (1 - travelProgress / 2);
    const takeoverProgress = ease(clamp((progress - 0.45) / 0.55, 0, 1));
    const height = portraitHeight + (viewportH - portraitHeight) * takeoverProgress;
    const top = portraitTop * (1 - takeoverProgress);

    frame.style.top = top + "px";
    frame.style.width = (70 + 30 * zoomProgress) + "vw";
    frame.style.height = height + "px";
    frame.style.borderRadius = ((1 - progress) * 3) + "px";
    image.style.transform = "scale(" + (1.2 - zoomProgress * 0.2) + ")";

    // Preserve the previous desktop entrance; the desktop portrait is full-screen.
    const cardProgress = ease(clamp((progress - 0.45) / 0.27, 0, 1));
    card.style.transform = "translateY(" + ((1 - cardProgress) * viewportH) + "px)";
    card.style.opacity = "0.7";
  }

  function requestUpdate() {
    if (!raf) raf = window.requestAnimationFrame(update);
  }

  function resize() {
    const viewportH = window.visualViewport?.height || window.innerHeight;
    // Mobile needs a short pinned hold for the card entrance. Desktop retains
    // its original long scroll-driven portrait sequence.
    scene.style.height = (viewportH * (mobile.matches ? 2.2 : 340)) + "px";
    requestUpdate();
  }

  resize();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  window.visualViewport?.addEventListener("resize", resize);
  mobile.addEventListener?.("change", requestUpdate);
  update();
})();
