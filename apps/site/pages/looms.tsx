import { useScrollAfterNav } from "@rspress/core/theme-original";
import { useHead, useLocation } from "@rspress/core/runtime";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Close,
  Search,
} from "@carbon/icons-react";
import { useEffect, useRef, useState } from "react";
import catalog from "../data/looms.json";
import { Command } from "../src/components/command.tsx";
import { AnimatedList } from "../src/components/motion/animated-list.tsx";
import { DecryptedText } from "../src/components/motion/decrypted-text.tsx";
import "../src/styles/catalog.css";

export const frontmatter = { pageType: "custom", title: "Looms — IntLoom" };
const types = [...new Set(catalog.map((loom) => loom.kind))];
const fileNumber = (loom: (typeof catalog)[number]) =>
  String(catalog.indexOf(loom) + 1).padStart(3, "0");

export default function Looms() {
  useHead({ title: frontmatter.title });
  const location = useLocation();
  return <LoomDirectory key={location.key} />;
}

function LoomDirectory() {
  useScrollAfterNav();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState<(typeof catalog)[number] | null>(
    null,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const terms = search.toLowerCase().trim().split(/\s+/);
  const matches = catalog.filter((loom) => {
    const text = [
      loom.name,
      loom.title,
      loom.kind,
      loom.distribution,
      loom.summary,
      ...loom.tags,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!kind || loom.kind === kind) &&
      terms.every((term) => text.includes(term))
    );
  });
  const position = selected ? matches.indexOf(selected) : -1;
  const move = (offset: number) =>
    setSelected(
      matches[(position + offset + matches.length) % matches.length] ?? null,
    );
  useEffect(() => {
    const sheet = dialog.current;
    if (!selected || !sheet) return;
    if (!sheet.open) sheet.showModal();
  }, [selected]);

  return (
    <main id="main" tabIndex={-1} className="frame catalog">
      <header className="catalog-intro">
        <div className="instrument">
          <span className="live-dot">IntLoom / Capability archive</span>
          <span>Collection 01</span>
        </div>
        <div className="index-heading">
          <div>
            <p className="eyebrow">
              <DecryptedText text="Directory / Loom packages" />
            </p>
            <h1>
              Loom index<em>.</em>
            </h1>
            <p>
              Find a capability, inspect its record, and copy the command to run
              it.
            </p>
          </div>
          <div className="file-count" aria-hidden="true">
            <span>{String(catalog.length).padStart(2, "0")}</span>
            <small>Filed records</small>
          </div>
        </div>
      </header>
      <section className="ledger" aria-label="Loom directory">
        <div className="filters">
          <label className="search-box">
            <Search size={20} aria-hidden="true" />
            <span className="sr-only">Search Looms</span>
            <input
              type="search"
              placeholder="Search by name, tag or capability…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <fieldset className="filter-group">
            <legend className="sr-only">Filter by entry type</legend>
            {["", ...types].map((type) => (
              <button
                type="button"
                key={type}
                aria-pressed={kind === type}
                onClick={() => setKind(type)}
              >
                {type || "All types"}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="ledger-heading">
          <span>Record / Capability</span>
          <span role="status">
            {matches.length} of {catalog.length} records
          </span>
        </div>
        <AnimatedList className="records">
          {matches.map((loom) => (
            <li key={loom.name} id={`loom-${loom.name.split("/").at(-1)}`}>
              <button
                type="button"
                className="record"
                aria-haspopup="dialog"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setSelected(loom);
                }}
              >
                <span className="record-number">{fileNumber(loom)}</span>
                <span className="record-copy">
                  <strong>{loom.title}</strong>
                  <span>{loom.summary}</span>
                </span>
                <span className="record-meta">
                  <span>{loom.kind}</span>
                  <small>{loom.distribution}</small>
                </span>
                <ArrowUpRight size={24} aria-hidden="true" />
              </button>
            </li>
          ))}
        </AnimatedList>
        {!matches.length && (
          <div className="no-results">
            <h2>No matching Looms.</h2>
            <p>Try a different search or entry type.</p>
            <button
              type="button"
              onClick={() => {
                setKind("");
                setSearch("");
              }}
            >
              Clear filters ↺
            </button>
          </div>
        )}
        <div className="ledger-foot">
          <span>IntLoom / Package directory</span>
          <span>End of index</span>
        </div>
      </section>
      <dialog
        className="dossier"
        ref={dialog}
        aria-labelledby="dossier-title"
        onClose={() => {
          setSelected(null);
          opener.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {selected && (
          <article className="dossier-paper">
            <header className="dossier-bar">
              <div className="paper-id">
                <span className="live-dot">IntLoom archive</span>
                <span>File / {fileNumber(selected)}</span>
              </div>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label="Close Loom details"
              >
                <Close size={18} aria-hidden="true" /> Close
              </button>
            </header>
            <div className="paper-body" key={selected.name}>
              <div className="paper-title">
                <small>Capability record</small>
                <h2 id="dossier-title">{selected.title}</h2>
                <p>{selected.summary}</p>
              </div>
              <dl className="spec-table">
                {[
                  ["Package", selected.name],
                  ["Entry", selected.kind],
                  ["Edition", selected.distribution],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="tag-list">
                {selected.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <dl className="execution-grid">
                <div>
                  <dt>
                    <span>01</span> Input
                  </dt>
                  <dd>
                    {selected.inputNote}
                    <code className="sample-input">
                      {JSON.stringify(selected.input)}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>
                    <span>02</span> Output
                  </dt>
                  <dd>{selected.output}</dd>
                </div>
                <div>
                  <dt>
                    <span>03</span> Setup
                  </dt>
                  <dd>
                    {selected.requirements}{" "}
                    {selected.guide ? (
                      <>
                        <code>intloom install {selected.name}</code>
                        {" · "}
                        <a href={selected.guide}>Installation and usage</a>
                      </>
                    ) : (
                      <>
                        From the{" "}
                        <a href="/docs/reference/compatibility">
                          local candidate
                        </a>
                        , install <code>./looms/{selected.name}-*.tgz</code>{" "}
                        before running.
                      </>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="run-command">
              <Command
                caption="Run command"
                command={`intloom run ${selected.name} --input '${JSON.stringify(selected.input).replaceAll("'", "'\\''")}'`}
              />
            </div>
            <div className="pager">
              <button
                type="button"
                aria-label="Previous Loom"
                disabled={matches.length < 2}
                onClick={() => move(-1)}
              >
                <ArrowLeft size={16} /> Previous
              </button>
              <span role="status">
                {position + 1} / {matches.length}
                <small>Use ← → keys</small>
              </span>
              <button
                type="button"
                aria-label="Next Loom"
                disabled={matches.length < 2}
                onClick={() => move(1)}
              >
                Next <ArrowRight size={16} />
              </button>
            </div>
          </article>
        )}
      </dialog>
    </main>
  );
}
