const MAX_UPLOAD_SIZE_MB = 20;
const MAX_DURATION_SECONDS = 120;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
const TARGET_SAMPLE_RATE = 22050;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?";

const COPY = {
  exactTitle: "Точный",
  exactDescription:
    "Фиксируется на нормализованном PCM и стабильно повторяет результат для одного и того же аудио.",
  robustTitle: "Устойчивый",
  robustDescription:
    "Ориентируется на доминирующую спектральную структуру, чтобы похожие записи оставались ближе.",
  signalLoaded: "Сигнал загружен",
  waitingSignal: "Ожидание сигнала",
  pcmLock: "PCM lock",
  spectralDrift: "Spectral drift",
  chooseFileError: "Сначала выберите аудиофайл.",
  emptyFileError: "Загруженный файл пуст.",
  decodeFailed: "Не удалось декодировать аудиофайл. Проверьте формат и целостность файла.",
  genericError: "Не удалось обработать аудио.",
  trimFailed: "Не удалось подготовить обрезанную версию этого аудио.",
  passwordCopied: "Скопировано",
  progressWaiting: "Подготовка аудиопотока",
  progressAnalyzing: "Анализ спектрального отпечатка",
  progressEncoding: "Формирование пароля",
  trimBadge: "Аудио обрезано на этом устройстве перед анализом"
};

const MODE_DEFINITIONS = {
  exact: {
    label: COPY.exactTitle,
    description: COPY.exactDescription,
    tag: "exact"
  },
  robust: {
    label: COPY.robustTitle,
    description: COPY.robustDescription,
    tag: "robust"
  }
};

const ALGORITHM_DEFINITIONS = {
  exact: {
    label: "PCM SHA-256",
    tag: "PCM16",
    description:
      "Хеш нормализованного PCM-потока. Даёт максимально повторяемый результат для одного и того же аудиофайла."
  },
  robust: {
    label: "Spectral Peaks",
    tag: "PEAKS",
    description:
      "Хеш квантованных спектральных пиков. Лучше переносит похожие версии одной и той же записи."
  }
};

let currentMode = "exact";
let currentFile = null;
let currentAudioUrl = null;
let currentPassword = "";
let passwordVisible = false;
let trimOnUpload = false;
let pendingOversizedFile = null;
let pendingOversizedDuration = 0;
let progressTimer = null;

let audioContext = null;
let analyserNode = null;
let mediaSourceNode = null;
let visualizerFrame = null;

const modeButtons = Array.from(document.querySelectorAll(".mode-segment"));
const audioInput = document.getElementById("audio-input");
const fileName = document.getElementById("file-name");
const dropzoneTitle = document.getElementById("dropzone-title");
const audioPreview = document.getElementById("audio-preview");
const audioPreviewBlock = document.getElementById("audio-preview-block");
const generateButton = document.getElementById("generate-button");
const form = document.getElementById("generator-form");
const progressPanel = document.getElementById("progress-panel");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const emptyState = document.getElementById("empty-state");
const resultStack = document.getElementById("result-stack");
const passwordBlock = document.getElementById("password-block");
const togglePasswordButton = document.getElementById("toggle-password");
const copyPasswordButton = document.getElementById("copy-password");
const resultModeLabel = document.getElementById("result-mode-label");
const resultModeTag = document.getElementById("result-mode-tag");
const resultAlgorithmLabel = document.getElementById("result-algorithm-label");
const resultAlgorithmTag = document.getElementById("result-algorithm-tag");
const modeTooltipResult = document.getElementById("mode-tooltip-result").querySelector(".tooltip-copy");
const algorithmTooltipResult = document.getElementById("algorithm-tooltip-result").querySelector(".tooltip-copy");
const errorMessage = document.getElementById("error-message");
const logoRing = document.getElementById("logo-ring");
const trimBadge = document.getElementById("trim-badge");
const signalStatus = document.getElementById("signal-status");
const modeStatus = document.getElementById("mode-status");
const eyePath = document.getElementById("eye-path");
const eyeCircle = document.getElementById("eye-circle");
const visualizer = document.getElementById("music-visualizer");
const limitModalBackdrop = document.getElementById("limit-modal-backdrop");
const limitModalTitle = document.getElementById("limit-modal-title");
const limitModalFile = document.getElementById("limit-modal-file");
const limitModalLimit = document.getElementById("limit-modal-limit");
const trimActionButton = document.getElementById("trim-action-button");
const replaceActionButton = document.getElementById("replace-action-button");

