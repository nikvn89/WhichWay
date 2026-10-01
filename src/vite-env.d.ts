/// <reference types="vite/client" />

interface Window {
  ethereum?: {
    request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
    on?(event: string, callback: (...args: unknown[]) => void): void
    removeListener?(event: string, callback: (...args: unknown[]) => void): void
  }
}
