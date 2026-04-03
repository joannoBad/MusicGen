"use client";

import { useEffect, useRef, useState } from "react";
import audioLimits from "@/config/audio-limits.json";
import { generatePasswordFromAudio, type GenerationResponse, type PasswordMode } from "@/lib/api";

type UiLanguage = "ru" | "en";

type LimitModalState = {
  durationSeconds: number;
  file: File | null;
  isOpen: boolean;
  tooLarge: boolean;
  tooLong: boolean;
};

const MAX_UPLOAD_SIZE_BYTES = audioLimits.maxUploadSizeMb * 1024 * 1024;
const MAX_DURATION_SECONDS = audioLimits.maxDurationSeconds;
const TRIMMED_SAMPLE_RATE = 22_050;

const COPY = {
  en: {
    input: "Input",
    uploadAudio: "Upload audio",
    modeTitle: "Fingerprint mode",
    output: "Output",
    fingerprintResult: "Generated password",
    signalLoaded: "Signal loaded",
    waitingSignal: "Waiting for signal",
    pcmLock: "PCM lock",
    spectralDrift: "Spectral drift",
    dropzoneTitle: "Drop a WAV or MP3 file here or choose one manually.",
    dropzoneHint: `Generator accepts WAV and MP3 up to ${audioLimits.maxUploadSizeMb} MB and ${MAX_DURATION_SECONDS} seconds.`,
    selectAudio: "Select audio",
    noFileSelected: "No file selected",
    exactTitle: "Exact",
    exactDescription: "Locks onto normalized PCM data for repeatable output from the same audio content.",
    robustTitle: "Robust",
    robustDescription: "Tracks dominant spectral structure so similar recordings stay closer after analysis.",
    generate: "Generate password",
    generating: "Synthesizing password...",
    localOnly: "Audio is sent only to the server used by this app instance.",
    chooseFileError: "Choose an audio file before generating a password.",
    genericError: "The generator failed before it could produce a password.",
    trimFailed: "The browser could not prepare a trimmed version of this audio.",
    password: "Password",
    mode: "Mode",
    algorithm: "Algorithm",
    previewAudio: "Preview audio",
    generationProgress: "Generation progress",
    progressWaiting: "Preparing audio stream",
    progressAnalyzing: "Analyzing spectral fingerprint",
    progressEncoding: "Encoding password output",
    empty: "The generated password will appear here after analysis.",
    trimEnabled: "Trimmed on this device before upload",
    limitTitle: "Audio exceeds the generator limits",
    limitMessage:
      "This file is larger or longer than the current generator limits. You can trim it in the browser before upload or choose another file.",
    limitDetails: "Current limit",
    trimAction: "Trim and continue",
    replaceAction: "Choose another",
    copied: "Copied",
    copy: "Copy password",
    show: "Show password",
    hide: "Hide password",
    trimming: "Preparing trimmed audio..."
  },
  ru: {
    input: "Ввод",
    uploadAudio: "Загрузка аудио",
    modeTitle: "Режим отпечатка",
    output: "Результат",
    fingerprintResult: "Сгенерированный пароль",
    signalLoaded: "Сигнал загружен",
    waitingSignal: "Ожидание сигнала",
    pcmLock: "PCM lock",
    spectralDrift: "Spectral drift",
    dropzoneTitle: "Перетащите WAV или MP3 сюда или выберите файл вручную.",
    dropzoneHint: `Генератор принимает WAV и MP3 до ${audioLimits.maxUploadSizeMb} МБ и ${MAX_DURATION_SECONDS} секунд.`,
    selectAudio: "Выбрать аудио",
    noFileSelected: "Файл не выбран",
    exactTitle: "Точный",
    exactDescription: "Фиксируется на нормализованном PCM и стабильно повторяет результат для одного и того же аудио.",
    robustTitle: "Устойчивый",
    robustDescription: "Ориентируется на доминирующую спектральную структуру, чтобы похожие записи оставались ближе.",
    generate: "Сгенерировать пароль",
    generating: "Генерация пароля...",
    localOnly: "Аудио отправляется только на сервер этого приложения.",
    chooseFileError: "Сначала выберите аудиофайл.",
    genericError: "Генератор не смог создать пароль.",
    trimFailed: "Браузер не смог подготовить обрезанную версию этого аудио.",
    password: "Пароль",
    mode: "Режим",
    algorithm: "Алгоритм",
    previewAudio: "Прослушать аудио",
    generationProgress: "Ход генерации",
    progressWaiting: "Подготовка аудиопотока",
    progressAnalyzing: "Анализ спектрального отпечатка",
    progressEncoding: "Формирование пароля",
    empty: "Сгенерированный пароль появится здесь после анализа.",
    trimEnabled: "Аудио обрезано на этом устройстве перед загрузкой",
    limitTitle: "Аудио превышает лимиты генератора",
    limitMessage:
      "Этот файл больше или длиннее допустимых лимитов. Вы можете обрезать его прямо в браузере перед загрузкой или выбрать другой файл.",
    limitDetails: "Текущий лимит",
    trimAction: "Обрезать и продолжить",
    replaceAction: "Выбрать другой",
    copied: "Скопировано",
    copy: "Скопировать пароль",
    show: "Показать пароль",
    hide: "Скрыть пароль",
    trimming: "Подготовка обрезанного аудио..."
  }
} as const;

