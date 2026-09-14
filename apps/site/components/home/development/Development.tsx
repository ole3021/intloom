import common from "../common.module.css";
import { useState, type ComponentType } from "react";
import { developmentStages, type DevelopmentStageId } from "../content";
import styles from "./development.module.css";

function RequirementArtifact() {
  return (
    <>
      <div className={styles.artifactIntent}>
        <span>初始意图</span>
        <p>
          有个简单的地方，
          <br />
          记下要做的事。
        </p>
      </div>
      <dl className={styles.requirements}>
        <div>
          <dt>目标</dt>
          <dd>新增任务，标记完成。</dd>
        </div>
        <div>
          <dt>约束</dt>
          <dd>个人使用，首版无需账户。</dd>
        </div>
        <div>
          <dt>验收要求</dt>
          <dd>重新打开页面，保留任务与完成状态。</dd>
        </div>
      </dl>
      <div className={styles.artifactNote}>
        明确什么要做，也明确什么暂时不做。
      </div>
    </>
  );
}

function DesignArtifact() {
  return (
    <>
      <div className={styles.artifactIntent}>
        <span>从需求到设计</span>
        <p>
          一个简单目标，
          <br />
          清晰的职责与协作。
        </p>
      </div>
      <div className={styles.architecture}>
        <div>
          <strong>任务列表</strong>
          <span>呈现任务与完成状态</span>
        </div>
        <span className={styles.architectureConnector} aria-hidden="true">
          ↓
        </span>
        <div>
          <strong>任务状态</strong>
          <span>新增任务 · 更新状态</span>
        </div>
        <span className={styles.architectureConnector} aria-hidden="true">
          ↓
        </span>
        <div>
          <strong>浏览器存储</strong>
          <span>保存与恢复记录</span>
        </div>
      </div>
      <div className={styles.artifactNote}>
        选择依据：同一个人，在同一浏览器使用。
      </div>
    </>
  );
}

function ImplementationArtifact() {
  return (
    <>
      <div className={styles.codeCaption}>
        <span>保存任务 · 代码片段</span>
        <span>JavaScript</span>
      </div>
      <pre className={styles.code}>
        <code>
          <span className={styles.codeMuted}>
            {"// 连接到“重新打开后保留”的要求"}
          </span>
          {"\n"}
          <span className={styles.codeKeyword}>function</span>
          {" saveTasks(tasks) {\n  localStorage.setItem(\n    "}
          <span className={styles.codeString}>"tasks"</span>
          {",\n    JSON.stringify(tasks),\n  );\n}"}
        </code>
      </pre>
      <div className={styles.verification}>
        <span>对应的检查 · 待执行示例</span>
        <ol>
          <li>新增一条任务</li>
          <li>将任务标记为完成</li>
          <li>重新打开页面，核对记录与状态</li>
        </ol>
      </div>
      <div className={styles.artifactNote}>
        片段用于说明保存步骤，不代表完整实现。
      </div>
    </>
  );
}

const artifacts = {
  requirements: RequirementArtifact,
  design: DesignArtifact,
  implementation: ImplementationArtifact,
} satisfies Record<DevelopmentStageId, ComponentType>;

export function Development() {
  const [stage, setStage] = useState<(typeof developmentStages)[number]>(
    developmentStages[0],
  );
  const active = developmentStages.findIndex((item) => item.id === stage.id);
  return (
    <section
      id="development"
      className={`${common.section} ${styles.root}`}
      aria-labelledby="home-development-title"
    >
      <div className={styles.layout}>
        <div className={styles.copy}>
          <div className={styles.heading}>
            <p className={common.eyebrow}>DEVELOPMENT / 从意图到实现</p>
            <h2 id="home-development-title">
              从一个想法，
              <br />
              <span>到有依据的代码。</span>
            </h2>
            <p>
              沿着同一个任务清单示例，
              <br />
              看看需求、方案与实现如何彼此承接。
            </p>
          </div>
          <fieldset
            className={styles.stageSelector}
            aria-label="选择开发流程阶段"
          >
            {developmentStages.map((item, index) => (
              <button
                key={item.id}
                id={`home-select-${item.id}`}
                type="button"
                aria-pressed={active === index}
                aria-controls="home-stage-description home-artifact-stack"
                onClick={() => setStage(item)}
              >
                <span className={styles.stageNumber}>{item.number}</span>
                <span>{item.label}</span>
                <span className={styles.stageArrow} aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </fieldset>
          <div
            id="home-stage-description"
            className={styles.stageDescription}
            aria-live="polite"
            aria-atomic="true"
          >
            <p className={common.eyebrow}>{stage.english}</p>
            <h3>{stage.title}</h3>
            <p className={styles.descriptionText}>{stage.description}</p>
            <dl>
              <div>
                <dt>承接的输入</dt>
                <dd>{stage.input}</dd>
              </div>
              <div>
                <dt>形成的产出</dt>
                <dd>{stage.outcome}</dd>
              </div>
            </dl>
            <div className={styles.stageReason}>
              <span>选择的依据</span>
              <p>{stage.reason}</p>
            </div>
          </div>
        </div>
        <div className={styles.stackArea}>
          <div className={styles.stackLabel}>
            <span>同一个目标，逐层清晰。</span>
            <span>
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(developmentStages.length).padStart(2, "0")}
            </span>
          </div>
          <div id="home-artifact-stack" className={styles.artifactStack}>
            {developmentStages.map((item, index) => {
              const depth =
                (index - active + developmentStages.length) %
                developmentStages.length;
              const Artifact = artifacts[item.id];
              return (
                <article
                  key={item.id}
                  className={styles.artifact}
                  data-depth={depth}
                  aria-hidden={depth !== 0}
                  aria-label={`${item.label}产物示例`}
                >
                  <div className={styles.artifactHeader}>
                    <span>
                      {item.number} / {item.english}
                    </span>
                    <span>任务清单</span>
                  </div>
                  <div className={styles.artifactBody}>
                    <Artifact />
                  </div>
                </article>
              );
            })}
          </div>
          <p className={styles.exampleCaption}>
            流程示例 · 展示需求、方案与实现的关系，未执行真实任务。
          </p>
        </div>
      </div>
    </section>
  );
}
