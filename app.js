import { samples, builtInReply, detectedObjects } from "./replies.js";
const $ = (id) => document.getElementById(id);
let source = "sample",
  target = "cup",
  stream,
  detector,
  detectorPromise,
  cameraSession = 0,
  timer;
let busy = false,
  voice = false,
  listening = false,
  generator,
  ai = false,
  chatSession = 0;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = Recognition ? new Recognition() : null;
const hasVoice =
  "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
function setTarget(value) {
  target = value;
  $("objectTag").textContent = value
    ? `${value} · ${source === "sample" ? "sample" : "detected"}`
    : "Looking for objects…";
  $("chatInput").placeholder = value
    ? `Ask your ${value} something…`
    : "Point the camera at an object first…";
  $("chatStatus").textContent = value
    ? `Ready to chat with your ${value}.`
    : "No object in view. Try samples or point at a common object.";
  if (source === "sample") $("sampleEmoji").textContent = samples[value];
}
function log(sender, text, user = false) {
  $("emptyChat")?.remove();
  const message = document.createElement("p");
  message.className = `message ${user ? "user" : "object"}`;
  const name = document.createElement("strong");
  name.textContent = sender;
  message.append(name, document.createTextNode(text));
  $("chatLog").append(message);
  while ($("chatLog").children.length > 80)
    $("chatLog").firstElementChild.remove();
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
function stopListening() {
  listening = false;
  recognition?.abort();
  $("micBtn").textContent = recognition
    ? "Use microphone"
    : "Microphone unavailable";
  $("micBtn").setAttribute("aria-pressed", "false");
}
function speak(text) {
  if (!voice || !hasVoice) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}
async function send(message) {
  message = message.trim().slice(0, 500);
  if (!message || busy) return;
  if (!target) {
    $("chatStatus").textContent =
      "Choose a sample or wait for an object to appear.";
    return;
  }
  stopListening();
  const object = target,
    session = chatSession,
    playful = $("tone").value === "funny";
  busy = true;
  $("sendBtn").disabled = true;
  $("micBtn").disabled = true;
  $("chatInput").value = "";
  log("You", message, true);
  $("chatStatus").textContent = `Your ${object} is thinking…`;
  let reply = builtInReply(object, message, playful),
    failed = false;
  try {
    if (ai && generator) {
      const prompt = `Answer this question as a ${playful ? "playful" : "friendly"} ${object}: ${message}`;
      const result = await generator(prompt, {
        max_new_tokens: 64,
        min_new_tokens: 1,
        repetition_penalty: 1.2,
      });
      reply = result[0]?.generated_text?.trim();
      if (!reply) throw new Error("Empty response");
    }
  } catch (error) {
    console.warn("Language model generation failed:", error.message);
    failed = true;
    reply = builtInReply(object, message, playful);
  } finally {
    if (session === chatSession) {
      log(object, reply);
      speak(reply);
      $("chatStatus").textContent = failed
        ? "Language model failed. Used a built-in reply; you can try again."
        : `Reply from your ${object}.`;
    }
    busy = false;
    $("sendBtn").disabled = false;
    $("micBtn").disabled = !recognition;
    $("chatInput").focus();
  }
}
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error("Download timed out"));
    }, 30000);
    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error("Download failed"));
    };
    document.head.append(script);
  });
}
async function loadDetector() {
  if (detector) return detector;
  if (!detectorPromise)
    detectorPromise = (async () => {
      if (!window.tf)
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
        );
      if (!window.cocoSsd)
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
        );
      detector = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
      return detector;
    })().catch((error) => {
      detectorPromise = null;
      throw error;
    });
  return detectorPromise;
}
function stopCamera() {
  cameraSession++;
  clearTimeout(timer);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  $("camera").srcObject = null;
}
function showSamples(status = "Sample mode is ready. Choose an object below.") {
  stopCamera();
  source = "sample";
  $("camera").hidden = true;
  $("overlay").hidden = true;
  $("sampleScene").hidden = false;
  $("sampleBtn").hidden = true;
  $("cameraBtn").disabled = false;
  $("cameraBtn").textContent = "Use my camera";
  $("sourceBadge").textContent = "SAMPLE SCENE";
  $("objectSelect").replaceChildren(
    ...Object.keys(samples).map(
      (name) => new Option(name[0].toUpperCase() + name.slice(1), name),
    ),
  );
  $("objectSelect").disabled = false;
  $("selectionHint").textContent =
    "Sample objects are illustrative, not live detections.";
  $("cameraStatus").textContent = status;
  setTarget($("objectSelect").value);
}
async function detect(session) {
  if (session !== cameraSession || source !== "camera") return;
  try {
    const predictions = await detector.detect($("camera"));
    if (session !== cameraSession) return;
    const objects = detectedObjects(predictions),
      canvas = $("overlay"),
      ctx = canvas.getContext("2d");
    canvas.width = $("camera").videoWidth;
    canvas.height = $("camera").videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#c0ed91";
    ctx.fillStyle = "#c0ed91";
    ctx.lineWidth = 3;
    ctx.font = "16px sans-serif";
    for (const pred of objects) {
      ctx.strokeRect(...pred.bbox);
      ctx.fillText(
        `${pred.class} ${Math.round(pred.score * 100)}%`,
        pred.bbox[0] + 4,
        Math.max(20, pred.bbox[1] - 8),
      );
    }
    const names = objects.map((p) => p.class),
      next = names.includes(target) ? target : names[0] || "";
    const currentNames = [...$("objectSelect").options]
      .map((o) => o.value)
      .filter(Boolean);
    if (names.join() !== currentNames.join())
      $("objectSelect").replaceChildren(
        ...(names.length
          ? objects.map(
              (p) =>
                new Option(
                  `${p.class} · ${Math.round(p.score * 100)}%`,
                  p.class,
                ),
            )
          : [new Option("No objects detected", "")]),
      );
    $("objectSelect").value = next;
    $("objectSelect").disabled = !names.length;
    if (target !== next) setTarget(next);
    $("cameraStatus").textContent = names.length
      ? `${names.length} object type${names.length === 1 ? "" : "s"} detected. Choose who to talk to.`
      : "No confident detection. Try a cup, chair, book, or person in good light.";
    timer = setTimeout(() => detect(session), 350);
  } catch {
    if (session === cameraSession)
      showSamples(
        "Detection stopped. Try the camera again, or continue with samples.",
      );
  }
}
$("cameraBtn").addEventListener("click", async () => {
  if (source === "camera") {
    showSamples();
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $("cameraStatus").textContent =
      "Camera needs HTTPS or localhost and a supported browser. Samples still work.";
    return;
  }
  stopCamera();
  const session = cameraSession;
  $("cameraBtn").disabled = true;
  $("sampleBtn").hidden = false;
  $("cameraStatus").textContent =
    "Allow camera access when your browser asks. No microphone is requested.";
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    if (session !== cameraSession) {
      acquired.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = acquired;
    $("camera").srcObject = stream;
    await $("camera").play();
    if (session !== cameraSession) return;
    $("cameraStatus").textContent =
      "Downloading object detector. First load needs an internet connection…";
    await loadDetector();
    if (session !== cameraSession) return;
    source = "camera";
    $("camera").hidden = false;
    $("overlay").hidden = false;
    $("sampleScene").hidden = true;
    $("sourceBadge").textContent = "LIVE CAMERA";
    $("selectionHint").textContent =
      "Objects above 60% confidence. Selection follows the object while it is visible.";
    $("cameraBtn").disabled = false;
    $("cameraBtn").textContent = "Stop camera";
    setTarget("");
    detect(session);
  } catch (error) {
    if (session !== cameraSession) return;
    const messages = {
      NotAllowedError:
        "Camera permission was denied. Allow access in browser settings, then try again.",
      NotFoundError: "No camera found. Connect a camera or use samples.",
      NotReadableError:
        "Camera is busy. Close other apps using it, then try again.",
    };
    showSamples(
      messages[error.name] ||
        "Camera or detector could not start. Check your connection and retry. Samples still work.",
    );
  }
});
$("sampleBtn").addEventListener("click", () => showSamples());
$("objectSelect").addEventListener("change", () =>
  setTarget($("objectSelect").value),
);
$("chatForm").addEventListener("submit", (event) => {
  event.preventDefault();
  send($("chatInput").value);
});
document
  .querySelectorAll("[data-prompt]")
  .forEach((button) =>
    button.addEventListener("click", () => send(button.dataset.prompt)),
  );
