"use client";

import { useState } from "react";
import { GeneratorPanel } from "@/components/generator-panel";

const COPY = {
  en: {
    eyebrow: "Audio fingerprint password generator",
    title: "MusicGen",
    lede:
      "Upload audio, choose a fingerprint mode, and generate a deterministic password from its spectral signature.",
    copyright: "Copyright (c) 2026 joannoBad"
  },
  ru: {
    eyebrow: "Генератор пароля по аудио-отпечатку",
    title: "MusicGen",
    lede:
      "Загрузите аудио, выберите режим отпечатка и получите детерминированный пароль из его спектральной сигнатуры.",
    copyright: "Copyright (c) 2026 joannoBad"
  }
} as const;

function MusicGenLogo({ compact = false }: { compact?: boolean }) {
  const bars = Array.from({ length: 64 }, (_, index) => {
    const angle = index * 5.625;
    const height = compact ? 6 + ((index * 7) % 10) : 10 + ((index * 7) % 18);
    const isAccent = index % 9 === 0;

    return (
      <span
        key={angle}
        className={isAccent ? "logo-bar logo-bar-accent" : "logo-bar"}
        style={
          {
            "--rotation": `${angle}deg`,
            "--bar-height": `${height}px`
          } as React.CSSProperties
        }
      />
    );
  });

  return (
    <div className={compact ? "musicgen-logo musicgen-logo-compact" : "musicgen-logo"} aria-hidden="true">
      <div className="musicgen-logo-ring">{bars}</div>
      <div className="musicgen-logo-core" />
    </div>
  );
}

export default function HomePage() {
  const [language, setLanguage] = useState<"ru" | "en">("ru");
  const copy = COPY[language];

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-topline">
          <div className="hero-brand">
            <MusicGenLogo />
            <h1>{copy.title}</h1>
          </div>
          <div className="language-switcher" role="group" aria-label="Language switcher">
            <button
              className={language === "ru" ? "language-pill language-pill-active" : "language-pill"}
              type="button"
              onClick={() => setLanguage("ru")}
            >
              RU
            </button>
            <button
              className={language === "en" ? "language-pill language-pill-active" : "language-pill"}
              type="button"
              onClick={() => setLanguage("en")}
            >
              ENG
            </button>
          </div>
        </div>
        <p className="eyebrow hero-eyebrow">{copy.eyebrow}</p>
        <p className="lede">{copy.lede}</p>
      </section>

      <GeneratorPanel language={language} />

      <footer className="page-footer">
        <p className="footer-text">{copy.copyright}</p>
        <button
          type="button"
          className="scroll-top-button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={language === "ru" ? "Наверх" : "Back to top"}
        >
          ↑
        </button>
      </footer>
    </main>
  );
}