async function getAudioDurationSeconds(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = objectUrl;

    const duration = await new Promise<number>((resolve, reject) => {
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

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function mixToMono(channels: Float32Array[]): Float32Array {
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

function resampleMono(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
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

function encodeWavFromMono(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
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

async function trimAudioInBrowser(file: File, targetDurationSeconds: number): Promise<File> {
  const audioContext = new AudioContext();

  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    const frameLimit = Math.min(decoded.length, Math.max(1, Math.floor(targetDurationSeconds * decoded.sampleRate)));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index).slice(0, frameLimit)
    );
    const mono = mixToMono(channels);
    const resampled = resampleMono(mono, decoded.sampleRate, TRIMMED_SAMPLE_RATE);
    const trimmedBlob = encodeWavFromMono(resampled, TRIMMED_SAMPLE_RATE);
    const baseName = file.name.replace(/\.[^.]+$/, "");

    return new File([trimmedBlob], `${baseName}-trimmed.wav`, {
      type: "audio/wav",
      lastModified: Date.now()
    });
  } finally {
    await audioContext.close();
  }
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className="action-icon" viewBox="0 0 24 24">
      <path
        d={
          open
            ? "M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"
            : "M3 4.5 20 19.5M6.1 7.2C7.8 5.9 9.8 5.2 12 5.2c6.7 0 10.5 6.8 10.5 6.8-.8 1.4-1.8 2.6-2.9 3.7M9 9.3a4 4 0 0 1 5.5 5.5M1.5 12c.8-1.3 1.8-2.5 3-3.6m2.2 8.2A11 11 0 0 0 12 18.5"
        }
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      {open ? <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.8" /> : null}
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="action-icon" viewBox="0 0 24 24">
      <path
        d="M8 7.5A2.5 2.5 0 0 1 10.5 5h6A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 8 16.5v-9ZM5 9.5V6.8A2.8 2.8 0 0 1 7.8 4H14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" className="meta-info-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.2v5.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="7.3" r="1" fill="currentColor" />
    </svg>
  );
}

function HoloGirlIcon() {
  return (
    <svg aria-hidden="true" className="tooltip-hologram-figure" viewBox="0 0 96 120">
      <defs>
        <linearGradient id="holoGirlGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd8fb" />
          <stop offset="55%" stopColor="#ff84ec" />
          <stop offset="100%" stopColor="#ff4fd8" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#holoGirlGlow)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27 42c4-15 14-24 21-24 8 0 18 9 22 24" strokeWidth="4.2" />
        <path d="M31 43c-5 4-9 11-9 18 0 9 6 18 16 22" strokeWidth="3.4" />
        <path d="M66 43c5 4 9 11 9 18 0 9-6 18-16 22" strokeWidth="3.4" />
        <circle cx="48" cy="40" r="15" strokeWidth="3.6" />
        <path d="M40 38c2-2 5-3 8-3 3 0 6 1 8 3" strokeWidth="2.6" />
        <path d="M44 46c2 2 6 2 8 0" strokeWidth="2.2" />
        <path d="M37 61c-10 5-18 18-18 31" strokeWidth="3.5" />
        <path d="M59 61c10 5 18 18 18 31" strokeWidth="3.5" />
        <path d="M48 62v21" strokeWidth="3.5" />
        <path d="M29 91c7-5 13-8 19-8s12 3 19 8" strokeWidth="3.2" />
        <path d="M33 26l-10-8" strokeWidth="2.6" />
        <path d="M63 26l10-8" strokeWidth="2.6" />
        <path d="M22 98h52" strokeWidth="2.4" opacity="0.82" />
        <path d="M30 104h36" strokeWidth="2.1" opacity="0.64" />
      </g>
    </svg>
  );
}

export function GeneratorPanel({ language }: { language: UiLanguage }) {
  const [mode, setMode] = useState<PasswordMode>("exact");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");
  const [trimOnUpload, setTrimOnUpload] = useState(false);
  const [isTrimmingAudio, setIsTrimmingAudio] = useState(false);
  const [visualizerBars, setVisualizerBars] = useState<number[]>(() => Array.from({ length: 28 }, () => 0.18));
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [limitModal, setLimitModal] = useState<LimitModalState>({
    durationSeconds: 0,
    file: null,
    isOpen: false,
    tooLarge: false,
    tooLong: false
  });
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const copy = COPY[language];

  const modes: Array<{ value: PasswordMode; title: string; description: string }> = [
    { value: "exact", title: copy.exactTitle, description: copy.exactDescription },
    { value: "robust", title: copy.robustTitle, description: copy.robustDescription }
  ];
  const algorithmDefinitions: Record<string, { label: string; shortTag: string; description: string }> = {
    "sha256(normalized_pcm16)": {
      label: language === "ru" ? "PCM SHA-256" : "PCM SHA-256",
      shortTag: "PCM16",
      description:
        language === "ru"
          ? "Хеш нормализованного PCM-потока. Даёт максимально повторяемый результат для одного и того же аудиофайла."
          : "Hashes the normalized PCM stream. Best when you want the exact same file to produce the same password."
    },
    "sha256(quantized_spectral_peaks)": {
      label: language === "ru" ? "Spectral Peaks" : "Spectral Peaks",
      shortTag: "PEAKS",
      description:
        language === "ru"
          ? "Хеш квантованных спектральных пиков. Лучше переносит похожие версии одной и той же записи."
          : "Hashes quantized spectral peaks. Better for keeping similar recordings closer to each other."
    },
  };
  const resultModeDefinition = modes.find((entry) => entry.value === result?.mode);
  const resultAlgorithmDefinition = result ? algorithmDefinitions[result.algorithm] : null;

  useEffect(() => {
    if (!file) {
      setAudioUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setAudioUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    setIsPasswordVisible(false);
    setCopyState("idle");
  }, [result]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      sourceNodeRef.current?.disconnect();
      analyserRef.current?.disconnect();

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isSubmitting) {
      setProgress(0);
      setProgressLabel("");
      return;
    }

    const stages = [
      { limit: 24, label: copy.progressWaiting },
      { limit: 72, label: copy.progressAnalyzing },
      { limit: 92, label: copy.progressEncoding }
    ];

    let current = 8;
    setProgress(current);
    setProgressLabel(stages[0].label);

    const timer = window.setInterval(() => {
      current = Math.min(current + 6, 92);
      const activeStage = stages.find((stage) => current <= stage.limit) ?? stages[stages.length - 1];
      setProgress(current);
      setProgressLabel(activeStage.label);
    }, 240);

    return () => window.clearInterval(timer);
  }, [copy.progressAnalyzing, copy.progressEncoding, copy.progressWaiting, isSubmitting]);

  useEffect(() => {
    if (!audioUrl) {
      setIsAudioPlaying(false);
      setVisualizerBars(Array.from({ length: 28 }, () => 0.18));
    }
  }, [audioUrl]);

  function animateVisualizer() {
    const analyser = analyserRef.current;

    if (!analyser) {
      return;
    }

    const spectrum = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(spectrum);

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

    setVisualizerBars(nextBars);
    animationFrameRef.current = window.requestAnimationFrame(animateVisualizer);
  }

  async function connectAudioVisualizer() {
    const audioElement = audioElementRef.current;

    if (!audioElement) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.82;
    }

    if (!sourceNodeRef.current) {
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElement);
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }

  async function handleAudioPlay() {
    try {
      await connectAudioVisualizer();
      setIsAudioPlaying(true);

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = window.requestAnimationFrame(animateVisualizer);
    } catch {
      setIsAudioPlaying(true);
    }
  }

  function stopVisualizer() {
    setIsAudioPlaying(false);

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setVisualizerBars(Array.from({ length: 28 }, () => 0.18));
  }

  async function handleFileSelection(nextFile: File | null) {
    if (!nextFile) {
      return;
    }

    const durationSeconds = await getAudioDurationSeconds(nextFile).catch(() => 0);
    const tooLarge = nextFile.size > MAX_UPLOAD_SIZE_BYTES;
    const tooLong = durationSeconds > MAX_DURATION_SECONDS;

    setError(null);
    setResult(null);

    if (tooLarge || tooLong) {
      setLimitModal({
        durationSeconds,
        file: nextFile,
        isOpen: true,
        tooLarge,
        tooLong
      });
      return;
    }

    setTrimOnUpload(false);
    setFile(nextFile);
  }

  async function acceptTrimmedUpload() {
    if (!limitModal.file) {
      return;
    }

    setIsTrimmingAudio(true);
    setError(null);

    try {
      const targetDurationSeconds = Math.min(
        MAX_DURATION_SECONDS,
        Math.max(1, Math.floor(limitModal.durationSeconds || MAX_DURATION_SECONDS))
      );
      const trimmedFile = await trimAudioInBrowser(limitModal.file, targetDurationSeconds);
      setTrimOnUpload(true);
      setFile(trimmedFile);
      setLimitModal((state) => ({ ...state, isOpen: false }));
    } catch {
      setTrimOnUpload(false);
      setError(copy.trimFailed);
    } finally {
      setIsTrimmingAudio(false);
    }
  }

  function rejectOversizedUpload() {
    setTrimOnUpload(false);
    setFile(null);
    setLimitModal((state) => ({ ...state, isOpen: false }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError(copy.chooseFileError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await generatePasswordFromAudio(file, mode, false);
      setProgress(100);
      setProgressLabel(copy.progressEncoding);
      setResult(response);
    } catch (submissionError) {
      setResult(null);
      setError(submissionError instanceof Error ? submissionError.message : copy.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyPassword() {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(result.password);
    setCopyState("done");
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  return (
    <>
      <section className="panel-grid">
        <form className="card upload-card" onSubmit={handleSubmit}>
          <div className="card-header">
            <p className="section-kicker">{copy.input}</p>
            <h2>{copy.uploadAudio}</h2>
          </div>

          <div className="status-strip" aria-hidden="true">
            <span className="status-dot" />
            <span>{file ? copy.signalLoaded : copy.waitingSignal}</span>
            <span className="status-divider" />
            <span>{mode === "exact" ? copy.pcmLock : copy.spectralDrift}</span>
          </div>

          <div className="mode-section">
            <div className="subsection-heading">
              <p className="section-kicker">{copy.modeTitle}</p>
            </div>

            <div className="mode-segmented" role="radiogroup" aria-label="Password generation mode">
              {modes.map((entry) => (
                <button
                  key={entry.value}
                  className={entry.value === mode ? "mode-segment mode-segment-active" : "mode-segment"}
                  type="button"
                  onClick={() => setMode(entry.value)}
                >
                  <div className="mode-segment-topline">
                    <strong>{entry.title}</strong>
                    <span className="mode-chip">{entry.value}</span>
                  </div>
                  <span className="mode-tooltip" role="tooltip">
                    <span className="tooltip-shell">
                      <span className="tooltip-hologram" aria-hidden="true">
                        <span className="tooltip-hologram-aura" />
                        <HoloGirlIcon />
                      </span>
                      <span className="tooltip-copy">{entry.description}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="file-dropzone">
            <span>{file ? file.name : copy.dropzoneTitle}</span>
            <small>{copy.dropzoneHint}</small>
            <span className="file-picker-row">
              <span className="file-picker-button">{copy.selectAudio}</span>
              <span className="file-picker-name">{file ? file.name : copy.noFileSelected}</span>
            </span>
            <input
              accept=".wav,.mp3,audio/wav,audio/mpeg"
              name="audio"
              type="file"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                void handleFileSelection(nextFile);
                event.currentTarget.value = "";
              }}
            />
          </label>

          {trimOnUpload ? <p className="trim-badge">{copy.trimEnabled}</p> : null}

          {audioUrl ? (
            <div className="audio-preview">
              <p className="label">{copy.previewAudio}</p>
              <audio
                ref={audioElementRef}
                controls
                className="audio-player"
                src={audioUrl}
                onPlay={() => void handleAudioPlay()}
                onPause={stopVisualizer}
                onEnded={stopVisualizer}
              />
            </div>
          ) : null}

          <button className="submit-button" disabled={!file || isSubmitting} type="submit">
            {isSubmitting ? copy.generating : copy.generate}
          </button>

          {(isSubmitting || progress > 0) && (
            <div className="progress-panel" aria-live="polite">
              <div className="progress-copy">
                <p className="label">{copy.generationProgress}</p>
                <p>{progressLabel}</p>
              </div>
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <p className="microcopy">{copy.localOnly}</p>
        </form>

        <aside className="card result-card">
          <div className="card-header">
            <p className="section-kicker">{copy.output}</p>
            <h2>{copy.fingerprintResult}</h2>
          </div>

          {result ? (
            <div className="result-stack">
              <div className="result-highlight">
                <p className="label">{copy.password}</p>
                <div className="password-row">
                  <code className="password-block">
                    {isPasswordVisible ? result.password : "*".repeat(result.password.length)}
                  </code>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setIsPasswordVisible((value) => !value)}
                    aria-label={isPasswordVisible ? copy.hide : copy.show}
                    title={isPasswordVisible ? copy.hide : copy.show}
                  >
                    <EyeIcon open={isPasswordVisible} />
                  </button>
                  <button
                    className={copyState === "done" ? "icon-button icon-button-done" : "icon-button"}
                    type="button"
                    onClick={handleCopyPassword}
                    aria-label={copyState === "done" ? copy.copied : copy.copy}
                    title={copyState === "done" ? copy.copied : copy.copy}
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>

              <div className="result-meta">
                <div className="meta-tile meta-tile-pill">
                  <div className="meta-tile-heading">
                    <p className="label">{copy.mode}</p>
                    <span className="meta-info-wrap meta-info-wrap-left" tabIndex={0}>
                      <InfoIcon />
                      <span className="meta-tooltip" role="tooltip">
                        <span className="tooltip-shell">
                          <span className="tooltip-hologram" aria-hidden="true">
                            <span className="tooltip-hologram-aura" />
                            <HoloGirlIcon />
                          </span>
                          <span className="tooltip-copy">{resultModeDefinition?.description}</span>
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="result-pill result-pill-mode">
                    <strong>{resultModeDefinition?.title ?? result.mode}</strong>
                    <span className="result-pill-tag">{result.mode}</span>
                  </div>
                </div>
                <div className="meta-tile meta-tile-pill">
                  <div className="meta-tile-heading">
                    <p className="label">{copy.algorithm}</p>
                    <span className="meta-info-wrap meta-info-wrap-right" tabIndex={0}>
                      <InfoIcon />
                      <span className="meta-tooltip" role="tooltip">
                        <span className="tooltip-shell">
                          <span className="tooltip-hologram" aria-hidden="true">
                            <span className="tooltip-hologram-aura" />
                            <HoloGirlIcon />
                          </span>
                          <span className="tooltip-copy">
                            {resultAlgorithmDefinition?.description ?? result.algorithm}
                          </span>
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="result-pill result-pill-algorithm">
                    <strong>{resultAlgorithmDefinition?.label ?? result.algorithm}</strong>
                    <span className="result-pill-tag">
                      {resultAlgorithmDefinition?.shortTag ?? result.algorithm}
                    </span>
                  </div>
                </div>
              </div>

              <div className="fingerprint-animation" aria-hidden="true">
                <div className={isAudioPlaying ? "music-visualizer music-visualizer-active" : "music-visualizer"}>
                  {visualizerBars.map((value, index) => (
                    <span
                      key={`${index}-${value.toFixed(3)}`}
                      className="visualizer-bar"
                      style={
                        {
                          "--bar-scale": `${Math.max(0.18, value)}`,
                          "--bar-delay": `${index * 30}ms`
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-shell">
              <div className="empty-orb" aria-hidden="true" />
              <p className="empty-state">{copy.empty}</p>
            </div>
          )}

          {error ? <p className="error-message">{error}</p> : null}
        </aside>
      </section>

      {limitModal.isOpen ? (
        <div className="limit-modal-backdrop" role="presentation">
          <div className="limit-modal" role="dialog" aria-modal="true" aria-labelledby="limit-modal-title">
            <p className="section-kicker">{copy.limitTitle}</p>
            <h3 id="limit-modal-title">{limitModal.file?.name}</h3>
            <p className="limit-modal-text">{copy.limitMessage}</p>
            <p className="limit-modal-details">
              {copy.limitDetails}: {audioLimits.maxUploadSizeMb} MB / {formatDuration(MAX_DURATION_SECONDS)}
            </p>
            <p className="limit-modal-details">
              {language === "ru" ? "Файл" : "File"}:{" "}
              {limitModal.file ? (limitModal.file.size / (1024 * 1024)).toFixed(1) : "0.0"} MB /{" "}
              {formatDuration(limitModal.durationSeconds)}
            </p>
            <div className="limit-modal-actions">
              <button
                className="submit-button"
                type="button"
                onClick={acceptTrimmedUpload}
                disabled={isTrimmingAudio}
              >
                {isTrimmingAudio ? copy.trimming : copy.trimAction}
              </button>
              <button className="secondary-button" type="button" onClick={rejectOversizedUpload} disabled={isTrimmingAudio}>
                {copy.replaceAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