function buildLogo() {
  // The desktop logo uses the same radial bars as the web header.
  for (let index = 0; index < 64; index += 1) {
    const bar = document.createElement("span");
    const angle = index * 5.625;
    const height = 10 + ((index * 7) % 18);
    const accent = index % 9 === 0;
    bar.className = accent ? "logo-bar logo-bar-accent" : "logo-bar";
    bar.style.setProperty("--rotation", `${angle}deg`);
    bar.style.setProperty("--bar-height", `${height}px`);
    logoRing.appendChild(bar);
  }
}

function buildVisualizer() {
  // Prebuild the bars once and only animate their scale during playback.
  visualizer.innerHTML = "";

  for (let index = 0; index < 28; index += 1) {
    const bar = document.createElement("span");
    bar.className = "visualizer-bar";
    bar.style.setProperty("--bar-scale", "0.18");
    bar.style.setProperty("--bar-delay", `${index * 30}ms`);
    visualizer.appendChild(bar);
  }
}

function setVisualizerBars(values) {
  const bars = visualizer.querySelectorAll(".visualizer-bar");
  bars.forEach((bar, index) => {
    const nextValue = values[index] ?? 0.18;
    bar.style.setProperty("--bar-scale", `${Math.max(0.18, nextValue)}`);
  });
}

function resetVisualizer() {
  visualizer.classList.remove("music-visualizer-active");
  setVisualizerBars(Array.from({ length: 28 }, () => 0.18));
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function setError(message) {
  if (!message) {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
    return;
  }

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function setProgress(visible, percent = 0, label = "") {
  progressPanel.classList.toggle("hidden", !visible);
  progressFill.style.width = `${percent}%`;
  progressLabel.textContent = label;
}

function startProgressLoop() {
  // A staged progress loop makes local processing feel less abrupt.
  const stages = [
    { limit: 24, label: COPY.progressWaiting },
    { limit: 72, label: COPY.progressAnalyzing },
    { limit: 92, label: COPY.progressEncoding }
  ];

  let current = 8;
  setProgress(true, current, stages[0].label);

  progressTimer = window.setInterval(() => {
    current = Math.min(current + 6, 92);
    const stage = stages.find((entry) => current <= entry.limit) ?? stages[stages.length - 1];
    setProgress(true, current, stage.label);
  }, 240);
}

function stopProgressLoop() {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
}

function maskPassword(password) {
  return "*".repeat(password.length);
}

function renderPassword() {
  passwordBlock.textContent = passwordVisible ? currentPassword : maskPassword(currentPassword);
  togglePasswordButton.title = passwordVisible ? "Скрыть пароль" : "Показать пароль";
  togglePasswordButton.setAttribute("aria-label", passwordVisible ? "Скрыть пароль" : "Показать пароль");

  if (passwordVisible) {
    eyePath.setAttribute("d", "M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z");
    eyeCircle.classList.remove("hidden");
  } else {
    eyePath.setAttribute(
      "d",
      "M3 4.5 20 19.5M6.1 7.2C7.8 5.9 9.8 5.2 12 5.2c6.7 0 10.5 6.8 10.5 6.8-.8 1.4-1.8 2.6-2.9 3.7M9 9.3a4 4 0 0 1 5.5 5.5M1.5 12c.8-1.3 1.8-2.5 3-3.6m2.2 8.2A11 11 0 0 0 12 18.5"
    );
    eyeCircle.classList.add("hidden");
  }
}

function updateModeButtons() {
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("mode-segment-active", active);
  });

  modeStatus.textContent = currentMode === "exact" ? COPY.pcmLock : COPY.spectralDrift;
}

