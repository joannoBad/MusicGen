const MAX_UPLOAD_SIZE_MB = 20;
const MAX_DURATION_SECONDS = 120;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
const TARGET_SAMPLE_RATE = 22050;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?";

const I18N = {
  en: {
    title: "MusicGen Desktop",
    heroEyebrow: "Offline mode with no internet required",
    heroLede: "The desktop build generates the password entirely on this device. Audio never leaves the app and can be processed offline.",
    input: "Input",
    uploadAudio: "Upload audio",
    output: "Result",
    resultTitle: "Generated password",
    signalLoaded: "Signal loaded",
    waitingSignal: "Waiting for signal",
    pcmLock: "PCM lock",
    spectralDrift: "Spectral drift",
    modeTitle: "Fingerprint mode",
    exactTitle: "Exact",
    exactDescription: "Locks onto normalized PCM data for repeatable output from the same audio content.",
    robustTitle: "Robust",
    robustDescription: "Tracks dominant spectral structure so similar recordings stay closer after analysis.",
    dropzoneTitle: "Drop a WAV or MP3 file here or choose one manually.",
    dropzoneHint: `Generator accepts WAV and MP3 up to ${MAX_UPLOAD_SIZE_MB} MB and ${MAX_DURATION_SECONDS} seconds.`,
    selectAudio: "Select audio",
    noFileSelected: "No file selected",
    trimBadge: "Audio trimmed on this device before analysis",
    previewAudio: "Preview audio",
    generate: "Generate password",
    generating: "Synthesizing password...",
    progressTitle: "Generation progress",
    progressWaiting: "Preparing audio stream",
    progressAnalyzing: "Analyzing spectral fingerprint",
    progressEncoding: "Encoding password output",
    desktopNote: "Desktop mode: audio and password stay only on this device.",
    emptyState: "The generated password will appear here after analysis.",
    password: "Password",
    mode: "Mode",
    algorithm: "Algorithm",
    chooseFileError: "Choose an audio file before generating a password.",
    emptyFileError: "The uploaded file is empty.",
    decodeFailed: "The audio file could not be decoded. Check the format and file integrity.",
    silentError: "The uploaded audio is silent after normalization.",
    genericError: "The audio could not be processed.",
    trimFailed: "The app could not prepare a trimmed version of this audio.",
    passwordCopied: "Copied",
    copyPassword: "Copy password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    limitTitle: "Audio exceeds the generator limits",
    limitMessage: "This file is larger or longer than the current generator limits. You can trim it on this device before analysis or choose another file.",
    limitDetails: "Current limit",
    fileLabel: "File",
    trimAction: "Trim and continue",
    trimming: "Preparing trimmed audio...",
    replaceAction: "Choose another"
  },
  ru: {
    title: "MusicGen Desktop",
    heroEyebrow: "Автономный режим без интернета",
    heroLede: "Desktop-версия генерирует пароль полностью на этом устройстве. Аудио не покидает приложение и может обрабатываться офлайн.",
    input: "Ввод",
    uploadAudio: "Загрузка аудио",
    output: "Результат",
    resultTitle: "Сгенерированный пароль",
    signalLoaded: "Сигнал загружен",
    waitingSignal: "Ожидание сигнала",
    pcmLock: "PCM lock",
    spectralDrift: "Spectral drift",
    modeTitle: "Режим отпечатка",
    exactTitle: "Точный",
    exactDescription: "Фиксируется на нормализованном PCM и стабильно повторяет результат для одного и того же аудио.",
    robustTitle: "Устойчивый",
    robustDescription: "Ориентируется на доминирующую спектральную структуру, чтобы похожие записи оставались ближе.",
    dropzoneTitle: "Перетащите WAV или MP3 сюда или выберите файл вручную.",
    dropzoneHint: `Генератор принимает WAV и MP3 до ${MAX_UPLOAD_SIZE_MB} МБ и ${MAX_DURATION_SECONDS} секунд.`,
    selectAudio: "Выбрать аудио",
    noFileSelected: "Файл не выбран",
    trimBadge: "Аудио обрезано на этом устройстве перед анализом",
    previewAudio: "Прослушать аудио",
    generate: "Сгенерировать пароль",
    generating: "Генерация пароля...",
    progressTitle: "Ход генерации",
    progressWaiting: "Подготовка аудиопотока",
    progressAnalyzing: "Анализ спектрального отпечатка",
    progressEncoding: "Формирование пароля",
    desktopNote: "Desktop-режим: аудио и пароль остаются только на этом устройстве.",
    emptyState: "Сгенерированный пароль появится здесь после анализа.",
    password: "Пароль",
    mode: "Режим",
    algorithm: "Алгоритм",
    chooseFileError: "Сначала выберите аудиофайл.",
    emptyFileError: "Загруженный файл пуст.",
    decodeFailed: "Не удалось декодировать аудиофайл. Проверьте формат и целостность файла.",
    silentError: "Загруженное аудио оказалось тихим после нормализации.",
    genericError: "Не удалось обработать аудио.",
    trimFailed: "Не удалось подготовить обрезанную версию этого аудио.",
    passwordCopied: "Скопировано",
    copyPassword: "Скопировать пароль",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    limitTitle: "Аудио превышает лимиты генератора",
    limitMessage: "Этот файл больше или длиннее допустимых лимитов. Его можно обрезать на этом устройстве перед анализом или выбрать другой файл.",
    limitDetails: "Текущий лимит",
    fileLabel: "Файл",
    trimAction: "Обрезать и продолжить",
    trimming: "Подготовка обрезанного аудио...",
    replaceAction: "Выбрать другой"
  }
};

