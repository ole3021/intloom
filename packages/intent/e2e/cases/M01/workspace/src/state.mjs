const tasks = [];
let nextId = 1;

export function addTask(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed === "") {
    return tasks.slice();
  }
  tasks.push({ id: nextId++, text: trimmed, completed: false });
  return tasks.slice();
}

export function completeTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) task.completed = true;
  return tasks.slice();
}

export function deleteTask(id) {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx >= 0) tasks.splice(idx, 1);
  return tasks.slice();
}

export function getTasks() {
  return tasks.slice();
}

export function _resetForTests() {
  tasks.length = 0;
  nextId = 1;
}