function updateResultMeta(mode) {
  const modeDefinition = MODE_DEFINITIONS[mode];
  const algorithmDefinition = ALGORITHM_DEFINITIONS[mode];

  resultModeLabel.textContent = modeDefinition.label;
  resultModeTag.textContent = modeDefinition.tag;
  resultAlgorithmLabel.textContent = algorithmDefinition.label;
  resultAlgorithmTag.textContent = algorithmDefinition.tag;
  modeTooltipResult.textContent = modeDefinition.description;
  algorithmTooltipResult.textContent = algorithmDefinition.description;
}

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function passwordFromDigest(digest, length = 18) {
  // Keep the generated password readable while still forcing mixed character classes.
  const alphabetLength = PASSWORD_ALPHABET.length;
  const characters = Array.from({ length }, (_, index) => {
    const fragment = digest.slice(index * 2, index * 2 + 2);
    return PASSWORD_ALPHABET[Number.parseInt(fragment, 16) % alphabetLength];
  });

  let password = characters.join("");

  if (!/[A-Z]/.test(password)) password = `A${password.slice(1)}`;
  if (!/[a-z]/.test(password)) password = `${password.slice(0, -1)}b`;
  if (!/[0-9]/.test(password)) password = `${password.slice(0, -2)}7${password.slice(-1)}`;
  if (!/[^A-Za-z0-9]/.test(password)) password = `${password.slice(0, -3)}!${password.slice(-2)}`;

  return password;
}

function mixToMono(channels) {
  // Matching the web/backend mono path keeps the offline build predictable.
  if (channels.length === 1) {
    return channels[0];
  }

  const mono = new Float32Array(channels[0].length);
  for (let index = 0; index < mono.length; index += 1) {
    let sum = 0;
    for (const channel of channels) {
      sum += channel[index] ?? 0;
    }
    mono[index] = sum / channels.length;
  }

  return mono;
}

function resampleMono(samples, sourceRate, targetRate) {
  if (sourceRate === targetRate) {
    return samples;
  }

  const duration = samples.length / sourceRate;
  const targetLength = Math.max(1, Math.round(duration * targetRate));
  const output = new Float32Array(targetLength);
  const ratio = sourceRate / targetRate;

  for (let index = 0; index < targetLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    const weight = position - left;
    output[index] = samples[left] * (1 - weight) + samples[right] * weight;
  }

  return output;
}

function normalizeAudio(samples) {
  // Centering and peak normalization keep the fingerprint stable across loudness changes.
  let sum = 0;
  for (const sample of samples) {
    sum += sample;
  }
  const mean = sum / samples.length;

  let peak = 0;
  const centered = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] - mean;
    centered[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  if (peak === 0) {
    throw new Error("Аудио оказалось пустым после нормализации.");
  }

  for (let index = 0; index < centered.length; index += 1) {
    centered[index] = Math.max(-1, Math.min(1, centered[index] / peak));
  }

  return centered;
}

function floatToPcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

function serializeRobustFingerprint(samples) {
  // The desktop robust mode uses a light-weight local approximation of spectral peaks.
  const frameSize = 512;
  const hopSize = 256;
  const bandCount = 8;
  const frames = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const bandEnergy = new Array(bandCount).fill(0);
    for (let index = 0; index < frameSize; index += 1) {
      const bandIndex = Math.min(bandCount - 1, Math.floor((index / frameSize) * bandCount));
      bandEnergy[bandIndex] += Math.abs(samples[start + index]);
    }

    const ranked = bandEnergy
      .map((value, index) => ({ index, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
      .map((entry) => entry.index)
      .sort((left, right) => left - right);

    frames.push(`${frames.length % 97}:${ranked.join(",")}`);
  }

  return frames.join("|");
}

async function getAudioDurationSeconds(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = objectUrl;

    const duration = await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
        reject(new Error("Audio metadata timed out."));
      }, 4000);

      audio.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        resolve(audio.duration);
      };

      audio.onerror = () => reject(new Error("Audio metadata could not be read."));
      audio.load();
    });

    return Number.isFinite(duration) ? duration : 0;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function encodeWavFromMono(samples, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function trimAudioInBrowser(file, targetDurationSeconds) {
  // Oversized files are trimmed before analysis so the offline app stays responsive.
  if (file.size === 0) {
    throw new Error(COPY.emptyFileError);
  }

  const context = new AudioContext();

  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(sourceBuffer.slice(0));
    const frameLimit = Math.min(decoded.length, Math.max(1, Math.floor(targetDurationSeconds * decoded.sampleRate)));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index).slice(0, frameLimit)
    );
    const mono = mixToMono(channels);
    const resampled = resampleMono(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
    const trimmedBlob = encodeWavFromMono(resampled, TARGET_SAMPLE_RATE);
    const baseName = file.name.replace(/\.[^.]+$/, "");

    return new File([trimmedBlob], `${baseName}-trimmed.wav`, {
      type: "audio/wav",
      lastModified: Date.now()
    });
  } finally {
    await context.close();
  }
}