let currentLanguage = "ru";
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

const $ = (id) => document.getElementById(id);
const refs = {
  modeButtons: Array.from(document.querySelectorAll(".mode-segment")),
  languageButtons: Array.from(document.querySelectorAll(".language-pill")),
  audioInput: $("audio-input"),
  fileName: $("file-name"),
  dropzoneTitle: $("dropzone-title"),
  dropzoneHint: $("dropzone-hint"),
  selectAudioLabel: $("select-audio-label"),
  audioPreview: $("audio-preview"),
  audioPreviewBlock: $("audio-preview-block"),
  generateButton: $("generate-button"),
  form: $("generator-form"),
  progressPanel: $("progress-panel"),
  progressFill: $("progress-fill"),
  progressLabel: $("progress-label"),
  emptyState: $("empty-state"),
  emptyStateText: $("empty-state-text"),
  resultStack: $("result-stack"),
  passwordBlock: $("password-block"),
  togglePasswordButton: $("toggle-password"),
  copyPasswordButton: $("copy-password"),
  resultModeLabel: $("result-mode-label"),
  resultModeTag: $("result-mode-tag"),
  resultAlgorithmLabel: $("result-algorithm-label"),
  resultAlgorithmTag: $("result-algorithm-tag"),
  modeTooltipResult: $("mode-tooltip-result").querySelector(".tooltip-copy"),
  algorithmTooltipResult: $("algorithm-tooltip-result").querySelector(".tooltip-copy"),
  errorMessage: $("error-message"),
  logoRing: $("logo-ring"),
  trimBadge: $("trim-badge"),
  signalStatus: $("signal-status"),
  modeStatus: $("mode-status"),
  eyePath: $("eye-path"),
  eyeCircle: $("eye-circle"),
  visualizer: $("music-visualizer"),
  limitModalBackdrop: $("limit-modal-backdrop"),
  limitModalTitle: $("limit-modal-title"),
  limitMessage: $("limit-message"),
  limitModalFile: $("limit-modal-file"),
  limitModalLimit: $("limit-modal-limit"),
  trimActionButton: $("trim-action-button"),
  replaceActionButton: $("replace-action-button"),
  text: {
    heroEyebrow: $("hero-eyebrow"),
    heroLede: $("hero-lede"),
    input: $("input-kicker"),
    uploadAudio: $("upload-title"),
    output: $("output-kicker"),
    resultTitle: $("result-title"),
    modeTitle: $("mode-kicker"),
    exactTitle: $("mode-exact-label"),
    exactDescription: $("mode-exact-description"),
    robustTitle: $("mode-robust-label"),
    robustDescription: $("mode-robust-description"),
    previewAudio: $("preview-audio-label"),
    progressTitle: $("progress-title"),
    desktopNote: $("desktop-note"),
    password: $("password-label"),
    mode: $("mode-result-label"),
    algorithm: $("algorithm-result-label"),
    limitTitle: $("limit-kicker")
  }
};

function copy() {
  return I18N[currentLanguage];
}

