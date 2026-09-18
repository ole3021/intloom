/** OMOD-store: the only owner of committed todos and derived views. */
import type { TodoPersistence, SaveResult } from './todo-persistence.ts';
export interface Todo { id: string; title: string; completed: boolean }
export type Filter = 'all' | 'active' | 'completed';
export class TodoStore {
  private todos: Todo[] = [];
  private listeners = new Set<() => void>();
  saveResult: SaveResult = { ok: true };
  constructor(private persistence?: Pick<TodoPersistence, 'save'>) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  snapshot(): Todo[] { return this.todos.map(todo => ({ ...todo })); }
  read(filter: Filter = 'all') {
    const all = this.snapshot();
    return { visible: all.filter(todo => filter === 'all' || (filter === 'completed' ? todo.completed : !todo.completed)),
      empty: all.length === 0,
      remaining: all.filter(todo => !todo.completed).length,
      allCompleted: all.length > 0 && all.every(todo => todo.completed),
      hasCompleted: all.some(todo => todo.completed),
    };
  }
  private commit(next: Todo[]) {
    this.todos = next;
    this.saveResult = this.persistence?.save(this.snapshot()) ?? { ok: true };
    for (const listener of this.listeners) listener();
    return true;
  }
  add(raw: string) {
    const title = raw.trim();
    if (!title) return false;
    return this.commit([...this.todos, { id: crypto.randomUUID(), title, completed: false }]);
  }
  setCompleted(id: string, completed: boolean) {
    if (!this.todos.some(todo => todo.id === id && todo.completed !== completed)) return false;
    return this.commit(this.todos.map(todo => todo.id === id ? { ...todo, completed } : todo));
  }
  rename(id: string, raw: string) {
    const title = raw.trim();
    if (!title) return this.remove(id);
    if (!this.todos.some(todo => todo.id === id && todo.title !== title)) return false;
    return this.commit(this.todos.map(todo => todo.id === id ? { ...todo, title } : todo));
  }
  remove(id: string) {
    if (!this.todos.some(todo => todo.id === id)) return false;
    return this.commit(this.todos.filter(todo => todo.id !== id));
  }
  setAll(completed: boolean) {
    if (!this.todos.some(todo => todo.completed !== completed)) return false;
    return this.commit(this.todos.map(todo => ({ ...todo, completed })));
  }
  clearCompleted() {
    if (!this.todos.some(todo => todo.completed)) return false;
    return this.commit(this.todos.filter(todo => !todo.completed));
  }
}
