export type PasswordMode = "exact" | "robust";

export type GenerationResponse = {
  algorithm: string;
  fingerprint_preview: string;
  mode: PasswordMode;
  password: string;
};

function getApiBaseUrl(): string {
  // Prefer an explicit deployment URL, but keep localhost painless in development.
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }
  }

  return "";
}

export async function generatePasswordFromAudio(
  file: File,
  mode: PasswordMode,
  trimIfNeeded = false
): Promise<GenerationResponse> {
  // Catch the obvious failure early so the user gets a fast, local error.
  if (file.size === 0) {
    throw new Error("The uploaded file is empty.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);
  formData.append("trim_if_needed", trimIfNeeded ? "true" : "false");

  const response = await fetch(`${getApiBaseUrl()}/api/generate-password`, {
    body: formData,
    method: "POST"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Request failed while generating the password.");
  }

  // The web build treats the backend response as the canonical password output.
  return (await response.json()) as GenerationResponse;
}