function modeDefinitions() {
  const t = copy();
  return {
    exact: { label: t.exactTitle, description: t.exactDescription, tag: "exact" },
    robust: { label: t.robustTitle, description: t.robustDescription, tag: "robust" }
  };
}

function algorithmDefinitions() {
  return {
    exact: {
      label: "PCM SHA-256",
      tag: "PCM16",
      description: "Hashes the normalized PCM stream. Best when you want the exact same file to produce the same password."
    },
    robust: {
      label: "Spectral Peaks",
      tag: "PEAKS",
      description: "Hashes quantized spectral peaks. Better for keeping similar recordings closer to each other."
    }
  };
}

function buildLogo() {
  for (let index = 0; index < 64; index += 1) {
    const bar = document.createElement("span");
    const angle = index * 5.625;
    const height = 10 + ((index * 7) % 18);
    bar.className = index % 9 === 0 ? "logo-bar logo-bar-accent" : "logo-bar";
    bar.style.setProperty("--rotation", `${angle}deg`);
    bar.style.setProperty("--bar-height", `${height}px`);
    refs.logoRing.appendChild(bar);
  }
}

function buildVisualizer() {
  refs.visualizer.innerHTML = "";
  for (let index = 0; index < 28; index += 1) {
    const bar = document.createElement("span");
    bar.className = "visualizer-bar";
    bar.style.setProperty("--bar-scale", "0.18");
    bar.style.setProperty("--bar-delay", `${index * 30}ms`);
    refs.visualizer.appendChild(bar);
  }
}

function setVisualizerBars(values) {
  refs.visualizer.querySelectorAll(".visualizer-bar").forEach((bar, index) => {
    bar.style.setProperty("--bar-scale", `${Math.max(0.18, values[index] ?? 0.18)}`);
  });
}

