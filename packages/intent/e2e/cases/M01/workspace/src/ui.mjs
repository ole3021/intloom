import * as state from "./state.mjs";

export function mountTaskList(root, doc = globalThis.document) {
  const input = doc.createElement("input");
  input.type = "text";
  input.placeholder = "Enter a new task";

  const addButton = doc.createElement("button");
  addButton.type = "button";
  addButton.textContent = "Add";

  const list = doc.createElement("ul");
  list.setAttribute("aria-label", "Task list");

  const submit = () => {
    state.addTask(input.value);
    input.value = "";
    rerender();
  };

  addButton.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event && event.key === "Enter") submit();
  });

  function rerender() {
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    for (const task of state.getTasks()) {
      const li = doc.createElement("li");

      const text = doc.createElement("span");
      text.textContent = task.text;
      if (task.completed) {
        text.style.textDecoration = "line-through";
      }

      const completeBtn = doc.createElement("button");
      completeBtn.type = "button";
      completeBtn.textContent = task.completed ? "Completed" : "Complete";
      completeBtn.disabled = task.completed;
      completeBtn.addEventListener("click", () => {
        state.completeTask(task.id);
        rerender();
      });

      const deleteBtn = doc.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        state.deleteTask(task.id);
        rerender();
      });

      li.appendChild(text);
      li.appendChild(completeBtn);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    }
  }

  root.appendChild(input);
  root.appendChild(addButton);
  root.appendChild(list);
  rerender();
}
