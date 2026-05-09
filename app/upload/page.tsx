"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileJson, CheckCircle2, XCircle, AlertCircle, ArrowRight, Music, Loader2 } from "lucide-react";
import { classifyFiles, parseSpotifyData } from "@/lib/spotify-parser";
import { saveSpotifyData } from "@/lib/store";
import { UploadedFile } from "@/types/spotify";
import Navbar from "@/components/layout/Navbar";
import { toast } from "sonner";

interface DropFile {
  name: string;
  size: number;
  status: "pending" | "parsed" | "error";
  type: UploadedFile["type"];
  data?: unknown;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<DropFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (rawFiles: File[]) => {
    const jsonFiles = rawFiles.filter((f) => f.name.endsWith(".json"));
    if (!jsonFiles.length) {
      toast.error("Please upload JSON files from your Spotify data export.");
      return;
    }

    const parsed: DropFile[] = [];
    for (const file of jsonFiles) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const classified = classifyFiles([{ name: file.name, data }]);
        parsed.push({
          name: file.name,
          size: file.size,
          status: "parsed",
          type: classified[0].type,
          data,
        });
      } catch {
        parsed.push({
          name: file.name,
          size: file.size,
          status: "error",
          type: "unknown",
          error: "Invalid JSON file",
        });
      }
    }

    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const newFiles = parsed.filter((f) => !existing.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleAnalyze = async () => {
    const validFiles = files.filter((f) => f.status === "parsed");
    if (!validFiles.length) {
      toast.error("Add at least one valid Spotify JSON file first.");
      return;
    }

    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 600)); // brief UX pause

      const uploadedFiles: UploadedFile[] = validFiles.map((f) => ({
        name: f.name,
        type: f.type,
        data: f.data,
        size: f.size,
      }));

      const spotifyData = parseSpotifyData(uploadedFiles);

      if (spotifyData.songs.length === 0 && spotifyData.likedSongs.length === 0) {
        toast.error("No music data found. Make sure to include StreamingHistory or YourLibrary files.");
        setProcessing(false);
        return;
      }

      saveSpotifyData(spotifyData);
      toast.success(`Analyzed ${spotifyData.songs.length.toLocaleString()} songs across ${spotifyData.artists.length} artists.`);
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong while analyzing your data.");
      setProcessing(false);
    }
  };

  const streamingCount = files.filter((f) => f.type === "streaming_history" && f.status === "parsed").length;
  const libraryCount = files.filter((f) => f.type === "library" && f.status === "parsed").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />

      <main className="pt-24 pb-20 px-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-up">
          <h1
            className="text-6xl mb-3"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            Upload Your{" "}
            <span className="gradient-text">Spotify Data</span>
          </h1>
          <p style={{ color: "var(--text-dim)" }}>
            Drop your Spotify data export files here. Everything is processed locally in your browser.
          </p>
        </div>

        {/* How to get your data */}
        <div
          className="rounded-2xl p-5 mb-6 animate-fade-up delay-100"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={16} style={{ color: "var(--cyan)", marginTop: 2, flexShrink: 0 }} />
            <div>
              <div className="text-sm font-semibold mb-1">How to get your Spotify data</div>
              <ol className="text-sm leading-relaxed space-y-1" style={{ color: "var(--text-dim)" }}>
                <li>1. Go to <strong style={{ color: "var(--foreground)" }}>spotify.com/account/privacy</strong></li>
                <li>2. Scroll down to &ldquo;Download your data&rdquo; and request <strong style={{ color: "var(--foreground)" }}>Extended Streaming History</strong></li>
                <li>3. Spotify will email you a download link within 1–5 days</li>
                <li>4. Unzip the file and upload the <strong style={{ color: "var(--foreground)" }}>StreamingHistory_music_*.json</strong> and/or <strong style={{ color: "var(--foreground)" }}>YourLibrary.json</strong> files here</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`upload-zone p-12 flex flex-col items-center gap-4 mb-6 animate-fade-up delay-200 ${dragging ? "upload-zone-drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            className="hidden"
            onChange={onFileInput}
          />
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: dragging ? "rgba(29,185,84,0.15)" : "var(--bg-2)",
              border: `1px solid ${dragging ? "var(--green)" : "var(--border)"}`,
              transition: "all 0.2s",
            }}
          >
            <Upload size={24} style={{ color: dragging ? "var(--green)" : "var(--text-muted)" }} />
          </div>
          <div className="text-center">
            <div className="font-semibold mb-1">
              {dragging ? "Drop files here" : "Click or drag & drop JSON files"}
            </div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              StreamingHistory_music_*.json, YourLibrary.json
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 mb-6 animate-fade-in">
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: "var(--bg-1)",
                  border: `1px solid ${file.status === "error" ? "#ff444430" : "var(--border)"}`,
                }}
              >
                <FileJson
                  size={18}
                  style={{
                    color: file.status === "error" ? "#ff4444"
                      : file.type === "streaming_history" ? "var(--green)"
                      : file.type === "library" ? "var(--cyan)"
                      : "var(--text-muted)",
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {file.status === "error"
                      ? file.error
                      : file.type === "streaming_history"
                      ? "Streaming History"
                      : file.type === "library"
                      ? "Your Library"
                      : "Unknown file type"}
                    {" · "}{(file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
                {file.status === "parsed" ? (
                  <CheckCircle2 size={16} style={{ color: "var(--green)", flexShrink: 0 }} />
                ) : (
                  <XCircle size={16} style={{ color: "#ff4444", flexShrink: 0 }} />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: "var(--text-muted)", background: "var(--bg-3)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Summary + CTA */}
        {files.filter((f) => f.status === "parsed").length > 0 && (
          <div className="animate-fade-in">
            <div
              className="rounded-2xl p-5 mb-4 flex flex-wrap gap-4"
              style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Music size={14} style={{ color: "var(--green)" }} />
                <span className="text-sm">
                  <strong>{streamingCount}</strong> streaming history file{streamingCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileJson size={14} style={{ color: "var(--cyan)" }} />
                <span className="text-sm">
                  <strong>{libraryCount}</strong> library file{libraryCount !== 1 ? "s" : ""}
                </span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle size={14} style={{ color: "#ff4444" }} />
                  <span className="text-sm" style={{ color: "#ff4444" }}>
                    {errorCount} file{errorCount !== 1 ? "s" : ""} failed
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleAnalyze}
              disabled={processing}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all"
              style={{
                background: "var(--green)",
                color: "#000",
                opacity: processing ? 0.8 : 1,
                boxShadow: processing ? "none" : "0 0 30px var(--green-glow)",
              }}
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing your music...
                </>
              ) : (
                <>
                  Analyze My Music
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