async function decodeAndNormalize(file) {
  // This is the shared preparation step for both password modes.
  if (file.size === 0) {
    throw new Error(COPY.emptyFileError);
  }

  const context = new AudioContext();

  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(sourceBuffer.slice(0));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const mono = mixToMono(channels);
    const resampled = resampleMono(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
    return normalizeAudio(resampled);
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }

    throw new Error(COPY.decodeFailed);
  } finally {
    await context.close();
  }
}

async function generateFromFile(file, mode) {
  const normalized = await decodeAndNormalize(file);

  if (mode === "exact") {
    const pcm = floatToPcm16(normalized);
    const digest = await sha256Hex(new Uint8Array(pcm.buffer));
    return {
      password: passwordFromDigest(digest),
      mode,
      algorithm: "exact"
    };
  }

  const payload = new TextEncoder().encode(serializeRobustFingerprint(normalized));
  const digest = await sha256Hex(payload);
  return {
    password: passwordFromDigest(digest),
    mode,
    algorithm: "robust"
  };
}

function revokeAudioUrl() {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

function setCurrentFile(file) {
  currentFile = file;
  fileName.textContent = file ? file.name : "Файл не выбран";
  dropzoneTitle.textContent = file ? file.name : "Перетащите WAV или MP3 сюда или выберите файл вручную.";
  signalStatus.textContent = file ? COPY.signalLoaded : COPY.waitingSignal;
  trimBadge.classList.toggle("hidden", !trimOnUpload);
  trimBadge.textContent = COPY.trimBadge;

  revokeAudioUrl();
  stopVisualizer();

  if (!file) {
    audioPreview.removeAttribute("src");
    audioPreviewBlock.classList.add("hidden");
    generateButton.disabled = true;
    return;
  }

  currentAudioUrl = URL.createObjectURL(file);
  audioPreview.src = currentAudioUrl;
  audioPreviewBlock.classList.remove("hidden");
  generateButton.disabled = false;
}

function showLimitModal(file, durationSeconds) {
  pendingOversizedFile = file;
  pendingOversizedDuration = durationSeconds;
  limitModalTitle.textContent = file.name;
  limitModalLimit.textContent = `Текущий лимит: ${MAX_UPLOAD_SIZE_MB} МБ / ${formatDuration(MAX_DURATION_SECONDS)}`;
  limitModalFile.textContent = `Файл: ${(file.size / (1024 * 1024)).toFixed(1)} МБ / ${formatDuration(durationSeconds)}`;
  limitModalBackdrop.classList.remove("hidden");
}

function hideLimitModal() {
  limitModalBackdrop.classList.add("hidden");
  pendingOversizedFile = null;
  pendingOversizedDuration = 0;
}

async function handleFileSelection(file) {
  if (!file) {
    return;
  }

  if (file.size === 0) {
    trimOnUpload = false;
    setCurrentFile(null);
    setError(COPY.emptyFileError);
    return;
  }

  const durationSeconds = await getAudioDurationSeconds(file).catch(() => 0);
  const tooLarge = file.size > MAX_UPLOAD_SIZE_BYTES;
  const tooLong = durationSeconds > MAX_DURATION_SECONDS;

  setError("");
  emptyState.classList.remove("hidden");
  resultStack.classList.add("hidden");

  if (tooLarge || tooLong) {
    showLimitModal(file, durationSeconds);
    return;
  }

  trimOnUpload = false;
  setCurrentFile(file);
}

async function connectAudioVisualizer() {
  // Reuse a single audio graph so repeated playback stays smooth.
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (!analyserNode) {
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.82;
  }

  if (!mediaSourceNode) {
    mediaSourceNode = audioContext.createMediaElementSource(audioPreview);
    mediaSourceNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function animateVisualizer() {
  if (!analyserNode) {
    return;
  }

  const spectrum = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(spectrum);

  // Bucket the analyser output into a compact retro-style equalizer.
  const barCount = 28;
  const bucketSize = Math.max(1, Math.floor(spectrum.length / barCount));
  const nextBars = Array.from({ length: barCount }, (_, index) => {
    let total = 0;
    const start = index * bucketSize;
    const end = Math.min(spectrum.length, start + bucketSize);

    for (let bucket = start; bucket < end; bucket += 1) {
      total += spectrum[bucket] ?? 0;
    }

    const average = total / Math.max(1, end - start);
    return Math.max(0.14, average / 255);
  });

  visualizer.classList.add("music-visualizer-active");
  setVisualizerBars(nextBars);
  visualizerFrame = window.requestAnimationFrame(animateVisualizer);
}

async function startVisualizer() {
  try {
    await connectAudioVisualizer();

    if (visualizerFrame !== null) {
      window.cancelAnimationFrame(visualizerFrame);
    }

    visualizerFrame = window.requestAnimationFrame(animateVisualizer);
  } catch {
    visualizer.classList.add("music-visualizer-active");
  }
}

function stopVisualizer() {
  if (visualizerFrame !== null) {
    window.cancelAnimationFrame(visualizerFrame);
    visualizerFrame = null;
  }

  resetVisualizer();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    updateModeButtons();
  });
});

