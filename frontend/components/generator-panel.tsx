"use client";

import { useEffect, useState } from "react";
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

const COPY = {
  en: {
    input: "Input",
    uploadAudio: "Upload audio",
    modeTitle: "Fingerprint mode",
    output: "Output",
    fingerprintResult: "Fingerprint result",
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
    password: "Password",
    mode: "Mode",
    algorithm: "Algorithm",
    fingerprintPreview: "Fingerprint preview",
    previewAudio: "Preview audio",
    generationProgress: "Generation progress",
    progressWaiting: "Preparing audio stream",
    progressAnalyzing: "Analyzing spectral fingerprint",
    progressEncoding: "Encoding password output",
    empty: "The generated password and its fingerprint trace will appear here after analysis.",
    trimEnabled: "Trim on upload enabled",
    limitTitle: "Audio exceeds the generator limits",
    limitMessage:
      "This file is larger or longer than the current generator limits. You can trim it to the supported duration or choose another file.",
    limitDetails: "Current limit",
    trimAction: "Trim and continue",
    replaceAction: "Choose another",
    copied: "Copied",
    copy: "Copy",
    show: "Show",
    hide: "Hide"
  },
  ru: {
    input: "Ввод",
    uploadAudio: "Загрузка аудио",
    modeTitle: "Режим отпечатка",
    output: "Результат",
    fingerprintResult: "Результат отпечатка",
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
    password: "Пароль",
    mode: "Режим",
    algorithm: "Алгоритм",
    fingerprintPreview: "Превью отпечатка",
    previewAudio: "Прослушать аудио",
    generationProgress: "Ход генерации",
    progressWaiting: "Подготовка аудиопотока",
    progressAnalyzing: "Анализ спектрального отпечатка",
    progressEncoding: "Формирование пароля",
    empty: "Сгенерированный пароль и краткий след отпечатка появятся здесь после анализа.",
    trimEnabled: "Обрезка при загрузке включена",
    limitTitle: "Аудио превышает лимиты генератора",
    limitMessage:
      "Этот файл больше или длиннее допустимых лимитов. Вы можете обрезать его до поддерживаемой длительности или выбрать другой файл.",
    limitDetails: "Текущий лимит",
    trimAction: "Обрезать и продолжить",
    replaceAction: "Выбрать другой",
    copied: "Скопировано",
    copy: "Копировать",
    show: "Показать",
    hide: "Скрыть"
  }
} as const;

async function getAudioDurationSeconds(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    const duration = await new Promise<number>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve(audio.duration);
      audio.onerror = () => reject(new Error("Audio metadata could not be read."));
      audio.src = objectUrl;
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
  const [limitModal, setLimitModal] = useState<LimitModalState>({
    durationSeconds: 0,
    file: null,
    isOpen: false,
    tooLarge: false,
    tooLong: false
  });
  const copy = COPY[language];

  const modes: Array<{ value: PasswordMode; title: string; description: string }> = [
    {
      value: "exact",
      title: copy.exactTitle,
      description: copy.exactDescription
    },
    {
      value: "robust",
      title: copy.robustTitle,
      description: copy.robustDescription
    }
  ];

  useEffect(() => {
    if (!file) {
      setAudioUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setAudioUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  useEffect(() => {
    setIsPasswordVisible(false);
    setCopyState("idle");
  }, [result]);

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

    return () => {
      window.clearInterval(timer);
    };
  }, [copy.progressAnalyzing, copy.progressEncoding, copy.progressWaiting, isSubmitting]);

  async function handleFileSelection(nextFile: File | null) {
    if (!nextFile) {
      return;
    }

    const durationSeconds = await getAudioDurationSeconds(nextFile).catch(() => 0);
    const tooLarge = nextFile.size > MAX_UPLOAD_SIZE_BYTES;
    const tooLong = durationSeconds > MAX_DURATION_SECONDS;

    setError(null);

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

  function acceptTrimmedUpload() {
    if (!limitModal.file) {
      return;
    }

    setTrimOnUpload(true);
    setFile(limitModal.file);
    setLimitModal((state) => ({ ...state, isOpen: false }));
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
      const response = await generatePasswordFromAudio(file, mode, trimOnUpload);
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
                    {entry.description}
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
              <audio controls className="audio-player" src={audioUrl} />
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
                <code className="password-block">
                  {isPasswordVisible ? result.password : "*".repeat(result.password.length)}
                </code>
                <div className="password-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setIsPasswordVisible((value) => !value)}
                  >
                    {isPasswordVisible ? copy.hide : copy.show}
                  </button>
                  <button className="secondary-button" type="button" onClick={handleCopyPassword}>
                    {copyState === "done" ? copy.copied : copy.copy}
                  </button>
                </div>
              </div>
              <div className="result-meta">
                <div className="meta-tile">
                  <p className="label">{copy.mode}</p>
                  <p>{result.mode}</p>
                </div>
                <div className="meta-tile">
                  <p className="label">{copy.algorithm}</p>
                  <p>{result.algorithm}</p>
                </div>
                <div className="meta-tile meta-tile-wide">
                  <p className="label">{copy.fingerprintPreview}</p>
                  <p>{result.fingerprint_preview}</p>
                </div>
              </div>
              <div className="fingerprint-animation" aria-hidden="true">
                <span className="fingerprint-ring fingerprint-ring-outer" />
                <span className="fingerprint-ring fingerprint-ring-middle" />
                <span className="fingerprint-ring fingerprint-ring-inner" />
                <span className="fingerprint-core" />
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
              {copy.limitDetails}: {audioLimits.maxUploadSizeMb} МБ / {formatDuration(MAX_DURATION_SECONDS)}
            </p>
            <p className="limit-modal-details">
              {language === "ru" ? "Файл" : "File"}:{" "}
              {limitModal.file ? (limitModal.file.size / (1024 * 1024)).toFixed(1) : "0.0"} МБ /{" "}
              {formatDuration(limitModal.durationSeconds)}
            </p>
            <div className="limit-modal-actions">
              <button className="submit-button" type="button" onClick={acceptTrimmedUpload}>
                {copy.trimAction}
              </button>
              <button className="secondary-button" type="button" onClick={rejectOversizedUpload}>
                {copy.replaceAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
