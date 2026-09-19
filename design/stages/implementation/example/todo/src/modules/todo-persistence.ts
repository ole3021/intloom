/** OMOD-storage: synchronous, ordered saves of committed snapshots. */
import type { Todo } from './todo-state.ts';
export type SaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'previous-session' };
export interface StoragePort { setItem(key: string, value: string): void; getItem(key: string): string | null; }
export class TodoPersistence {
  readonly key: string;
  private ownsSession = false;
  constructor(private storage: () => StoragePort, implementation: string) { this.key = 'todos-' + implementation; }
  save(todos: readonly Todo[]): SaveResult {
    try {
      const storage = this.storage();
      // Cross-session merge/replace is not defined by Solution. Protect existing
      // nonempty data instead of silently selecting a destructive policy.
      if (!this.ownsSession) {
        const previous = storage.getItem(this.key);
        if (previous !== null && previous !== '[]') return { ok: false, reason: 'previous-session' };
      }
      const snapshot = todos.map(({ id, title, completed }) => ({ id, title, completed }));
      storage.setItem(this.key, JSON.stringify(snapshot));
      this.ownsSession = true;
      return { ok: true };
    } catch { return { ok: false, reason: 'unavailable' }; }
  }
}
