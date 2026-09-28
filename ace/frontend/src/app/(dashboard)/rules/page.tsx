"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutoReplyRule, Brand, CommentCondition, ResponseTemplate } from "@/types/api";
import { apiFetch } from "@/lib/api-client";

const COMMENT_LABEL: Record<CommentCondition, string> = {
  PRESENT: "with comment",
  ABSENT: "without comment",
  ANY: "any",
};

export default function RulesPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [rules, setRules] = useState<AutoReplyRule[] | null>(null);
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch<Brand[]>("/brands")
      .then((b) => {
        setBrands(b);
        setBrandId((cur) => cur ?? b[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    if (!brandId) return;
    Promise.all([
      apiFetch<AutoReplyRule[]>(`/auto-reply-rules?brandId=${brandId}`),
      apiFetch<ResponseTemplate[]>(`/response-templates?brandId=${brandId}`),
    ])
      .then(([r, t]) => {
        setRules(r);
        setTemplates(t);
      })
      .catch((e) => setError(e.message));
  }, [brandId]);

  useEffect(() => {
    setRules(null);
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Auto-reply rules</h1>
          <p className="mt-1 text-sm text-muted">
            For each rating and comment condition, pick which templates to reply with and how long to wait. Higher
            rank wins when more than one rule matches. Reviews with no matching rule are held for a person.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={!brandId}
          className="shrink-0 rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Add rule
        </button>
      </div>

      <div className="flex gap-2 border-b border-line">
        {brands?.map((b) => (
          <button
            key={b.id}
            onClick={() => setBrandId(b.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              b.id === brandId ? "border-brand-pink text-brand-pink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {creating && brandId && (
        <RuleEditor
          brandId={brandId}
          templates={templates}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {rules === null && <p className="text-sm text-muted">Loading…</p>}
      {rules?.length === 0 && <p className="text-sm text-muted">No rules for this brand yet.</p>}

      <div className="space-y-3">
        {rules?.map((r) => (
          <RuleRow key={r.id} rule={r} templates={templates} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  templates,
  onChanged,
}: {
  rule: AutoReplyRule;
  templates: ResponseTemplate[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const templateNames = rule.templateIds
    .map((id) => templates.find((t) => t.id === id)?.name ?? "(missing)")
    .join(", ");

  async function toggleEnabled() {
    setBusy(true);
    try {
      await apiFetch(`/auto-reply-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/auto-reply-rules/${rule.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <RuleEditor
        brandId={rule.brandId}
        rule={rule}
        templates={templates}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-ink">{rule.name}</h2>
          {!rule.enabled && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">disabled</span>
          )}
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <button onClick={toggleEnabled} disabled={busy} className="text-muted hover:underline">
            {rule.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => setEditing(true)} className="text-brand-pink hover:underline">
            Edit
          </button>
          <button onClick={remove} disabled={busy} className="text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {rule.ratings.map((r) => `${r}★`).join(", ")} · {COMMENT_LABEL[rule.comment]} · reply after {rule.delayHours}h
        · rank {rule.rank}
      </p>
      <p className="mt-2 text-sm text-gray-700">
        <span className="text-muted">Replies with: </span>
        {templateNames || "(none)"}
      </p>
    </div>
  );
}

function RuleEditor({
  brandId,
  rule,
  templates,
  onCancel,
  onSaved,
}: {
  brandId: string;
  rule?: AutoReplyRule;
  templates: ResponseTemplate[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [ratings, setRatings] = useState<number[]>(rule?.ratings ?? []);
  const [comment, setComment] = useState<CommentCondition>(rule?.comment ?? "ANY");
  const [delayHours, setDelayHours] = useState(rule?.delayHours ?? 24);
  const [rank, setRank] = useState(rule?.rank ?? 0);
  const [templateIds, setTemplateIds] = useState<string[]>(rule?.templateIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = { name, ratings, comment, delayHours, rank, templateIds };
      if (rule) {
        await apiFetch(`/auto-reply-rules/${rule.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/auto-reply-rules`, { method: "POST", body: JSON.stringify({ brandId, ...payload }) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-brand-pink/40 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Rule name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Reply to 5 Stars With Comment"
          className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Ratings</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRatings((r) => toggle(r, n))}
                className={`h-8 w-8 rounded-md border text-sm ${
                  ratings.includes(n)
                    ? "border-brand-pink bg-brand-pink text-white"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Comment</label>
          <select
            value={comment}
            onChange={(e) => setComment(e.target.value as CommentCondition)}
            className="rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
          >
            <option value="ABSENT">Without comment</option>
            <option value="PRESENT">With comment</option>
            <option value="ANY">Any</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Delay (hours)</label>
          <input
            type="number"
            min={0}
            value={delayHours}
            onChange={(e) => setDelayHours(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Rank</label>
          <input
            type="number"
            value={rank}
            onChange={(e) => setRank(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Reply with (picks one at random) — {templateIds.length} selected
        </label>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
          {templates.length === 0 && <p className="text-sm text-muted">No templates for this brand.</p>}
          {templates.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={templateIds.includes(t.id)}
                onChange={() => setTemplateIds((ids) => toggle(ids, t.id))}
              />
              {t.name}
              {!t.enabled && <span className="text-[11px] text-gray-400">(disabled)</span>}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !name.trim() || ratings.length === 0 || templateIds.length === 0}
          className="rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save rule"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