$("clearBtn").addEventListener("click", () => {
  chatSession++;
  $("chatLog").replaceChildren();
  stopListening();
  if (hasVoice) window.speechSynthesis.cancel();
  $("chatStatus").textContent =
    "Conversation cleared. Start again whenever you like.";
});
$("voiceBtn").disabled = !hasVoice;
if (!hasVoice) $("voiceBtn").textContent = "Voice unavailable";
$("voiceBtn").addEventListener("click", () => {
  voice = !voice;
  $("voiceBtn").textContent = voice ? "Voice on" : "Voice off";
  $("voiceBtn").setAttribute("aria-pressed", String(voice));
  if (voice) speak("Voice is ready.");
  else window.speechSynthesis.cancel();
});
if (recognition) {
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    stopListening();
    send(transcript);
  };
  recognition.onend = () => {
    if (listening) {
      stopListening();
      $("chatStatus").textContent =
        "Microphone finished. Tap to try again, or type a message.";
    }
  };
  recognition.onerror = (event) => {
    stopListening();
    $("chatStatus").textContent =
      event.error === "not-allowed"
        ? "Microphone permission denied. You can still type."
        : "Could not hear a message. Try again or type instead.";
  };
} else {
  $("micBtn").disabled = true;
  $("micBtn").textContent = "Microphone unavailable";
}
$("micBtn").addEventListener("click", () => {
  if (listening) {
    stopListening();
    $("chatStatus").textContent = "Microphone stopped.";
    return;
  }
  if (!target) {
    $("chatStatus").textContent = "Choose an object first.";
    return;
  }
  if (hasVoice) window.speechSynthesis.cancel();
  try {
    recognition.start();
    listening = true;
    $("micBtn").textContent = "Stop microphone";
    $("micBtn").setAttribute("aria-pressed", "true");
    $("chatStatus").textContent = "Listening for one message…";
  } catch {
    stopListening();
    $("chatStatus").textContent = "Microphone is not ready. Try again or type.";
  }
});
$("aiBtn").addEventListener("click", async () => {
  if (generator) {
    ai = !ai;
    $("aiBtn").textContent = ai ? "Use built-in replies" : "Use language model";
    $("aiBtn").setAttribute("aria-pressed", String(ai));
    $("aiStatus").textContent = ai
      ? "Experimental language model active."
      : "Built-in replies active.";
    return;
  }
  $("aiBtn").disabled = true;
  $("aiStatus").textContent =
    "Downloading language model… This may take several minutes.";
  try {
    const { pipeline } = await import(
      "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2"
    );
    generator = await pipeline("text2text-generation", "Xenova/flan-t5-small", {
      progress_callback: (progress) => {
        if (progress.status === "progress")
          $("aiStatus").textContent =
            `Downloading ${progress.file}: ${Math.round(progress.progress || 0)}%`;
      },
    });
    ai = true;
    $("aiBtn").textContent = "Use built-in replies";
    $("aiBtn").setAttribute("aria-pressed", "true");
    $("aiStatus").textContent =
      "Experimental language model ready. Replies may be inaccurate.";
  } catch {
    $("aiStatus").textContent =
      "Language model failed to load. Check your connection and retry; built-in replies still work.";
  } finally {
    $("aiBtn").disabled = false;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopListening();
    if (hasVoice) window.speechSynthesis.cancel();
    if (stream || $("cameraBtn").disabled)
      showSamples(
        "Camera stopped while the tab was hidden. Start it again when ready.",
      );
  }
});
window.addEventListener("pagehide", () => {
  stopCamera();
  stopListening();
  if (hasVoice) window.speechSynthesis.cancel();
});
