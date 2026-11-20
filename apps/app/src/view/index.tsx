import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <main>
        <h1>IntLoom Studio</h1>
        <p>Development scaffold</p>
        <p>The desktop shell is ready for application development.</p>
      </main>
    </StrictMode>,
  );
}
