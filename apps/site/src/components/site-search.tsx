import { Search } from "@carbon/icons-react";
import { NoSSR, useI18n } from "@rspress/core/runtime";
import { SearchPanel } from "@rspress/core/theme-original";
import { useCallback, useEffect, useRef, useState } from "react";

export function SiteSearch() {
  const [focused, setFocused] = useState(false);
  const [metaKey, setMetaKey] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const t = useI18n();
  useEffect(() => {
    setMetaKey(/Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl");
  }, []);
  const changeFocus = useCallback((next: boolean) => {
    setFocused(next);
    if (!next) button.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="rp-search-button"
        aria-label={t("searchPlaceholderText")}
        aria-expanded={focused}
        onClick={() => changeFocus(true)}
      >
        <span className="rp-search-button__content">
          <Search size={16} aria-hidden="true" />
          <span className="rp-search-button__word">
            {t("searchPlaceholderText")}
          </span>
        </span>
        <span className="rp-search-button__hotkey" aria-hidden="true">
          <span>{metaKey}</span>
          <span>K</span>
        </span>
      </button>
      <NoSSR>
        <SearchPanel focused={focused} setFocused={changeFocus} />
      </NoSSR>
    </>
  );
}
