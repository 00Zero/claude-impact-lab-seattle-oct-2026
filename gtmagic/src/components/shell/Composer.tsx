"use client";
/* The chat box: text, pasted links, and attached files (CSV, XLSX, TXT, PDF, images; 10 MB each). */
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "../figures";

export const ACCEPT = ".csv,.xlsx,.txt,.pdf,.png,.jpg,.jpeg,.webp";

type Props = { disabled: boolean; placeholder: string; allowFiles?: boolean; onSubmit: (text: string, files: File[]) => Promise<boolean | void> | boolean | void };

export function Composer({ disabled, placeholder, allowFiles = true, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (disabled || busy || (!text.trim() && files.length === 0)) return;
    setBusy(true);
    try {
      // Keep what the owner typed unless the send succeeded.
      if ((await onSubmit(text.trim(), files)) !== false) {
        setText("");
        setFiles([]);
      }
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form className="composer" onSubmit={submit} autoComplete="off">
      <label htmlFor="composer-input" className="sr-only">Message GTMagic</label>
      <textarea id="composer-input" rows={1} maxLength={10000} value={text} disabled={disabled || busy}
        placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
      <button className="send" type="submit" aria-label="Send" disabled={disabled || busy}><Icon name="i-send" /></button>
      {allowFiles && !disabled ? (
        <div className="composer-files">
          <button type="button" className="chip" onClick={() => fileInput.current?.click()}>Attach a file</button>
          <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          {files.map((f) => <span key={f.name} className="file"><Icon name="i-copy" />{f.name}</span>)}
        </div>
      ) : null}
      {!disabled ? <p className="composer-note">Don&apos;t paste personal or confidential information.</p> : null}
    </form>
  );
}