function resetVisualizer() {
  refs.visualizer.classList.remove("music-visualizer-active");
  setVisualizerBars(Array.from({ length: 28 }, () => 0.18));
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function setError(message) {
  refs.errorMessage.textContent = message ?? "";
  refs.errorMessage.classList.toggle("hidden", !message);
}

function setProgress(visible, percent = 0, label = "") {
  refs.progressPanel.classList.toggle("hidden", !visible);
  refs.progressFill.style.width = `${percent}%`;
  refs.progressLabel.textContent = label;
}

function startProgressLoop() {
  const t = copy();
  const stages = [
    { limit: 24, label: t.progressWaiting },
    { limit: 72, label: t.progressAnalyzing },
    { limit: 92, label: t.progressEncoding }
  ];
  let current = 8;
  setProgress(true, current, stages[0].label);
  refs.generateButton.textContent = t.generating;
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
  const t = copy();
  refs.passwordBlock.textContent = passwordVisible ? currentPassword : maskPassword(currentPassword);
  refs.togglePasswordButton.title = passwordVisible ? t.hidePassword : t.showPassword;
  refs.togglePasswordButton.setAttribute("aria-label", passwordVisible ? t.hidePassword : t.showPassword);
  if (passwordVisible) {
    refs.eyePath.setAttribute("d", "M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z");
    refs.eyeCircle.classList.remove("hidden");
  } else {
    refs.eyePath.setAttribute("d", "M3 4.5 20 19.5M6.1 7.2C7.8 5.9 9.8 5.2 12 5.2c6.7 0 10.5 6.8 10.5 6.8-.8 1.4-1.8 2.6-2.9 3.7M9 9.3a4 4 0 0 1 5.5 5.5M1.5 12c.8-1.3 1.8-2.5 3-3.6m2.2 8.2A11 11 0 0 0 12 18.5");
    refs.eyeCircle.classList.add("hidden");
  }
}

function updateModeButtons() {
  const t = copy();
  refs.modeButtons.forEach((button) => {
    button.classList.toggle("mode-segment-active", button.dataset.mode === currentMode);
  });
  refs.modeStatus.textContent = currentMode === "exact" ? t.pcmLock : t.spectralDrift;
}

function updateResultMeta(mode) {
  const modeDef = modeDefinitions()[mode];
  const algoDef = algorithmDefinitions()[mode];
  refs.resultModeLabel.textContent = modeDef.label;
  refs.resultModeTag.textContent = modeDef.tag;
  refs.resultAlgorithmLabel.textContent = algoDef.label;
  refs.resultAlgorithmTag.textContent = algoDef.tag;
  refs.modeTooltipResult.textContent = modeDef.description;
  refs.algorithmTooltipResult.textContent = algoDef.description;
}

function applyLanguage() {
  const t = copy();
  document.documentElement.lang = currentLanguage;
  document.title = t.title;
  Object.entries(refs.text).forEach(([key, node]) => {
    const valueMap = {
      heroEyebrow: t.heroEyebrow,
      heroLede: t.heroLede,
      input: t.input,
      uploadAudio: t.uploadAudio,
      output: t.output,
      resultTitle: t.resultTitle,
      modeTitle: t.modeTitle,
      exactTitle: t.exactTitle,
      exactDescription: t.exactDescription,
      robustTitle: t.robustTitle,
      robustDescription: t.robustDescription,
      previewAudio: t.previewAudio,
      progressTitle: t.progressTitle,
      desktopNote: t.desktopNote,
      password: t.password,
      mode: t.mode,
      algorithm: t.algorithm,
      limitTitle: t.limitTitle
    };
    node.textContent = valueMap[key];
  });
  refs.dropzoneHint.textContent = t.dropzoneHint;
  refs.selectAudioLabel.textContent = t.selectAudio;
  refs.generateButton.textContent = t.generate;
  refs.trimBadge.textContent = t.trimBadge;
  refs.limitMessage.textContent = t.limitMessage;
  refs.trimActionButton.textContent = t.trimAction;
  refs.replaceActionButton.textContent = t.replaceAction;
  refs.emptyStateText.textContent = t.emptyState;
  refs.signalStatus.textContent = currentFile ? t.signalLoaded : t.waitingSignal;
  refs.fileName.textContent = currentFile ? currentFile.name : t.noFileSelected;
  refs.dropzoneTitle.textContent = currentFile ? currentFile.name : t.dropzoneTitle;
  refs.copyPasswordButton.title = t.copyPassword;
  refs.copyPasswordButton.setAttribute("aria-label", t.copyPassword);
  refs.languageButtons.forEach((button) => {
    button.classList.toggle("language-pill-active", button.dataset.language === currentLanguage);
  });
  if (pendingOversizedFile) {
    refs.limitModalLimit.textContent = `${t.limitDetails}: ${MAX_UPLOAD_SIZE_MB} MB / ${formatDuration(MAX_DURATION_SECONDS)}`;
    refs.limitModalFile.textContent = `${t.fileLabel}: ${(pendingOversizedFile.size / (1024 * 1024)).toFixed(1)} MB / ${formatDuration(pendingOversizedDuration)}`;
  }
  updateModeButtons();
  updateResultMeta(currentMode);
  renderPassword();
}

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function passwordFromDigest(digest, length = 18) {
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
  if (channels.length === 1) return channels[0];
  const mono = new Float32Array(channels[0].length);
  for (let index = 0; index < mono.length; index += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[index] ?? 0;
    mono[index] = sum / channels.length;
  }
  return mono;
}

function resampleMono(samples, sourceRate, targetRate) {
  if (sourceRate === targetRate) return samples;
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
  const t = copy();
  let sum = 0;
  for (const sample of samples) sum += sample;
  const mean = sum / samples.length;
  let peak = 0;
  const centered = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] - mean;
    centered[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak === 0) throw new Error(t.silentError);
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
    const ranked = bandEnergy.map((value, index) => ({ index, value })).sort((left, right) => right.value - left.value).slice(0, 3).map((entry) => entry.index).sort((left, right) => left - right);
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
      const timeout = window.setTimeout(() => reject(new Error("Audio metadata timed out.")), 4000);
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
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function trimAudioInBrowser(file, targetDurationSeconds) {
  const t = copy();
  if (file.size === 0) throw new Error(t.emptyFileError);
  const context = new AudioContext();
  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(sourceBuffer.slice(0));
    const frameLimit = Math.min(decoded.length, Math.max(1, Math.floor(targetDurationSeconds * decoded.sampleRate)));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index).slice(0, frameLimit));
    const mono = mixToMono(channels);
    const resampled = resampleMono(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([encodeWavFromMono(resampled, TARGET_SAMPLE_RATE)], `${baseName}-trimmed.wav`, { type: "audio/wav", lastModified: Date.now() });
  } finally {
    await context.close();
  }
}

