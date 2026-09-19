/** OMOD-router: address selection only; TodoStore owns the matching rules. */
import type { Filter } from './todo-state.ts';
export function parseFilter(hash: string): Filter {
  return hash === '#/active' ? 'active' : hash === '#/completed' ? 'completed' : 'all';
}
export class FilterRouter {
  private listeners = new Set<(filter: Filter) => void>();
  private notify = () => { for (const listener of this.listeners) listener(this.current()); };
  constructor(private browser: Window) { browser.addEventListener('hashchange', this.notify); }
  current(): Filter { return parseFilter(this.browser.location.hash); }
  select(filter: Filter) {
    const hash = filter === 'all' ? '#/' : '#/' + filter;
    if (this.browser.location.hash !== hash) this.browser.location.hash = hash;
    return this.current();
  }
  subscribe(listener: (filter: Filter) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  dispose() { this.browser.removeEventListener('hashchange', this.notify); this.listeners.clear(); }
}
