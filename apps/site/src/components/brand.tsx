import logo from "../../assets/logo.svg";
import styles from "./brand.module.css";

export function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export function Mark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`${styles["loom-mark"]} ${className}`}
      src={logo}
      width="340"
      height="130"
      alt=""
    />
  );
}
