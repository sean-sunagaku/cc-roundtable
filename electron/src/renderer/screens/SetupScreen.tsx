import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AgentProfile, AgentProfileInput, MeetingConfig, SkillOption } from "@shared/types";

interface Props {
  skills: SkillOption[];
  agents: AgentProfile[];
  defaultProjectDir: string;
  onStart: (config: MeetingConfig) => Promise<void>;
  onSaveAgent: (input: AgentProfileInput) => Promise<AgentProfile>;
  onReloadAgents: () => Promise<void>;
}

function pickDefaultSkill(skills: SkillOption[]): string {
  const names = skills.map((item) => item.name);
  if (names.includes("agent-team")) return "agent-team";
  if (names.includes("feature-discussion")) return "feature-discussion";
  return skills[0]?.name ?? "feature-discussion";
}

export function SetupScreen({
  skills,
  agents,
  defaultProjectDir,
  onStart,
  onSaveAgent,
  onReloadAgents
}: Props): JSX.Element {
  const [selectedSkill, setSelectedSkill] = useState(() => pickDefaultSkill(skills));
  const [skillTouched, setSkillTouched] = useState(false);
  const [topic, setTopic] = useState("タスク優先順位の再設計");
  const [projectDir, setProjectDir] = useState(defaultProjectDir);
  const [projectDirTouched, setProjectDirTouched] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [refreshingAgents, setRefreshingAgents] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [newAgentDefault, setNewAgentDefault] = useState(true);
  const [agentError, setAgentError] = useState("");

  useEffect(() => {
    if (skillTouched) return;
    setSelectedSkill(pickDefaultSkill(skills));
  }, [skills, skillTouched]);

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

  const selectedSkillOption = useMemo(
    () => skills.find((candidate) => candidate.name === selectedSkill),
    [selectedSkill, skills]
  );

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
        skill: selectedSkill,
        topic,
        projectDir,
        members: selectedMembers
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
      setNewAgentDefault(true);
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

  return (
    <div className="setup-wrap">
      <h1>Meeting Room</h1>
      <p className="subtle">Agent Teams 会議室をセットアップします。</p>

      <form className="setup-card" onSubmit={submit}>
        <div className="setup-section">
          <label>
            会議エンジン
            <select
              value={selectedSkill}
              onChange={(event) => {
                setSkillTouched(true);
                setSelectedSkill(event.target.value);
              }}
              required
            >
              {skills.map((skill) => (
                <option key={skill.name} value={skill.name}>
                  {skill.name}
                </option>
              ))}
            </select>
            {selectedSkillOption ? <small>source: {selectedSkillOption.source}</small> : null}
          </label>
        </div>

        <div className="setup-section">
          <label>
            議題（ここを中心に議論）
            <input value={topic} onChange={(event) => setTopic(event.target.value)} required />
          </label>

          <label>
            プロジェクト
            <input
              value={projectDir}
              onChange={(event) => {
                setProjectDirTouched(true);
                setProjectDir(event.target.value);
              }}
              required
            />
          </label>
        </div>

        <div className="setup-section">
          <div className="setup-inline">
            <strong>参加Agent（ファイルベース）</strong>
            <button type="button" onClick={() => void reloadAgents()} disabled={refreshingAgents}>
              {refreshingAgents ? "再読み込み中..." : "ファイル再読み込み"}
            </button>
          </div>
          {agents.length === 0 ? (
            <p className="subtle">Agent定義がありません。下のフォームから追加してください。</p>
          ) : (
            <ul className="agent-list">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <label className="agent-option">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(agent.id)}
                      onChange={() => toggleMember(agent.id)}
                    />
                    <span>
                      <strong>{agent.id}</strong> ({agent.name})
                    </span>
                  </label>
                  <small>{agent.description}</small>
                </li>
              ))}
            </ul>
          )}
          {selectedMembers.length === 0 ? (
            <p className="subtle">未選択でも開始できます（通常対話モード）。</p>
          ) : null}
        </div>

        <fieldset className="setup-section">
          <legend>Agentを追加（`.claude/meeting-room/agents/*.json` へ保存）</legend>
          <label>
            Agent名
            <input value={newAgentName} onChange={(event) => setNewAgentName(event.target.value)} placeholder="researcher" />
          </label>
          <label>
            Agent ID（任意、英数字とハイフン推奨）
            <input value={newAgentId} onChange={(event) => setNewAgentId(event.target.value)} placeholder="researcher" />
          </label>
          <label>
            役割説明
            <textarea
              value={newAgentDescription}
              onChange={(event) => setNewAgentDescription(event.target.value)}
              placeholder="ユーザー調査と仮説検証を担当する"
              rows={3}
            />
          </label>
          <label className="setup-checkbox">
            <input
              type="checkbox"
              checked={newAgentDefault}
              onChange={(event) => setNewAgentDefault(event.target.checked)}
            />
            デフォルトで選択状態にする
          </label>
          {agentError ? <p className="error-text">{agentError}</p> : null}
          <button type="button" onClick={() => void submitAgent()} disabled={savingAgent}>
            {savingAgent ? "保存中..." : "Agentを保存"}
          </button>
        </fieldset>

        <button disabled={submitting} type="submit">
          {submitting ? "開始中..." : "会議を開始"}
        </button>
      </form>
    </div>
  );
}
