import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";

import { mountTaskList } from "../src/ui.mjs";
import * as state from "../src/state.mjs";

function createMockDoc() {
  function Element(tag) {
    this.tagName = String(tag ?? "").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._textContent = "";
    this._attrs = new Map();
    this.style = {};
    this._listeners = new Map();
    this.disabled = false;
    this.type = "";
    this.placeholder = "";
    this.value = "";
  }
  Element.prototype.setAttribute = function (name, value) {
    this._attrs.set(String(name), String(value));
  };
  Element.prototype.getAttribute = function (name) {
    return this._attrs.get(String(name)) ?? null;
  };
  Element.prototype.appendChild = function (child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  };
  Element.prototype.removeChild = function (child) {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parentNode = null;
    }
    return child;
  };
  Object.defineProperty(Element.prototype, "firstChild", {
    get() {
      return this.children[0] ?? null;
    },
  });
  Object.defineProperty(Element.prototype, "textContent", {
    get() {
      if (this.children.length > 0) {
        return this.children.map((c) => c.textContent).join("");
      }
      return this._textContent;
    },
    set(v) {
      this._textContent = String(v);
      for (const c of this.children) c.parentNode = null;
      this.children.length = 0;
    },
  });
  Element.prototype.addEventListener = function (name, fn) {
    const list = this._listeners.get(name) ?? [];
    list.push(fn);
    this._listeners.set(name, list);
  };
  Element.prototype.click = function () {
    const handlers = this._listeners.get("click") ?? [];
    for (const h of handlers) h({ type: "click" });
  };
  Element.prototype.dispatch = function (event) {
    const handlers = this._listeners.get(event.type) ?? [];
    for (const h of handlers) h(event);
  };

  return {
    createElement(tag) {
      return new Element(tag);
    },
  };
}

describe("ui module", () => {
  let doc, root;
  beforeEach(() => {
    state._resetForTests();
    doc = createMockDoc();
    root = doc.createElement("div");
  });

  function getInput() {
    return root.children[0];
  }
  function getAddButton() {
    return root.children[1];
  }
  function getList() {
    return root.children[2];
  }

  test("renders English-labeled input and Add button when mounted", () => {
    mountTaskList(root, doc);

    const input = getInput();
    const addBtn = getAddButton();
    const list = getList();

    assert.equal(input.tagName, "INPUT");
    assert.equal(input.type, "text");
    assert.match(input.placeholder, /\w/);

    assert.equal(addBtn.tagName, "BUTTON");
    assert.equal(addBtn.textContent, "Add");

    assert.equal(list.tagName, "UL");
    assert.equal(list.children.length, 0);
  });

  test("renders English Complete and Delete controls for an added task", () => {
    mountTaskList(root, doc);
    getInput().value = "Walk the dog";
    getAddButton().click();

    const list = getList();
    assert.equal(list.children.length, 1);

    const li = list.children[0];
    assert.equal(li.children[0].tagName, "SPAN");
    assert.equal(li.children[0].textContent, "Walk the dog");
    assert.equal(li.children[1].tagName, "BUTTON");
    assert.equal(li.children[1].textContent, "Complete");
    assert.equal(li.children[2].tagName, "BUTTON");
    assert.equal(li.children[2].textContent, "Delete");
  });

  test("does not add a task when the input is empty", () => {
    mountTaskList(root, doc);
    getInput().value = "";
    getAddButton().click();

    assert.equal(getList().children.length, 0);
    assert.equal(state.getTasks().length, 0);
  });

  test("does not add a task when the input is whitespace only", () => {
    mountTaskList(root, doc);
    getInput().value = "   ";
    getAddButton().click();

    assert.equal(getList().children.length, 0);
    assert.equal(state.getTasks().length, 0);
  });

  test("marks only the targeted task as complete with a visible indication", () => {
    mountTaskList(root, doc);
    getInput().value = "Task A";
    getAddButton().click();
    getInput().value = "Task B";
    getAddButton().click();

    getList().children[0].children[1].click();

    const after = getList().children;
    assert.equal(after.length, 2);

    const [first, second] = after;
    assert.equal(first.children[0].style.textDecoration, "line-through");
    assert.equal(first.children[1].textContent, "Completed");
    assert.equal(first.children[1].disabled, true);

    assert.equal(second.children[0].style.textDecoration, undefined);
    assert.equal(second.children[1].textContent, "Complete");
    assert.equal(second.children[1].disabled, false);
  });

  test("deletes only the targeted task and keeps the others visible", () => {
    mountTaskList(root, doc);
    getInput().value = "Task A";
    getAddButton().click();
    getInput().value = "Task B";
    getAddButton().click();
    getInput().value = "Task C";
    getAddButton().click();

    getList().children[1].children[2].click();

    const after = getList().children;
    assert.equal(after.length, 2);
    assert.equal(after[0].children[0].textContent, "Task A");
    assert.equal(after[1].children[0].textContent, "Task C");
  });

  test("pressing Enter in the input submits the task", () => {
    mountTaskList(root, doc);
    const input = getInput();
    input.value = "Submit via Enter";
    input.dispatch({ type: "keydown", key: "Enter" });

    const list = getList();
    assert.equal(list.children.length, 1);
    assert.equal(list.children[0].children[0].textContent, "Submit via Enter");
    assert.equal(input.value, "");
  });

  test("clears the input after a task is added", () => {
    mountTaskList(root, doc);
    getInput().value = "Read book";
    getAddButton().click();

    assert.equal(getInput().value, "");
  });
});
