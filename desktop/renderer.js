const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?";
const TARGET_SAMPLE_RATE = 22050;

let currentMode = "exact";
let currentFile = null;
let currentAudioUrl = null;
let currentPassword = "";
let passwordVisible = false;

const modeButtons = Array.from(document.querySelectorAll(".mode-segment"));
const audioInput = document.getElementById("audio-input");
const fileName = document.getElementById("file-name");
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
const errorMessage = document.getElementById("error-message");
const logoRing = document.getElementById("logo-ring");

function buildLogo() {
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

function maskPassword(password) {
  return "*".repeat(password.length);
}

function renderPassword() {
  passwordBlock.textContent = passwordVisible ? currentPassword : maskPassword(currentPassword);
}

function updateModeButtons() {
  for (const button of modeButtons) {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("mode-segment-active", active);
  }
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

  if (peak === 0) throw new Error("Аудио оказалось пустым после нормализации.");

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

async function decodeAndNormalize(file) {
  const audioContext = new AudioContext();
  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const mono = mixToMono(channels);
    const resampled = resampleMono(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
    return normalizeAudio(resampled);
  } finally {
    await audioContext.close();
  }
}

async function generateFromFile(file, mode) {
  const normalized = await decodeAndNormalize(file);

  if (mode === "exact") {
    const pcm = floatToPcm16(normalized);
    const digest = await sha256Hex(new Uint8Array(pcm.buffer));
    return {
      algorithmLabel: "PCM SHA-256",
      algorithmTag: "PCM16",
      modeLabel: "Точный",
      modeTag: "exact",
      password: passwordFromDigest(digest)
    };
  }

  const payload = new TextEncoder().encode(serializeRobustFingerprint(normalized));
  const digest = await sha256Hex(payload);
  return {
    algorithmLabel: "Spectral Peaks",
    algorithmTag: "PEAKS",
    modeLabel: "Устойчивый",
    modeTag: "robust",
    password: passwordFromDigest(digest)
  };
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    updateModeButtons();
  });
});

audioInput.addEventListener("change", () => {
  const file = audioInput.files?.[0] ?? null;
  currentFile = file;
  setError("");

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  if (!file) {
    fileName.textContent = "Файл не выбран";
    audioPreviewBlock.classList.add("hidden");
    generateButton.disabled = true;
    return;
  }

  fileName.textContent = file.name;
  currentAudioUrl = URL.createObjectURL(file);
  audioPreview.src = currentAudioUrl;
  audioPreviewBlock.classList.remove("hidden");
  generateButton.disabled = false;
});

togglePasswordButton.addEventListener("click", () => {
  passwordVisible = !passwordVisible;
  renderPassword();
});

copyPasswordButton.addEventListener("click", async () => {
  if (!currentPassword) return;
  await navigator.clipboard.writeText(currentPassword);
  copyPasswordButton.classList.add("icon-button-done");
  window.setTimeout(() => copyPasswordButton.classList.remove("icon-button-done"), 1200);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentFile) {
    setError("Сначала выберите аудиофайл.");
    return;
  }

  try {
    setError("");
    setProgress(true, 12, "Подготовка аудио");
    emptyState.classList.add("hidden");
    resultStack.classList.add("hidden");

    const progressTimer = window.setInterval(() => {
      const current = Number.parseFloat(progressFill.style.width) || 12;
      const next = Math.min(current + 9, 88);
      progressFill.style.width = `${next}%`;
      progressLabel.textContent = next < 50 ? "Нормализация аудио" : "Формирование отпечатка";
    }, 220);

    const result = await generateFromFile(currentFile, currentMode);

    window.clearInterval(progressTimer);
    setProgress(true, 100, "Пароль готов");

    currentPassword = result.password;
    passwordVisible = false;
    renderPassword();
    resultModeLabel.textContent = result.modeLabel;
    resultModeTag.textContent = result.modeTag;
    resultAlgorithmLabel.textContent = result.algorithmLabel;
    resultAlgorithmTag.textContent = result.algorithmTag;
    resultStack.classList.remove("hidden");

    window.setTimeout(() => setProgress(false, 0, ""), 700);
  } catch (error) {
    setProgress(false, 0, "");
    setError(error instanceof Error ? error.message : "Не удалось обработать аудио.");
  }
});

buildLogo();
updateModeButtons();
