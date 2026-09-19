import { TodoStore, type Todo, type Filter } from './modules/todo-state.ts';
import { FilterRouter } from './modules/filter-router.ts';
/** OMOD-ui: drafts and editing sessions stay here, never in TodoStore. */
export function mountTodo(root: HTMLElement, store: TodoStore, router: FilterRouter) {
  const doc = root.ownerDocument;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  root.replaceChildren();
  const title = element('h1', '', 'todos');
  const card = element('section', 'todoapp');
  card.setAttribute('aria-label', 'Todo list');
  root.append(title, card);
  const header = element('header', 'header');
  const input = element('input', 'new-todo');
  input.placeholder = 'What needs to be done?'; input.setAttribute('aria-label', 'New todo');
  header.append(input); card.append(header);
  const main = element('section', 'main');
  const list = element('ul', 'todo-list');
  main.append(list); card.append(main);
  const rows = new Map<string, HTMLLIElement>();
  let filter: Filter = router.current();
  let editing: { id: string; input: HTMLInputElement; closed: boolean } | undefined;
  const footer = element('footer', 'footer');
  const count = element('span', 'todo-count'); footer.append(count); card.append(footer);
  const toggleAll = element('input', 'toggle-all'); toggleAll.type = 'checkbox';
  toggleAll.id = 'toggle-all'; toggleAll.setAttribute('aria-label', 'Toggle all');
  const allLabel = element('label', 'toggle-all-label', '❯'); allLabel.htmlFor = 'toggle-all'; allLabel.title = 'Toggle all';
  main.prepend(toggleAll, allLabel);
  toggleAll.addEventListener('change', () => store.setAll(toggleAll.checked));
  const clear = element('button', 'clear-completed', 'Clear completed'); clear.type = 'button';
  clear.addEventListener('click', () => store.clearCompleted()); footer.append(clear);
  const filters = element('nav', 'filters'); filters.setAttribute('aria-label', 'Filter todos');
  const filterLinks = new Map<Filter, HTMLAnchorElement>();
  for (const [key, label] of [['all', 'All'], ['active', 'Active'], ['completed', 'Completed']] as const) {
    const link = element('a', '', label); link.href = key === 'all' ? '#/' : '#/' + key;
    link.addEventListener('click', event => { event.preventDefault(); filter = router.select(key); render(); });
    filterLinks.set(key, link); filters.append(link);
  }
  footer.insertBefore(filters, clear);
  const status = element('p', 'save-status'); status.setAttribute('role', 'status'); status.hidden = true; card.after(status);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing && store.add(input.value)) input.value = '';
  });
  function beginEdit(todo: Todo, row: HTMLLIElement) {
    if (editing?.id === todo.id) return;
    if (editing) finishEdit(editing, false);
    const editor = element('input', 'edit'); editor.value = todo.title; editor.setAttribute('aria-label', 'Edit todo');
    const session = { id: todo.id, input: editor, closed: false }; editing = session;
    row.classList.add('editing'); row.append(editor);
    editor.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); finishEdit(session, false); }
      if (event.key === 'Escape') { event.preventDefault(); finishEdit(session, true); }
    });
    editor.addEventListener('blur', () => finishEdit(session, false));
    editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length);
  }
  function finishEdit(session: NonNullable<typeof editing>, cancel: boolean) {
    if (session.closed || editing !== session) return;
    session.closed = true; editing = undefined;
    if (!cancel) store.rename(session.id, session.input.value);
    render();
  }
  function render() {
    const view = store.read(filter);
    main.hidden = view.empty;
    footer.hidden = view.empty;
    const number = element('strong', '', String(view.remaining));
    count.replaceChildren(number, doc.createTextNode(view.remaining === 1 ? ' item left' : ' items left'));
    toggleAll.checked = view.allCompleted;
    clear.hidden = !view.hasCompleted;
    for (const [key, link] of filterLinks) { link.classList.toggle('selected', key === filter); if (key === filter) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
    const visible = new Set(view.visible.map(todo => todo.id));
    for (const [id, row] of rows) if (!visible.has(id)) { row.remove(); rows.delete(id); }
    let position = 0;
    for (const todo of view.visible) {
      let row = rows.get(todo.id);
      if (!row) { row = element('li'); row.dataset.id = todo.id; rows.set(todo.id, row); }
      if (list.children[position] !== row) list.insertBefore(row, list.children[position] ?? null);
      position++;
      if (editing?.id === todo.id) continue;
      row.className = todo.completed ? 'completed' : '';
      const content = element('div', 'view');
      const toggle = element('input', 'toggle'); toggle.type = 'checkbox'; toggle.checked = todo.completed;
      toggle.setAttribute('aria-label', 'Toggle ' + todo.title);
      toggle.addEventListener('change', () => store.setCompleted(todo.id, toggle.checked)); content.append(toggle);
      const label = element('label', 'title', todo.title);
      label.addEventListener('dblclick', () => beginEdit(todo, row!));
      content.append(label);
      const remove = element('button', 'destroy', '×'); remove.type = 'button'; remove.setAttribute('aria-label', 'Delete ' + todo.title);
      remove.addEventListener('click', () => store.remove(todo.id)); content.append(remove);
      row.replaceChildren(content);
    }
    status.hidden = store.saveResult.ok;
    status.textContent = store.saveResult.ok ? '' : store.saveResult.reason === 'previous-session' ? 'Earlier saved todos are protected. Current changes are not saved.' : 'Changes could not be saved in this browser.';
  }
  const unsubscribe = store.subscribe(render);
  const unsubscribeRoute = router.subscribe(value => { filter = value; render(); });
  render(); input.focus();
  const info = element('footer', 'info');
  info.append(element('p', '', 'Double-click to edit a todo'), element('p', '', 'Created by IntLoom'));
  const attribution = element('p'); const link = element('a', '', 'Part of TodoMVC'); link.href = 'https://todomvc.com/'; attribution.append(link); info.append(attribution); root.append(info);
  return () => { unsubscribe(); unsubscribeRoute(); router.dispose(); root.replaceChildren(); };
}
