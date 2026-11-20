import { BrowserWindow } from "electrobun/bun";

new BrowserWindow({
  title: "IntLoom Studio",
  url: "views://studio/index.html",
  frame: { x: 100, y: 100, width: 1000, height: 700 },
});
