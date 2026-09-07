import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { stopMacroExec } from "./sessions";
import { Button } from "@/components/ui/button";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { cn } from "@/lib/utils";

interface StepState {
  index: number;
  command: string;
  status: "running" | "done";
  exitCode?: number;
}

export default function MacroRunView({ runId, macroName }: { runId: number; macroName: string }) {
  const [log, setLog] = useState("");
  const [steps, setSteps] = useState<StepState[]>([]);
  const [finished, setFinished] = useState<{ success: boolean; error?: string } | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const unlistenFns: (() => void)[] = [];
    (async () => {
      unlistenFns.push(
        await listen<{ run_id: number; index: number; command: string }>("macro-step", (e) => {
          if (e.payload.run_id !== runId) return;
          setSteps((prev) => [...prev, { index: e.payload.index, command: e.payload.command, status: "running" }]);
        })
      );
      unlistenFns.push(
        await listen<{ run_id: number; data: string }>("macro-output", (e) => {
          if (e.payload.run_id !== runId) return;
          setLog((prev) => prev + e.payload.data);
        })
      );
      unlistenFns.push(
        await listen<{ run_id: number; index: number; exit_status: number }>("macro-step-done", (e) => {
          if (e.payload.run_id !== runId) return;
          setSteps((prev) =>
            prev.map((s) => (s.index === e.payload.index ? { ...s, status: "done", exitCode: e.payload.exit_status } : s))
          );
        })
      );
      unlistenFns.push(
        await listen<{ run_id: number; success: boolean; error?: string }>("macro-exit", (e) => {
          if (e.payload.run_id !== runId) return;
          setFinished({ success: e.payload.success, error: e.payload.error });
        })
      );
    })();
    return () => unlistenFns.forEach((fn) => fn());
  }, [runId]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [log]);

  const runStatus = !finished ? "loading" : finished.success ? "success" : "danger";
  const runLabel = !finished ? "Running" : finished.success ? "Done" : `Failed${finished.error ? ": " + finished.error : ""}`;

  return (
    <div className="flex h-full min-w-0 min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
        <strong className="text-sm">{macroName}</strong>
        <AnimatedBadge status={runStatus} size="sm">
          {runLabel}
        </AnimatedBadge>
        {!finished && (
          <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={() => stopMacroExec(runId)}>
            Stop
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-border p-2">
          {steps.map((s) => (
            <div key={s.index} className="flex items-center gap-1.5 py-0.5">
              <AnimatedBadge status={s.status === "running" ? "loading" : s.exitCode === 0 ? "success" : "danger"} size="sm" showIcon>
                {s.status === "done" ? s.exitCode : undefined}
              </AnimatedBadge>
              <span className={cn("truncate text-xs", s.status === "done" && s.exitCode !== 0 ? "text-destructive" : "text-muted-foreground")}>{s.command}</span>
            </div>
          ))}
        </div>
        <pre ref={logRef} className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs">
          {log}
        </pre>
      </div>
    </div>
  );
}
