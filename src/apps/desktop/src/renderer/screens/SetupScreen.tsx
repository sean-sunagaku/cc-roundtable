import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AgentProfile, AgentProfileInput, MeetingConfig } from "@shared/types";
import { ObservatoryBackground } from "../components/ObservatoryBackground";

interface Props {
  agents: AgentProfile[];
  defaultProjectDir: string;
  agentsLoading?: boolean;
  agentLoadError?: string;
  projectDirLoadError?: string;
  onStart: (config: MeetingConfig) => Promise<void>;
  onSaveAgent: (input: AgentProfileInput) => Promise<AgentProfile>;
  onReloadAgents: () => Promise<void>;
  onPickProjectDir: (currentDir?: string) => Promise<string | null>;
}

export function SetupScreen({
  agents,
  defaultProjectDir,
  agentsLoading,
  agentLoadError,
  projectDirLoadError,
  onStart,
  onSaveAgent,
  onReloadAgents,
  onPickProjectDir
}: Props): JSX.Element {
  const [topic, setTopic] = useState("タスク優先順位の再設計");
  const [projectDir, setProjectDir] = useState(defaultProjectDir);
  const [projectDirTouched, setProjectDirTouched] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [bypassMode, setBypassMode] = useState(true);
  const [showFlowModeSettings, setShowFlowModeSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [refreshingAgents, setRefreshingAgents] = useState(false);
  const [showAddAgentForm, setShowAddAgentForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [newAgentDefault, setNewAgentDefault] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [projectDirPickerError, setProjectDirPickerError] = useState("");
  const [pickingProjectDir, setPickingProjectDir] = useState(false);

  useEffect(() => {
    if (projectDirTouched) return;
    if (!defaultProjectDir) return;
    setProjectDir(defaultProjectDir);
  }, [defaultProjectDir, projectDirTouched]);

  const defaultMemberIds = useMemo(() => {
    const enabled = agents.filter((agent) => agent.enabledByDefault).map((agent) => agent.id);
    if (enabled.length > 0) return enabled;
    return agents.slice(0, 4).map((agent) => agent.id);
  }, [agents]);

  useEffect(() => {
    const validIds = new Set(agents.map((agent) => agent.id));
    setSelectedMembers((prev) => {
      const kept = prev.filter((id) => validIds.has(id));
      if (kept.length > 0) return kept;
      return defaultMemberIds;
    });
  }, [agents, defaultMemberIds]);

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onStart({
        id: `meeting_${Date.now()}`,
        topic,
        projectDir,
        members: selectedMembers,
        bypassMode
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitAgent = async () => {
    setAgentError("");
    if (!newAgentName.trim()) {
      setAgentError("Agent名は必須です");
      return;
    }
    if (!newAgentDescription.trim()) {
      setAgentError("役割説明は必須です");
      return;
    }

    setSavingAgent(true);
    try {
      const saved = await onSaveAgent({
        id: newAgentId.trim() || undefined,
        name: newAgentName,
        description: newAgentDescription,
        enabledByDefault: newAgentDefault
      });
      setSelectedMembers((prev) => (prev.includes(saved.id) ? prev : [...prev, saved.id]));
      setNewAgentName("");
      setNewAgentDescription("");
      setNewAgentId("");
      setNewAgentDefault(false);
      setShowAddAgentForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent保存に失敗しました";
      setAgentError(message);
    } finally {
      setSavingAgent(false);
    }
  };

  const reloadAgents = async () => {
    setRefreshingAgents(true);
    try {
      await onReloadAgents();
    } finally {
      setRefreshingAgents(false);
    }
  };

  const pickProjectDir = async () => {
    setProjectDirPickerError("");
    setPickingProjectDir(true);
    try {
      const nextProjectDir = await onPickProjectDir(projectDir || defaultProjectDir);
      if (!nextProjectDir) {
        return;
      }
      setProjectDirTouched(true);
      setProjectDir(nextProjectDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ディレクトリ選択に失敗しました";
      setProjectDirPickerError(message);
    } finally {
      setPickingProjectDir(false);
    }
  };

  return (
    <>
      <ObservatoryBackground />
      <div className="setup-wrap">
        <h1>Meeting Room</h1>
        <p className="subtle">議題からそのまま会議を立ち上げ、必要な Agent を選んで始めます。</p>

        <form className="setup-card" onSubmit={submit}>
          <section className="setup-section">
            <div className="setup-field-grid">
              <label>
                議題（ここを中心に議論）
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="例: タスク優先順位の再設計"
                  required
                />
              </label>

              <label>
                プロジェクト
                <div className="setup-project-row">
                  <input
                    value={projectDir}
                    onChange={(event) => {
                      setProjectDirTouched(true);
                      setProjectDir(event.target.value);
                    }}
                    required
                  />
                  <button type="button" onClick={() => void pickProjectDir()} disabled={pickingProjectDir}>
                    {pickingProjectDir ? "選択中..." : "ディレクトリ選択"}
                  </button>
                </div>
              </label>
            </div>
            {projectDirLoadError ? (
              <p className="error-text">
                既定の project directory を読み込めませんでした。必要なら手入力し、`再読み込み` も試してください。
              </p>
            ) : null}
            {projectDirPickerError ? <p className="error-text">{projectDirPickerError}</p> : null}
          </section>

          <section className="setup-section">
            <div className="setup-inline">
              <div>
                <strong>進行モード</strong>
                <p className="setup-helper">デフォルトは Bypass Mode です。承認付きで進めたい場合だけ設定を開いて切り替えます。</p>
              </div>
              <div className="setup-toggle-actions">
                <span className={`mode-pill${bypassMode ? " bypass" : ""}`}>
                  {bypassMode ? "Bypass Mode ON" : "Approval Step Mode"}
                </span>
                <button
                  type="button"
                  className="setup-toggle-button"
                  aria-expanded={showFlowModeSettings}
                  onClick={() => setShowFlowModeSettings((prev) => !prev)}
                >
                  進行モード設定
                </button>
              </div>
            </div>

            {showFlowModeSettings ? (
              <div className="setup-collapsible-body">
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    aria-label="Bypass Mode"
                    checked={bypassMode}
                    onChange={(event) => setBypassMode(event.target.checked)}
                  />
                  <span>
                    Bypass Mode を有効にする
                    <small>ON にすると approval hook で止めず、AI がそのまま継続します。</small>
                  </span>
                </label>
              </div>
            ) : null}
          </section>

          <section className="setup-section">
            <div className="setup-inline">
              <div>
                <strong>参加 Agent</strong>
                <p className="setup-helper">サンプル Sub Agent を選択し、必要なら新規追加できます。</p>
                {agentLoadError ? (
                  <p className="error-text">Agent 定義の読み込みに失敗しました。daemon との接続先を確認して `再読み込み` を試してください。</p>
                ) : null}
              </div>
              <div className="setup-actions">
                <button type="button" onClick={() => void reloadAgents()} disabled={refreshingAgents}>
                  {refreshingAgents ? "読み込み中..." : "再読み込み"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAgentError("");
                    setShowAddAgentForm((prev) => !prev);
                  }}
                >
                  {showAddAgentForm ? "追加フォームを閉じる" : "Agent 追加"}
                </button>
              </div>
            </div>

            {agentsLoading && agents.length === 0 ? (
              <p className="subtle">Agent 定義を読み込んでいます...</p>
            ) : agents.length === 0 ? (
              <p className="subtle">Agent 定義がありません。追加フォームから作成してください。</p>
            ) : (
              <div className="agent-grid">
                {agents.map((agent) => {
                  const selected = selectedMembers.includes(agent.id);
                  return (
                    <label key={agent.id} className={`agent-card${selected ? " selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMember(agent.id)}
                      />
                      <div className="agent-card-header">
                        <div>
                          <strong>{agent.id}</strong>
                          <span className="agent-card-name">{agent.name}</span>
                        </div>
                        {agent.enabledByDefault ? <span className="agent-card-badge">既定</span> : null}
                      </div>
                      <p className="agent-card-description">{agent.description}</p>
                      <span className="agent-card-state">{selected ? "選択中" : "クリックで追加"}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedMembers.length === 0 ? (
              <p className="subtle">未選択でも開始可能です。必要な役割は会議内で再編できます。</p>
            ) : null}

            {showAddAgentForm ? (
              <div className="agent-builder">
                <div className="agent-builder-grid">
                  <label>
                    Agent名
                    <input
                      value={newAgentName}
                      onChange={(event) => setNewAgentName(event.target.value)}
                      placeholder="researcher"
                    />
                  </label>

                  <label>
                    Agent ID（任意）
                    <input
                      value={newAgentId}
                      onChange={(event) => setNewAgentId(event.target.value)}
                      placeholder="researcher"
                    />
                  </label>

                  <label className="agent-builder-description">
                    役割説明
                    <textarea
                      value={newAgentDescription}
                      onChange={(event) => setNewAgentDescription(event.target.value)}
                      placeholder="ユーザー調査と仮説検証を担当する"
                      rows={3}
                    />
                  </label>
                </div>

                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={newAgentDefault}
                    onChange={(event) => setNewAgentDefault(event.target.checked)}
                  />
                  デフォルトで選択
                </label>

                {agentError ? <p className="error-text">{agentError}</p> : null}

                <div className="setup-actions">
                  <button type="button" onClick={() => void submitAgent()} disabled={savingAgent}>
                    {savingAgent ? "保存中..." : "Agent を保存"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <button disabled={submitting} type="submit">
            {submitting ? "開始中..." : "会議を開始"}
          </button>
        </form>
      </div>
    </>
  );
}
