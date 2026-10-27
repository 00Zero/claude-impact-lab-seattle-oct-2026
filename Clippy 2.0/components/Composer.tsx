"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import MicButton from "./MicButton";
import ScreenButton from "./ScreenButton";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const SAMPLE_LIST = "2 cases 12 oz paper hot cups, 1000 ct, I pay $119 per case\n1 bag bread flour, 50 lb, I pay $72\n1 case dinner napkins, 3000 ct, I pay $54";

export interface InputValues {
  file: File | null;
  list: string;
  ordersPerMonth: number;
  location: string;
}

// The last location typed is remembered in this browser so owners only enter it once.
const LOCATION_KEY = "clippy-location";
const noSubscribe = () => () => {};
function savedLocation(): string {
  try {
    return localStorage.getItem(LOCATION_KEY) ?? "";
  } catch {
    return "";
  }
}

// Upload card: drop an invoice photo or type a list, set orders per month, compare.
export default function Composer({ busy, onSend }: { busy: boolean; onSend: (v: InputValues) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [list, setList] = useState("");
  const [orders, setOrders] = useState("4");
  const remembered = useSyncExternalStore(noSubscribe, savedLocation, () => "");
  const [typedLocation, setLocation] = useState<string | null>(null);
  const location = typedLocation ?? remembered;
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function choose(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
    setFile(f);
  }

  function pick(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) {
      choose(null);
      setFileError("Please use a JPEG, PNG or WebP photo.");
    } else if (f.size > MAX_BYTES) {
      choose(null);
      setFileError("That photo is larger than 5 MB. Please use a smaller one.");
    } else {
      choose(f);
      setFileError(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const ordersNum = Number(orders);
  const ordersOk = Number.isInteger(ordersNum) && ordersNum >= 1 && ordersNum <= 30;
  const canSend = !busy && (file !== null || list.trim().length > 0) && ordersOk;

  function send() {
    if (!canSend) return;
    const place = location.trim();
    try {
      localStorage.setItem(LOCATION_KEY, place);
    } catch {
      // Remembering the location is a convenience only.
    }
    onSend({ file, list: list.trim(), ordersPerMonth: ordersNum, location: place });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        {file && preview ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Invoice preview" className="h-32 w-32 rounded-xl object-cover ring-1 ring-slate-200" />
              <button
                type="button"
                aria-label="Remove"
                onClick={() => choose(null)}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-800">{file.name}</p>
              <p className="text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB · ready to compare</p>
            </div>
          </div>
        ) : (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 9a4 4 0 01-1 7.87" strokeLinecap="round" />
                <path d="M12 12v8M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-3 font-semibold text-slate-900">
              Drag and drop your supply invoice here, or{" "}
              <label className="cursor-pointer text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
                browse files
                <input
                  ref={inputRef}
                  data-testid="upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => pick(e.target.files?.[0])}
                />
              </label>
            </p>
            <p className="mt-1 text-sm text-slate-500">Take a phone photo or a screenshot of your invoice or receipt.</p>
            <div className="mt-3">
              <ScreenButton disabled={busy} onFile={pick} />
            </div>
            <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
              JPEG, PNG or WebP · up to 5 MB
            </p>
          </>
        )}
      </div>

      {fileError && (
        <p data-testid="error" role="alert" className="mt-2 text-sm text-rose-600">
          {fileError}
        </p>
      )}

      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or type or say your shopping list
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="list" className="text-sm font-medium text-slate-800">
          Shopping list
        </label>
        <div className="flex flex-wrap items-start justify-end gap-3">
          <button
            type="button"
            onClick={() => setList(SAMPLE_LIST)}
            className="pt-1 text-xs font-medium text-emerald-700 hover:underline"
          >
            No invoice handy? Try a sample list
          </button>
          <MicButton disabled={busy} onText={(text) => setList((l) => (l.trim() ? l.trimEnd() + "\n" : "") + text)} />
        </div>
      </div>
      <textarea
        id="list"
        data-testid="list-input"
        aria-label="Type what you buy"
        rows={4}
        maxLength={5000}
        value={list}
        onChange={(e) => setList(e.target.value)}
        placeholder={"One item per line, with quantities and what you pay, or tap the mic and say your order. For example:\n2 cases 12 oz paper hot cups, 1000 ct, $119 per case\n1 bag bread flour, 50 lb, $72"}
        className="block w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-800">
          Your location <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <span className="relative mt-1.5 block">
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M10 18s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" />
            <circle cx="10" cy="8" r="2.2" />
          </svg>
          <input
            data-testid="location-input"
            type="text"
            autoComplete="postal-code"
            maxLength={80}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City and state, or ZIP code, e.g. Austin, TX"
            className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </span>
        <span className="mt-1 block text-xs text-slate-500">Clippy looks for stores that sell or deliver near you.</span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            data-testid="orders-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={orders}
            onChange={(e) => setOrders(e.target.value)}
            aria-label="Orders per month"
            className={`w-14 rounded-lg border px-2 py-1.5 text-center font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
              ordersOk ? "border-slate-300 text-slate-900" : "border-rose-400 text-rose-600"
            }`}
          />
          orders per month
        </label>
        <span className="hidden text-xs text-slate-500 sm:inline">Usually takes under a minute</span>
        <button
          type="submit"
          data-testid="submit-btn"
          disabled={!canSend}
          className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Compare prices
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
            <path d="M4 10h11M11 5.5L15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!ordersOk && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          Orders per month must be a whole number from 1 to 30.
        </p>
      )}
    </form>
  );
}