audioInput.addEventListener("change", async () => {
  const file = audioInput.files?.[0] ?? null;
  audioInput.value = "";
  await handleFileSelection(file);
});

audioPreview.addEventListener("play", () => {
  void startVisualizer();
});

audioPreview.addEventListener("pause", stopVisualizer);
audioPreview.addEventListener("ended", stopVisualizer);

togglePasswordButton.addEventListener("click", () => {
  passwordVisible = !passwordVisible;
  renderPassword();
});

copyPasswordButton.addEventListener("click", async () => {
  if (!currentPassword) {
    return;
  }

  await navigator.clipboard.writeText(currentPassword);
  copyPasswordButton.classList.add("icon-button-done");
  copyPasswordButton.title = COPY.passwordCopied;
  copyPasswordButton.setAttribute("aria-label", COPY.passwordCopied);
  window.setTimeout(() => {
    copyPasswordButton.classList.remove("icon-button-done");
    copyPasswordButton.title = "Скопировать пароль";
    copyPasswordButton.setAttribute("aria-label", "Скопировать пароль");
  }, 1200);
});

trimActionButton.addEventListener("click", async () => {
  if (!pendingOversizedFile) {
    hideLimitModal();
    return;
  }

  trimActionButton.disabled = true;
  replaceActionButton.disabled = true;
  trimActionButton.textContent = "Подготовка обрезанного аудио...";

  try {
    const targetDurationSeconds = Math.min(
      MAX_DURATION_SECONDS,
      Math.max(1, Math.floor(pendingOversizedDuration || MAX_DURATION_SECONDS))
    );
    const trimmed = await trimAudioInBrowser(pendingOversizedFile, targetDurationSeconds);
    trimOnUpload = true;
    setCurrentFile(trimmed);
    hideLimitModal();
  } catch {
    trimOnUpload = false;
    setError(COPY.trimFailed);
    hideLimitModal();
  } finally {
    trimActionButton.disabled = false;
    replaceActionButton.disabled = false;
    trimActionButton.textContent = "Обрезать и продолжить";
  }
});

replaceActionButton.addEventListener("click", () => {
  trimOnUpload = false;
  setCurrentFile(null);
  hideLimitModal();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentFile) {
    setError(COPY.chooseFileError);
    return;
  }

  try {
    setError("");
    emptyState.classList.add("hidden");
    resultStack.classList.add("hidden");
    startProgressLoop();

    const result = await generateFromFile(currentFile, currentMode);

    stopProgressLoop();
    setProgress(true, 100, COPY.progressEncoding);
    currentPassword = result.password;
    passwordVisible = false;
    renderPassword();
    updateResultMeta(result.mode);
    resultStack.classList.remove("hidden");

    window.setTimeout(() => setProgress(false, 0, ""), 700);
  } catch (error) {
    stopProgressLoop();
    setProgress(false, 0, "");
    setError(error instanceof Error ? error.message : COPY.genericError);
  }
});

window.addEventListener("beforeunload", () => {
  revokeAudioUrl();
  stopProgressLoop();
  stopVisualizer();

  if (mediaSourceNode) {
    mediaSourceNode.disconnect();
  }

  if (analyserNode) {
    analyserNode.disconnect();
  }

  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close();
  }
});

buildLogo();
buildVisualizer();
updateModeButtons();
updateResultMeta(currentMode);
renderPassword();
resetVisualizer();
