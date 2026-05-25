"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useRef, useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import { apiUrl } from "../../api-url";
import { AdminMediaItem, cleanAltText, formatMediaSize, validateMediaUpload } from "./media-model";

export function MediaManager() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<AdminMediaItem[] | null>(null);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isUploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch(apiUrl("/admin/media"), { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("media unavailable");
        }
        return response.json() as Promise<AdminMediaItem[]>;
      })
      .then((items) => {
        if (!ignore) {
          setMedia(items);
          setAltDrafts(Object.fromEntries(items.map((item) => [item.id, item.altText])));
        }
      })
      .catch(() => {
        if (!ignore) {
          setMedia([]);
          setError("Media could not be loaded.");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) {
      return;
    }
    const file = fileRef.current?.files?.[0] ?? null;
    const altText = cleanAltText(new FormData(form).get("altText"));
    const validationError = validateMediaUpload(file, altText);
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setError("");
    setMessage("");
    setUploading(true);

    const payload = new FormData();
    payload.set("file", file as File);
    payload.set("altText", altText);

    const response = await fetch(apiUrl("/admin/media"), {
      method: "POST",
      credentials: "include",
      body: payload
    });

    setUploading(false);
    if (!response.ok) {
      setError("Image could not be uploaded.");
      return;
    }

    const item = (await response.json()) as AdminMediaItem;
    setMedia((items) => [item, ...(items ?? [])]);
    setAltDrafts((drafts) => ({ ...drafts, [item.id]: item.altText }));
    form?.reset();
    setMessage("Image uploaded.");
  }

  async function saveAltText(item: AdminMediaItem) {
    const altText = cleanAltText(altDrafts[item.id] ?? item.altText);
    if (!altText) {
      setError("Alt text is required for uploaded images.");
      setMessage("");
      return;
    }

    setBusyId(item.id);
    setError("");
    setMessage("");
    const response = await fetch(apiUrl(`/admin/media/${item.id}`), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altText })
    });
    setBusyId("");

    if (!response.ok) {
      setError("Alt text could not be saved.");
      return;
    }
    const updated = (await response.json()) as AdminMediaItem;
    setMedia((items) => (items ?? []).map((nextItem) => (nextItem.id === updated.id ? updated : nextItem)));
    setAltDrafts((drafts) => ({ ...drafts, [updated.id]: updated.altText }));
    setMessage("Alt text updated.");
  }

  async function deleteMedia(item: AdminMediaItem) {
    setBusyId(item.id);
    setError("");
    setMessage("");
    const response = await fetch(apiUrl(`/admin/media/${item.id}`), {
      method: "DELETE",
      credentials: "include"
    });
    setBusyId("");

    if (!response.ok) {
      setError("Image could not be deleted.");
      return;
    }
    setMedia((items) => (items ?? []).filter((nextItem) => nextItem.id !== item.id));
    setAltDrafts((drafts) => {
      const next = { ...drafts };
      delete next[item.id];
      return next;
    });
    setMessage("Image deleted.");
  }

  return (
    <div className="grid gap-6">
      <form ref={formRef} className="grid gap-4 rounded-xl border border-white/10 bg-slate-950 p-4" onSubmit={upload}>
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm text-slate-300">
            Image file
            <input ref={fileRef} name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-sky-300 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-950" />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Alt text
            <input name="altText" className="h-11 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50" />
          </label>
          <button type="submit" disabled={isUploading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-sky-300 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-60">
            <Upload size={17} aria-hidden="true" />
            Upload image
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}

      {media === null ? <p className="text-sm text-slate-400">Loading media...</p> : null}
      {media?.length === 0 ? <p className="rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-400">No media uploaded yet.</p> : null}

      {media && media.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {media.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-xl border border-white/10 bg-slate-950 p-4 sm:grid-cols-[136px_1fr]">
              <div className="aspect-[4/3] overflow-hidden rounded-md border border-white/10 bg-slate-900">
                <img src={apiUrl(`/media/${item.id}`)} alt={item.altText} className="h-full w-full object-cover" />
              </div>
              <div className="grid gap-3">
                <div>
                  <h2 className="font-medium text-white">{item.filename}</h2>
                  <p className="mt-1 text-xs text-slate-500">{item.mimeType} / {formatMediaSize(item.sizeBytes)}</p>
                </div>
                <label className="grid gap-2 text-sm text-slate-300">
                  Alt text for {item.filename}
                  <input
                    value={altDrafts[item.id] ?? item.altText}
                    onChange={(event) => setAltDrafts((drafts) => ({ ...drafts, [item.id]: event.target.value }))}
                    className="h-10 rounded-md border border-white/10 bg-slate-950 px-3 text-slate-100 outline-none focus:border-sky-300/50"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === item.id} onClick={() => void saveAltText(item)} aria-label={`Save alt text for ${item.filename}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-300/30 px-3 text-sm text-emerald-100 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-60">
                    <Save size={16} aria-hidden="true" />
                    Save
                  </button>
                  <button type="button" disabled={busyId === item.id} onClick={() => void deleteMedia(item)} aria-label={`Delete ${item.filename}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-red-300/30 px-3 text-sm text-red-100 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-60">
                    <Trash2 size={16} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
