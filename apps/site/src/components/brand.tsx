import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from "@carbon/icons-react";
import logo from "../../assets/logo.svg";
import styles from "./brand.module.css";

const arrows = {
  "up-right": ArrowUpRight,
  right: ArrowRight,
  "down-right": ArrowDownRight,
  "down-left": ArrowDownLeft,
};

export function Arrow({
  direction = "up-right",
  size = 16,
}: {
  direction?: keyof typeof arrows;
  size?: 16 | 20;
}) {
  const Icon = arrows[direction];
  return (
    <span className={styles.arrow} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
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