async function decodeAndNormalize(file) {
  const t = copy();
  if (file.size === 0) throw new Error(t.emptyFileError);
  const context = new AudioContext();
  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(sourceBuffer.slice(0));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    return normalizeAudio(resampleMono(mixToMono(channels), decoded.sampleRate, TARGET_SAMPLE_RATE));
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error(t.decodeFailed);
  } finally {
    await context.close();
  }
}

async function generateFromFile(file, mode) {
  const normalized = await decodeAndNormalize(file);
  if (mode === "exact") {
    const digest = await sha256Hex(new Uint8Array(floatToPcm16(normalized).buffer));
    return { password: passwordFromDigest(digest), mode };
  }
  const digest = await sha256Hex(new TextEncoder().encode(serializeRobustFingerprint(normalized)));
  return { password: passwordFromDigest(digest), mode };
}

function revokeAudioUrl() {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

function setCurrentFile(file) {
  const t = copy();
  currentFile = file;
  refs.fileName.textContent = file ? file.name : t.noFileSelected;
  refs.dropzoneTitle.textContent = file ? file.name : t.dropzoneTitle;
  refs.signalStatus.textContent = file ? t.signalLoaded : t.waitingSignal;
  refs.trimBadge.classList.toggle("hidden", !trimOnUpload);
  refs.trimBadge.textContent = t.trimBadge;
  revokeAudioUrl();
  stopVisualizer();
  if (!file) {
    refs.audioPreview.removeAttribute("src");
    refs.audioPreviewBlock.classList.add("hidden");
    refs.generateButton.disabled = true;
    return;
  }
  currentAudioUrl = URL.createObjectURL(file);
  refs.audioPreview.src = currentAudioUrl;
  refs.audioPreviewBlock.classList.remove("hidden");
  refs.generateButton.disabled = false;
}

function showLimitModal(file, durationSeconds) {
  const t = copy();
  pendingOversizedFile = file;
  pendingOversizedDuration = durationSeconds;
  refs.limitModalTitle.textContent = file.name;
  refs.limitModalLimit.textContent = `${t.limitDetails}: ${MAX_UPLOAD_SIZE_MB} MB / ${formatDuration(MAX_DURATION_SECONDS)}`;
  refs.limitModalFile.textContent = `${t.fileLabel}: ${(file.size / (1024 * 1024)).toFixed(1)} MB / ${formatDuration(durationSeconds)}`;
  refs.limitModalBackdrop.classList.remove("hidden");
}

function hideLimitModal() {
  refs.limitModalBackdrop.classList.add("hidden");
  pendingOversizedFile = null;
  pendingOversizedDuration = 0;
}

async function handleFileSelection(file) {
  const t = copy();
  if (!file) return;
  if (file.size === 0) {
    trimOnUpload = false;
    setCurrentFile(null);
    setError(t.emptyFileError);
    return;
  }
  const durationSeconds = await getAudioDurationSeconds(file).catch(() => 0);
  setError("");
  refs.emptyState.classList.remove("hidden");
  refs.resultStack.classList.add("hidden");
  if (file.size > MAX_UPLOAD_SIZE_BYTES || durationSeconds > MAX_DURATION_SECONDS) {
    showLimitModal(file, durationSeconds);
    return;
  }
  trimOnUpload = false;
  setCurrentFile(file);
}

async function connectAudioVisualizer() {
  if (!audioContext) audioContext = new AudioContext();
  if (!analyserNode) {
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.82;
  }
  if (!mediaSourceNode) {
    mediaSourceNode = audioContext.createMediaElementSource(refs.audioPreview);
    mediaSourceNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") await audioContext.resume();
}

function animateVisualizer() {
  if (!analyserNode) return;
  const spectrum = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(spectrum);
  const barCount = 28;
  const bucketSize = Math.max(1, Math.floor(spectrum.length / barCount));
  const nextBars = Array.from({ length: barCount }, (_, index) => {
    let total = 0;
    const start = index * bucketSize;
    const end = Math.min(spectrum.length, start + bucketSize);
    for (let bucket = start; bucket < end; bucket += 1) total += spectrum[bucket] ?? 0;
    return Math.max(0.14, total / Math.max(1, end - start) / 255);
  });
  refs.visualizer.classList.add("music-visualizer-active");
  setVisualizerBars(nextBars);
  visualizerFrame = window.requestAnimationFrame(animateVisualizer);
}

async function startVisualizer() {
  try {
    await connectAudioVisualizer();
    if (visualizerFrame !== null) window.cancelAnimationFrame(visualizerFrame);
    visualizerFrame = window.requestAnimationFrame(animateVisualizer);
  } catch {
    refs.visualizer.classList.add("music-visualizer-active");
  }
}

function stopVisualizer() {
  if (visualizerFrame !== null) {
    window.cancelAnimationFrame(visualizerFrame);
    visualizerFrame = null;
  }
  resetVisualizer();
}

refs.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    updateModeButtons();
    updateResultMeta(currentMode);
  });
});

