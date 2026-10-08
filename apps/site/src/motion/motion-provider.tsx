import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const MotionPaused = createContext(true);
const ToggleMotion = createContext(() => {});

export function MotionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPaused(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <MotionPaused.Provider value={paused}>
      <ToggleMotion.Provider value={() => setPaused((value) => !value)}>
        {children}
      </ToggleMotion.Provider>
    </MotionPaused.Provider>
  );
}

export function useMotionControl() {
  return { paused: useContext(MotionPaused), toggle: useContext(ToggleMotion) };
}
