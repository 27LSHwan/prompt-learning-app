const DEFAULT_API_BASE_URL = 'http://localhost:8000';

let runtimeEnv: Record<string, string> = {};
let loaded = false;

function parseEnvFile(raw: string): Record<string, string> {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce<Record<string, string>>((acc, line) => {
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) return acc;
      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();
      acc[key] = value.replace(/^['"]|['"]$/g, '');
      return acc;
    }, {});
}

export async function loadRuntimeEnv(): Promise<void> {
  if (loaded) return;

  try {
    const res = await fetch('/.env', { cache: 'no-store' });
    if (res.ok) {
      runtimeEnv = parseEnvFile(await res.text());
    }
  } catch {
    runtimeEnv = {};
  } finally {
    loaded = true;
  }
}

export function getApiBaseUrl(): string {
  return runtimeEnv.API_BASE_URL || DEFAULT_API_BASE_URL;
}
