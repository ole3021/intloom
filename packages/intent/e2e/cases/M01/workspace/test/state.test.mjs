import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";

import {
  addTask,
  completeTask,
  deleteTask,
  getTasks,
  _resetForTests,
} from "../src/state.mjs";

describe("state module", () => {
  beforeEach(() => {
    _resetForTests();
  });

  test("addTask appends a new task that is not complete", () => {
    addTask("Buy milk");
    const tasks = getTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].text, "Buy milk");
    assert.equal(tasks[0].completed, false);
  });

  test("addTask does not create a task for empty input", () => {
    addTask("");
    assert.equal(getTasks().length, 0);
  });

  test("addTask does not create a task for whitespace-only input", () => {
    addTask("   \t\n");
    assert.equal(getTasks().length, 0);
  });

  test("addTask trims surrounding whitespace from accepted input", () => {
    addTask("  Read book  ");
    const tasks = getTasks();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].text, "Read book");
  });

  test("completeTask marks only the matching task as complete", () => {
    addTask("Task A");
    addTask("Task B");
    addTask("Task C");

    completeTask(getTasks()[1].id);

    const after = getTasks();
    assert.equal(after[0].completed, false);
    assert.equal(after[1].completed, true);
    assert.equal(after[2].completed, false);
  });

  test("completeTask leaves state unchanged for a non-existing id", () => {
    addTask("Only one");
    completeTask(9999);
    const after = getTasks();
    assert.equal(after.length, 1);
    assert.equal(after[0].completed, false);
  });

  test("deleteTask removes only the matching task and keeps the rest", () => {
    addTask("Task A");
    addTask("Task B");
    addTask("Task C");

    deleteTask(getTasks()[1].id);

    const after = getTasks();
    assert.equal(after.length, 2);
    assert.equal(after[0].text, "Task A");
    assert.equal(after[1].text, "Task C");
  });

  test("deleteTask leaves state unchanged for a non-existing id", () => {
    addTask("Survives");
    deleteTask(9999);
    const after = getTasks();
    assert.equal(after.length, 1);
    assert.equal(after[0].text, "Survives");
  });

  test("returned snapshots do not mutate internal state when edited", () => {
    addTask("Snapshot");
    const snapshot = getTasks();
    snapshot.length = 0;
    assert.equal(getTasks().length, 1);
  });
});
