/**
 * Capa de almacenamiento aislada. Hoy: localStorage (síncrono, imprescindible para
 * guardar en `pagehide`/`visibilitychange` sin perder el último instante).
 * Para pasar a servidor: implementar esta interfaz (p. ej. caché local síncrona +
 * subida asíncrona en `flush`) y cambiar la instancia en createStorage().
 */
export interface SaveStorage {
  readonly name: string;
  read(): string | null;
  write(data: string): void;
  clear(): void;
  /** Para backends remotos: sincroniza en segundo plano. Local: no hace nada. */
  flush?(): Promise<void>;
}

const KEY = 'gengi.save';

export class LocalSaveStorage implements SaveStorage {
  readonly name = 'localStorage';
  read() { try { return localStorage.getItem(KEY); } catch { return null; } }
  write(data: string) { localStorage.setItem(KEY, data); }
  clear() { localStorage.removeItem(KEY); }
}

export class MemorySaveStorage implements SaveStorage {
  readonly name = 'memoria';
  private v: string | null = null;
  read() { return this.v; }
  write(d: string) { this.v = d; }
  clear() { this.v = null; }
}

export function createStorage(): SaveStorage {
  try {
    const k = '__gengi_test';
    localStorage.setItem(k, '1'); localStorage.removeItem(k);
    // Pide almacenamiento persistente (Safari/Chrome pueden respetarlo si está instalada).
    navigator.storage?.persist?.().catch(() => undefined);
    return new LocalSaveStorage();
  } catch {
    return new MemorySaveStorage();
  }
}
