import { createRoot } from "react-dom/client";
import { StudioProvider } from "./lib/studio";
import { App } from "./app";
import { connect } from "./desktop";
import "./styles.css";
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element.");
const root = createRoot(container);
connect()
  .then((api) =>
    root.render(
      <StudioProvider api={api}>
        <App />
      </StudioProvider>,
    ),
  )
  .catch((error) =>
    root.render(<main className="p-8">工作台连接失败：{String(error)}</main>),
  );
