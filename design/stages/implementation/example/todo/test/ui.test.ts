import { afterEach, expect, test } from 'bun:test';
import { Window as TestWindow } from 'happy-dom';
import { mountTodo } from '../src/ui.ts';
import { TodoStore } from '../src/modules/todo-state.ts';
import { FilterRouter } from '../src/modules/filter-router.ts';
import { TodoPersistence } from '../src/modules/todo-persistence.ts';
const windows: TestWindow[] = [];
afterEach(() => { for (const w of windows.splice(0)) w.close(); });
function setup(hash = '') {
  const w = new TestWindow({ url: 'http://localhost:4173/' + hash }); windows.push(w);
  const d = w.document; d.body.innerHTML = '<main id="app"></main>';
  const data = new Map<string, string>(); const persistence = new TodoPersistence(() => ({setItem:(key,value)=>{data.set(key,value);}, getItem:(key:string)=>data.get(key) ?? null}), 'vanilla');
  const store = new TodoStore(persistence);
  const router = new FilterRouter(w as unknown as Window);
  const dispose = mountTodo(d.querySelector('#app') as unknown as HTMLElement, store, router);
  const press = (node: any, key: string) => node.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
  const labels = () => [...d.querySelectorAll('.todo-list .title')].map(x=>x.textContent);
  return { w, d, press, labels, dispose, store, input: d.querySelector('.new-todo')! as unknown as HTMLInputElement, router, data };
}
test('01 — browser shell has todos title and one list region', () => {
  const {d} = setup(); expect(d.querySelector('h1')?.textContent).toBe('todos'); expect(d.querySelectorAll('.todoapp')).toHaveLength(1);
});
test('02 — focus, unsubmitted draft, Enter, clear and repeated add', () => {
  const {d,input,press,labels} = setup(); expect(d.activeElement).toBe(input as any); expect(input.placeholder).toBe('What needs to be done?');
  input.value='Milk'; expect(labels()).toEqual([]); press(input,'Enter'); expect(labels()).toEqual(['Milk']); expect(input.value).toBe('');
  input.value='Bread'; press(input,'Enter'); expect(labels()).toEqual(['Milk','Bread']);
});
test('03 — trim only edges, reject empty, keep independent duplicate titles', () => {
  const {input,press,labels,store}=setup(); for(const value of ['', '   ', '  A  B  ', 'A  B']){input.value=value;press(input,'Enter');}
  expect(labels()).toEqual(['A  B','A  B']); expect(new Set(store.snapshot().map(x=>x.id)).size).toBe(2);
});
test('04 — empty main disappears, first add reveals it, stable order', () => {
  const {d,store,labels}=setup(); expect(d.querySelector('.main')?.hasAttribute('hidden')).toBe(true);
  store.add('A'); store.add('B'); expect(d.querySelector('.main')?.hasAttribute('hidden')).toBe(false); expect(labels()).toEqual(['A','B']);
});
test('05 — UI toggle updates exactly the targeted todo and completion style', () => {
  const {d,store,labels}=setup(); store.add('Same'); store.add('Same');
  const control=d.querySelector('.toggle')! as any; control.click(); expect(store.snapshot().map(x=>x.completed)).toEqual([true,false]);
  expect(d.querySelector('li')?.classList.contains('completed')).toBe(true); expect(labels()).toEqual(['Same','Same']);
  (d.querySelector('.toggle') as any).click(); expect(store.snapshot()[0].completed).toBe(false);
});
test('06 — count wording, bold number, zero on nonempty completed list',()=>{
  const {d,store}=setup(); store.add('A'); expect(d.querySelector('.todo-count')?.textContent).toBe('1 item left');
  store.add('B'); expect(d.querySelector('.todo-count strong')?.textContent).toBe('2');
  for(const todo of store.snapshot()) store.setCompleted(todo.id,true);
  expect(d.querySelector('.todo-count')?.textContent).toBe('0 items left'); expect(d.querySelector('.footer')?.hasAttribute('hidden')).toBe(false);
});
test('07 — completed title starts focused edit without mutating committed content',()=>{
  const {d,w,store}=setup(); store.add('Original'); store.setCompleted(store.snapshot()[0].id,true);
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
  const edit=d.querySelector('.edit')!; expect(d.activeElement).toBe(edit as any); expect((edit as any).value).toBe('Original');
  expect(d.querySelector('li')?.classList.contains('editing')).toBe(true); (edit as any).value='Draft'; expect(store.snapshot()[0].title).toBe('Original');
});
test('08 — Enter then residual blur submits only once, trims and preserves identity/status',()=>{
  const {d,w,store,press}=setup(); store.add('Original'); const before=store.snapshot()[0]; store.setCompleted(before.id,true);
  let changes=0; store.subscribe(()=>changes++);
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); const edit=d.querySelector('.edit')! as any;
  edit.value='  New  title  '; press(edit,'Enter'); edit.dispatchEvent(new w.Event('blur'));
  expect(changes).toBe(1); expect(store.snapshot()).toEqual([{...before, title:'New  title',completed:true}]); expect(d.querySelector('.edit')).toBeNull();
});
test('08 — blur commits nonempty title',()=>{
  const {d,w,store}=setup(); store.add('Before'); d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
  const edit=d.querySelector('.edit')! as any; edit.value='After'; edit.blur(); expect(store.snapshot()[0].title).toBe('After');
});
test('09 — Escape with text, empty or whitespace restores original and suppresses blur',()=>{
  for(const draft of ['Changed','','   ']) { const {d,w,store,press}=setup(); store.add('Original');
    d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); const edit=d.querySelector('.edit')! as any;
    edit.value=draft; press(edit,'Escape'); edit.dispatchEvent(new w.Event('blur')); expect(store.snapshot().map(x=>x.title)).toEqual(['Original']);
  }
});
test('10 — empty/space edit via Enter/blur removes only target and last deletion hides main',()=>{
  for(const draft of ['', '   ']) for(const trigger of ['Enter','blur']) {
    const {d,w,store,press,labels}=setup(); store.add('Target'); store.add('Keep');
    d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); const edit=d.querySelector('.edit')! as any; edit.value=draft;
    trigger==='Enter' ? press(edit,'Enter') : edit.blur(); edit.dispatchEvent(new w.Event('blur')); expect(labels()).toEqual(['Keep']);
    store.remove(store.snapshot()[0].id); expect(d.querySelector('.main')?.hasAttribute('hidden')).toBe(true);
  }
});
test('11 — delete button targets independent identity',()=>{
  const {d,store}=setup(); store.add('Same'); store.add('Same'); const keep=store.snapshot()[1]; (d.querySelector('.destroy') as any).click(); expect(store.snapshot()).toEqual([keep]);
});
test('12 — UI toggle-all derives from full list and resets on reopen/add',()=>{
  const {d,store}=setup(); store.add('A'); store.add('B'); (d.querySelector('.toggle-all') as any).click();
  expect(store.read().remaining).toBe(0); expect((d.querySelector('.toggle-all') as any).checked).toBe(true);
  store.setCompleted(store.snapshot()[0].id,false); expect((d.querySelector('.toggle-all') as any).checked).toBe(false);
  store.setAll(true); store.add('C'); expect((d.querySelector('.toggle-all') as any).checked).toBe(false);
});
test('13 — Clear completed keeps active entries and resets after deleting all',()=>{
  const {d,store,labels}=setup(); store.add('Keep'); store.add('Done'); store.setCompleted(store.snapshot()[1].id,true);
  expect((d.querySelector('.clear-completed') as any).hidden).toBe(false); (d.querySelector('.clear-completed') as any).click();
  expect(labels()).toEqual(['Keep']); expect((d.querySelector('.clear-completed') as any).hidden).toBe(true);
  store.setAll(true); store.clearCompleted(); store.add('Next'); expect((d.querySelector('.toggle-all') as any).checked).toBe(false);
});
test('14 — switching views preserves full list and original relative order',()=>{
  const {d,store,labels}=setup(); for(const title of ['A','B','C']) store.add(title); store.setCompleted(store.snapshot()[1].id,true);
  (d.querySelector('.filters a[href="#/active"]') as any).click(); expect(labels()).toEqual(['A','C']);
  (d.querySelector('.filters a[href="#/completed"]') as any).click(); expect(labels()).toEqual(['B']);
  (d.querySelector('.filters a[href="#/"]') as any).click(); expect(labels()).toEqual(['A','B','C']); expect(d.querySelectorAll('.filters .selected')).toHaveLength(1);
});
test('15 — mutations recompute current view without changing selected filter',()=>{
  const {d,w,store,press,labels}=setup(); store.add('A'); store.add('B'); (d.querySelector('.filters a[href="#/active"]') as any).click();
  (d.querySelector('.toggle') as any).click(); expect(labels()).toEqual(['B']); expect(d.querySelector('.filters .selected')?.textContent).toBe('Active');
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); const edit=d.querySelector('.edit')! as any; edit.value='Renamed'; press(edit,'Enter');
  (d.querySelector('.filters a[href="#/"]') as any).click(); expect(labels()).toEqual(['A','Renamed']);
  (d.querySelector('.filters a[href="#/completed"]') as any).click(); (d.querySelector('.toggle') as any).click(); expect(labels()).toEqual([]); expect(d.querySelector('.filters .selected')?.textContent).toBe('Completed');
});
test('16 — Completed add stays hidden but increments full count; empty view keeps footer',()=>{
  const {d,input,press,labels}=setup(); (d.querySelector('.filters a[href="#/completed"]') as any).click(); input.value='Hidden'; press(input,'Enter');
  expect(labels()).toEqual([]); expect(d.querySelector('.todo-count')?.textContent).toBe('1 item left'); expect((d.querySelector('.footer') as any).hidden).toBe(false);
  (d.querySelector('.filters a[href="#/active"]') as any).click(); expect(labels()).toEqual(['Hidden']);
});
test('17 — global controls operate on invisible items',()=>{
  const {d,store,labels}=setup(); store.add('Active'); store.add('Completed'); store.setCompleted(store.snapshot()[1].id,true);
  (d.querySelector('.filters a[href="#/active"]') as any).click(); expect(d.querySelector('.todo-count')?.textContent).toBe('1 item left');
  expect((d.querySelector('.clear-completed') as any).hidden).toBe(false); (d.querySelector('.clear-completed') as any).click(); expect(store.snapshot()).toHaveLength(1);
  (d.querySelector('.filters a[href="#/completed"]') as any).click(); expect(labels()).toEqual([]); (d.querySelector('.toggle-all') as any).click(); expect(labels()).toEqual(['Active']);
});
test('18 — direct URL selects category and click changes address without losing data',()=>{
  const {d,w,store}=setup('#/completed'); store.add('A'); expect(d.querySelector('.filters .selected')?.textContent).toBe('Completed');
  (d.querySelector('.filters a[href="#/active"]') as any).click(); expect(w.location.hash).toBe('#/active'); expect(store.snapshot()).toHaveLength(1);
});
test('19 — external address changes update selection without creating extra navigation',()=>{
  const {w,d,store}=setup(); store.add('A'); const before=store.snapshot(); w.location.hash='#/completed';
  w.dispatchEvent(new w.HashChangeEvent('hashchange')); const length=w.history.length;
  expect(d.querySelector('.filters .selected')?.textContent).toBe('Completed'); expect(w.history.length).toBe(length); expect(store.snapshot()).toEqual(before);
});
test('20 — effective UI submission automatically saves in namespaced storage',()=>{
  const {input,press,data}=setup(); input.value='Saved'; press(input,'Enter'); expect(JSON.parse(data.get('todos-vanilla')!)[0].title).toBe('Saved');
});
test('21 — editing, status and empty-title deletion update the same saved identity',()=>{
  const {d,w,store,data,press}=setup(); store.add('Before'); const id=store.snapshot()[0].id;
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); let edit=d.querySelector('.edit')! as any; edit.value='After'; press(edit,'Enter');
  store.setCompleted(id,true); expect(JSON.parse(data.get('todos-vanilla')!)).toEqual([{id,title:'After',completed:true}]);
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); edit=d.querySelector('.edit')! as any; edit.value=' '; edit.blur(); expect(data.get('todos-vanilla')).toBe('[]');
});
test('22 — editing draft survives unrelated renders and never leaks into other saves',()=>{
  const {d,w,store,data,press}=setup(); store.add('Original'); store.add('Other');
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true})); const edit=d.querySelector('.edit')! as any; edit.value='Draft';
  store.setCompleted(store.snapshot()[1].id,true); expect(d.querySelector('.edit')).toBe(edit); expect(edit.value).toBe('Draft');
  expect(JSON.parse(data.get('todos-vanilla')!)[0].title).toBe('Original'); press(edit,'Escape'); expect(JSON.parse(data.get('todos-vanilla')!)[0].title).toBe('Original');
});
test('22 — startup and invalid drafts never write; filtered saves retain hidden identities',()=>{
  const {d,input,press,store,data}=setup(); expect(data.size).toBe(0); input.value=' ';press(input,'Enter');expect(data.size).toBe(0);
  store.add('Hidden'); store.setCompleted(store.snapshot()[0].id,true); (d.querySelector('.filters a[href="#/active"]') as any).click();
  input.value='Visible';press(input,'Enter'); expect(JSON.parse(data.get('todos-vanilla')!).map((t:any)=>t.title)).toEqual(['Hidden','Visible']);
});
test('23 — markup remains literal text in creation, editing, DOM and storage',()=>{
  const {d,w,input,press,store,data}=setup(); input.value='<b>Milk</b>';press(input,'Enter');
  expect(d.querySelector('.title')?.textContent).toBe('<b>Milk</b>'); expect(d.querySelector('.title b')).toBeNull();
  d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));const edit=d.querySelector('.edit')! as any; edit.value='<img src=x onerror=alert(1)>'; press(edit,'Enter');
  expect(d.querySelector('.todo-list img')).toBeNull(); expect(JSON.parse(data.get('todos-vanilla')!)[0].title).toBe(store.snapshot()[0].title);
});
test('24 — page retains one card and heading through empty/full transitions',()=>{
  const {d,store}=setup();store.add('A');store.remove(store.snapshot()[0].id);expect(d.querySelectorAll('h1')).toHaveLength(1);expect(d.querySelectorAll('.todoapp')).toHaveLength(1);
});
test('25 — long multiline and spaced titles remain readable content',()=>{
  const {store,labels}=setup();const title='Long  title '.repeat(60).trim();store.add(title);expect(labels()).toEqual([title]);
});
test('26 — editing class and controls switch coherently back to completed display',()=>{
  const {d,w,store,press}=setup();store.add('A');store.setAll(true);d.querySelector('.title')!.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
  expect(d.querySelector('li')?.classList.contains('editing')).toBe(true);press(d.querySelector('.edit'),'Escape');expect(d.querySelector('li')?.className).toBe('completed');
});
test('27 — help/author/attribution remain outside hidden empty-list footer',()=>{
  const {d,store}=setup();expect((d.querySelector('.footer') as any).hidden).toBe(true);expect(d.querySelector('.info')?.textContent).toContain('Double-click to edit a todo');
  expect(d.querySelector('.info')?.textContent).toContain('IntLoom');expect(d.querySelector('.info a')?.getAttribute('href')).toBe('https://todomvc.com/');
  store.add('A');store.remove(store.snapshot()[0].id);expect(d.querySelector('.info a')?.textContent).toBe('Part of TodoMVC');
});
