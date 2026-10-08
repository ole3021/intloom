import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  SidebarGroup,
  SidebarItem,
  SidebarSectionHeader,
} from "@rspress/core";

type DocsMeta =
  | string
  | { type: "section-header"; label: string }
  | { type: "dir"; name: string; label: string; collapsed?: boolean };

export function docsSidebar(
  directory: string,
  route: string,
): (SidebarItem | SidebarGroup | SidebarSectionHeader)[] {
  const metadata: DocsMeta[] = JSON.parse(
    readFileSync(join(directory, "_meta.json"), "utf8"),
  );
  return metadata.map((item) => {
    if (typeof item === "string") {
      const file = join(directory, `${item}.md`);
      const title = readFileSync(file, "utf8").match(/^title:\s*(.+)$/m)?.[1];
      if (!title) throw new Error(`Missing documentation title: ${file}`);
      return { text: title, link: `${route}/${item}` };
    }
    if (item.type === "section-header") {
      return { sectionHeaderText: item.label };
    }
    if (item.type !== "dir") {
      throw new Error(`Unsupported documentation metadata in ${directory}`);
    }
    return {
      text: item.label,
      ...(item.collapsed === undefined ? {} : { collapsed: item.collapsed }),
      items: docsSidebar(join(directory, item.name), `${route}/${item.name}`),
    };
  });
}
