"use client";

import { useCallback, useEffect, useState } from "react";
import type { Brand, ResponseTemplate } from "@/types/api";
import { apiFetch } from "@/lib/api-client";

export default function TemplatesPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ResponseTemplate[] | null>(null);
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
    apiFetch<ResponseTemplate[]>(`/response-templates?brandId=${brandId}`)
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, [brandId]);

  useEffect(() => {
    setTemplates(null);
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Response templates</h1>
          <p className="mt-1 text-sm text-muted">
            The reply wordings auto-reply rules choose from. Use <code>{"${Reviewer first name}"}</code> where the
            reviewer&apos;s first name should appear.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={!brandId}
          className="shrink-0 rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Create template
        </button>
      </div>

      <BrandTabs brands={brands} brandId={brandId} onSelect={setBrandId} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {creating && brandId && (
        <TemplateEditor
          brandId={brandId}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {templates === null && <p className="text-sm text-muted">Loading…</p>}
      {templates?.length === 0 && <p className="text-sm text-muted">No templates for this brand yet.</p>}

      <div className="space-y-3">
        {templates?.map((t) => (
          <TemplateRow key={t.id} template={t} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function BrandTabs({
  brands,
  brandId,
  onSelect,
}: {
  brands: Brand[] | null;
  brandId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-line">
      {brands?.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            b.id === brandId ? "border-brand-pink text-brand-pink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}

function TemplateRow({ template, onChanged }: { template: ResponseTemplate; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleEnabled() {
    setBusy(true);
    try {
      await apiFetch(`/response-templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !template.enabled }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    setBusy(true);
    try {
      await apiFetch(`/response-templates/${template.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <TemplateEditor
        brandId={template.brandId}
        template={template}
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
          <h2 className="font-medium text-ink">{template.name}</h2>
          {!template.enabled && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">disabled</span>
          )}
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <button onClick={toggleEnabled} disabled={busy} className="text-muted hover:underline">
            {template.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => setEditing(true)} className="text-brand-pink hover:underline">
            Edit
          </button>
          <button onClick={remove} disabled={busy} className="text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{template.body}</p>
    </div>
  );
}

function TemplateEditor({
  brandId,
  template,
  onCancel,
  onSaved,
}: {
  brandId: string;
  template?: ResponseTemplate;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (template) {
        await apiFetch(`/response-templates/${template.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, body }),
        });
      } else {
        await apiFetch(`/response-templates`, {
          method: "POST",
          body: JSON.stringify({ brandId, name, body }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-brand-pink/40 bg-white p-4">
      <label className="mb-1 block text-xs font-medium text-muted">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. 5 Stars With Comment - Reply A"
        className="mb-3 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
      />
      <label className="mb-1 block text-xs font-medium text-muted">Reply text</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Hi ${Reviewer first name}, thank you for..."
        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-brand-pink focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={busy || !name.trim() || !body.trim()}
          className="rounded-md bg-brand-pink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