refs.languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentLanguage = button.dataset.language;
    applyLanguage();
  });
});

refs.audioInput.addEventListener("change", async () => {
  const file = refs.audioInput.files?.[0] ?? null;
  refs.audioInput.value = "";
  await handleFileSelection(file);
});

refs.audioPreview.addEventListener("play", () => void startVisualizer());
refs.audioPreview.addEventListener("pause", stopVisualizer);
refs.audioPreview.addEventListener("ended", stopVisualizer);

refs.togglePasswordButton.addEventListener("click", () => {
  passwordVisible = !passwordVisible;
  renderPassword();
});

refs.copyPasswordButton.addEventListener("click", async () => {
  const t = copy();
  if (!currentPassword) return;
  await navigator.clipboard.writeText(currentPassword);
  refs.copyPasswordButton.classList.add("icon-button-done");
  refs.copyPasswordButton.title = t.passwordCopied;
  refs.copyPasswordButton.setAttribute("aria-label", t.passwordCopied);
  window.setTimeout(() => {
    refs.copyPasswordButton.classList.remove("icon-button-done");
    refs.copyPasswordButton.title = t.copyPassword;
    refs.copyPasswordButton.setAttribute("aria-label", t.copyPassword);
  }, 1200);
});

refs.trimActionButton.addEventListener("click", async () => {
  const t = copy();
  if (!pendingOversizedFile) return hideLimitModal();
  refs.trimActionButton.disabled = true;
  refs.replaceActionButton.disabled = true;
  refs.trimActionButton.textContent = t.trimming;
  try {
    const targetDurationSeconds = Math.min(MAX_DURATION_SECONDS, Math.max(1, Math.floor(pendingOversizedDuration || MAX_DURATION_SECONDS)));
    const trimmed = await trimAudioInBrowser(pendingOversizedFile, targetDurationSeconds);
    trimOnUpload = true;
    setCurrentFile(trimmed);
    hideLimitModal();
  } catch {
    trimOnUpload = false;
    setError(t.trimFailed);
    hideLimitModal();
  } finally {
    refs.trimActionButton.disabled = false;
    refs.replaceActionButton.disabled = false;
    refs.trimActionButton.textContent = t.trimAction;
  }
});

refs.replaceActionButton.addEventListener("click", () => {
  trimOnUpload = false;
  setCurrentFile(null);
  hideLimitModal();
});

refs.form.addEventListener("submit", async (event) => {
  const t = copy();
  event.preventDefault();
  if (!currentFile) return setError(t.chooseFileError);
  try {
    setError("");
    refs.emptyState.classList.add("hidden");
    refs.resultStack.classList.add("hidden");
    startProgressLoop();
    const result = await generateFromFile(currentFile, currentMode);
    stopProgressLoop();
    setProgress(true, 100, t.progressEncoding);
    currentPassword = result.password;
    passwordVisible = false;
    renderPassword();
    updateResultMeta(result.mode);
    refs.resultStack.classList.remove("hidden");
    refs.generateButton.textContent = t.generate;
    window.setTimeout(() => setProgress(false, 0, ""), 700);
  } catch (error) {
    stopProgressLoop();
    setProgress(false, 0, "");
    refs.generateButton.textContent = t.generate;
    setError(error instanceof Error ? error.message : t.genericError);
  }
});

window.addEventListener("beforeunload", () => {
  revokeAudioUrl();
  stopProgressLoop();
  stopVisualizer();
  if (mediaSourceNode) mediaSourceNode.disconnect();
  if (analyserNode) analyserNode.disconnect();
  if (audioContext && audioContext.state !== "closed") void audioContext.close();
});

buildLogo();
buildVisualizer();
applyLanguage();
setCurrentFile(null);
renderPassword();
resetVisualizer();
