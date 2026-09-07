import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ClipboardPaste, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "@xterm/xterm/css/xterm.css";
import {
  ConnectionDiagnosticCard,
  ConnectionErrorBanner,
  type ServerInfoMeta,
} from "@/components/servers/ConnectionDiagnosticCard";

export interface TerminalSession {
  spawn: (cols: number, rows: number) => Promise<number>;
  write: (id: number, data: string) => Promise<void>;
  resize: (id: number, cols: number, rows: number) => Promise<void>;
  kill: (id: number) => Promise<void>;
  outputEvent: string;
  exitEvent: string;
}

export interface TerminalHandle {
  // PTY-mode macro runner: types each command into this live session with an
  // injected exit-code marker, same transport the user's own typing uses.
  // See plan.md §3.2 -- fragile if the shell isn't at a plain prompt when a
  // step fires (mid-vim/su/docker exec); the timeout below turns a stalled
  // marker into a halted macro instead of hanging forever.
  runMacro: (
    steps: string[],
    haltOnError: boolean,
    onStep?: (index: number, exitCode: number | null) => void
  ) => Promise<void>;
}

const MARKER_TIMEOUT_MS = 600000; // 10 minutes max per step

export type TerminalStatus = "connecting" | "connected" | "error";

export interface TerminalProps {
  session: TerminalSession;
  onExit?: () => void;
  onStatusChange?: (status: TerminalStatus) => void;
  initialCommands?: string[];
  serverInfo?: ServerInfoMeta;
  onEditServer?: () => void;
  onCloseTab?: () => void;
}

const Terminal = forwardRef<
  TerminalHandle,
  TerminalProps
>(({ session, onExit, onStatusChange, initialCommands, serverInfo, onEditServer, onCloseTab }, ref) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerm | null>(null);
    const sessionIdRef = useRef<number | null>(null);
    const macroBufferRef = useRef("");
    const pendingMarkerRef = useRef<((code: number | null) => void) | null>(null);
    const resetActivityTimerRef = useRef<(() => void) | null>(null);

    // Floating selection toolbar state
    const [selectionMenu, setSelectionMenu] = useState<{
      text: string;
      x: number;
      y: number;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    // Connection Failure & Diagnostics State
    const [connectError, setConnectError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [showDiagnosticsOverlay, setShowDiagnosticsOverlay] = useState(true);
    const [retryTrigger, setRetryTrigger] = useState(0);

    const handleRetry = () => {
      setConnectError(null);
      setIsRetrying(true);
      setShowDiagnosticsOverlay(true);
      setRetryTrigger((c) => c + 1);
    };

    useImperativeHandle(
      ref,
      () => ({
        async runMacro(steps, haltOnError, onStep) {
          for (let i = 0; i < steps.length; i++) {
            const id = sessionIdRef.current;
            if (id === null) throw new Error("session not connected");

            const exitCode = await new Promise<number | null>((resolve) => {
              let overallTimer: any = null;
              let inactivityTimer: any = null;

              const cleanup = () => {
                clearTimeout(overallTimer);
                clearTimeout(inactivityTimer);
                resetActivityTimerRef.current = null;
                pendingMarkerRef.current = null;
                macroBufferRef.current = "";
              };

              const handleTimeout = () => {
                cleanup();
                resolve(null);
              };

              const resetInactivity = () => {
                clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(handleTimeout, 180000); // 3 minutes of zero output
              };

              overallTimer = setTimeout(handleTimeout, MARKER_TIMEOUT_MS);
              resetInactivity();
              resetActivityTimerRef.current = resetInactivity;

              pendingMarkerRef.current = (code) => {
                cleanup();
                resolve(code);
              };
              void session.write(id, `${steps[i]}; echo TERMINA_EXIT:$?\r`);
            });

            onStep?.(i, exitCode);
            if (haltOnError && exitCode !== 0) {
              termRef.current?.writeln(
                `\r\n\x1b[33m[Termizen] Macro halted at step ${i + 1} ("${steps[i]}"): ${
                  exitCode === null ? "timed out after inactivity" : `exit code ${exitCode}`
                }\x1b[0m\r\n`
              );
              break;
            }
          }
        },
      }),
      [session]
    );

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        theme: { background: "#1c1e24" }, // matches design.md's --card token
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      // Keyboard handler: Enable Ctrl+V pasting & Ctrl+C copy with selection
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.type !== "keydown") return true;

        // Ctrl+V or Ctrl+Shift+V: Paste from clipboard
        if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
          e.preventDefault();
          void navigator.clipboard.readText().then((text) => {
            if (text && sessionIdRef.current !== null) {
              void session.write(sessionIdRef.current, text);
            }
          }).catch(() => {});
          return false;
        }

        // Ctrl+C: Copy if there is an active selection; else allow SIGINT to pass
        if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
          if (term.hasSelection()) {
            const sel = term.getSelection();
            if (sel) {
              void navigator.clipboard.writeText(sel);
            }
            return false;
          }
          return true;
        }

        // Shift+Insert: Paste
        if (e.shiftKey && e.key === "Insert") {
          e.preventDefault();
          void navigator.clipboard.readText().then((text) => {
            if (text && sessionIdRef.current !== null) {
              void session.write(sessionIdRef.current, text);
            }
          }).catch(() => {});
          return false;
        }

        // Ctrl+Insert: Copy
        if (e.ctrlKey && e.key === "Insert") {
          if (term.hasSelection()) {
            const sel = term.getSelection();
            if (sel) void navigator.clipboard.writeText(sel);
            return false;
          }
        }

        return true;
      });

      term.onSelectionChange(() => {
        if (!term.hasSelection()) {
          setSelectionMenu(null);
          setCopied(false);
        }
      });

      termRef.current = term;
      let disposed = false;
      const unlistenFns: (() => void)[] = [];

      onStatusChange?.("connecting");

      (async () => {
        let id: number;
        try {
          id = await session.spawn(term.cols, term.rows);
        } catch (err) {
          const errMsg = String((err as any)?.message || err);
          term.writeln(`\r\n\x1b[31;1m✖ Failed to connect: ${errMsg}\x1b[0m\r\n`);
          onStatusChange?.("error");
          setConnectError(errMsg);
          setIsRetrying(false);
          setShowDiagnosticsOverlay(true);
          return;
        }
        if (disposed) {
          await session.kill(id);
          return;
        }
        sessionIdRef.current = id;
        setConnectError(null);
        setIsRetrying(false);
        onStatusChange?.("connected");

        // Automatically run initial commands once the shell produces its initial prompt output (or via fallback)
        let initialTriggered = false;
        const triggerInitial = async () => {
          if (initialTriggered || disposed || sessionIdRef.current === null) return;
          initialTriggered = true;
          if (initialCommands && initialCommands.length > 0) {
            // Brief pause so shell prompt finishes rendering
            await new Promise((r) => setTimeout(r, 180));
            if (disposed || sessionIdRef.current === null) return;
            for (let i = 0; i < initialCommands.length; i++) {
              if (disposed || sessionIdRef.current === null) break;
              await session.write(sessionIdRef.current, `${initialCommands[i]}\r`);
              if (i < initialCommands.length - 1) {
                await new Promise((r) => setTimeout(r, 120));
              }
            }
          }
        };

        const fallbackTimer = setTimeout(() => {
          void triggerInitial();
        }, 700);

        unlistenFns.push(() => clearTimeout(fallbackTimer));

        unlistenFns.push(
          await listen<{ id: number; data: string }>(session.outputEvent, (event) => {
            if (event.payload.id !== sessionIdRef.current) return;
            term.write(event.payload.data);

            if (!initialTriggered) {
              clearTimeout(fallbackTimer);
              void triggerInitial();
            }

            if (pendingMarkerRef.current) {
              resetActivityTimerRef.current?.();
              macroBufferRef.current += event.payload.data;
              if (macroBufferRef.current.length > 4096) {
                macroBufferRef.current = macroBufferRef.current.slice(-2048);
              }
              const match = macroBufferRef.current.match(/TERMINA_EXIT:(\d+)/);
              if (match) {
                const resolve = pendingMarkerRef.current;
                pendingMarkerRef.current = null;
                macroBufferRef.current = "";
                resolve(Number(match[1]));
              }
            }
          })
        );
        unlistenFns.push(
          await listen<{ id: number }>(session.exitEvent, (event) => {
            if (event.payload.id === sessionIdRef.current) onExit?.();
          })
        );

        term.onData((data) => {
          setSelectionMenu(null);
          if (sessionIdRef.current !== null) void session.write(sessionIdRef.current, data);
        });
      })();

      // ResizeObserver (not a window resize listener) so this also refits when a
      // hidden tab (display:none -> block) becomes visible again, not just on
      // actual window resizes.
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && containerRef.current.offsetWidth === 0) return;
        fitAddon.fit();
        if (sessionIdRef.current !== null) void session.resize(sessionIdRef.current, term.cols, term.rows);
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        disposed = true;
        termRef.current = null;
        resizeObserver.disconnect();
        unlistenFns.forEach((fn) => fn());
        if (sessionIdRef.current !== null) void session.kill(sessionIdRef.current);
        sessionIdRef.current = null;
        term.dispose();
      };
    }, [session, retryTrigger]);

    const handleMouseUp = (e: React.MouseEvent) => {
      if (!termRef.current || !outerRef.current) return;
      setTimeout(() => {
        if (!termRef.current || !outerRef.current) return;
        if (termRef.current.hasSelection()) {
          const sel = termRef.current.getSelection();
          if (sel && sel.trim().length > 0) {
            const rect = outerRef.current.getBoundingClientRect();
            const x = Math.max(90, Math.min(rect.width - 90, e.clientX - rect.left));
            const y = Math.max(42, e.clientY - rect.top - 12);
            setSelectionMenu({ text: sel, x, y });
            setCopied(false);
            return;
          }
        }
        setSelectionMenu(null);
      }, 25);
    };

    const handleContextMenu = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!termRef.current || !outerRef.current) return;

      if (termRef.current.hasSelection()) {
        const sel = termRef.current.getSelection();
        if (sel && sel.trim().length > 0) {
          const rect = outerRef.current.getBoundingClientRect();
          const x = Math.max(90, Math.min(rect.width - 90, e.clientX - rect.left));
          const y = Math.max(42, e.clientY - rect.top - 12);
          setSelectionMenu({ text: sel, x, y });
          setCopied(false);
          return;
        }
      }

      // If no text selected, right-click pastes from clipboard
      try {
        const text = await navigator.clipboard.readText();
        if (text && sessionIdRef.current !== null) {
          await session.write(sessionIdRef.current, text);
        }
      } catch (err) {
        console.error("Right-click paste failed:", err);
      }
    };

    const handleCopy = async () => {
      if (!selectionMenu) return;
      try {
        await navigator.clipboard.writeText(selectionMenu.text);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          termRef.current?.clearSelection();
          setSelectionMenu(null);
        }, 800);
      } catch (err) {
        console.error("Clipboard copy error:", err);
      }
    };

    const handlePaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && sessionIdRef.current !== null) {
          await session.write(sessionIdRef.current, text);
        }
      } catch (err) {
        console.error("Clipboard paste error:", err);
      } finally {
        termRef.current?.clearSelection();
        setSelectionMenu(null);
      }
    };

    return (
      <div ref={outerRef} className="relative h-full w-full p-1 overflow-hidden select-none">
        <div
          ref={containerRef}
          className="h-full w-full"
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
        />

        {/* Connection Error Banner (shown when user minimizes the diagnostic card) */}
        {connectError && !showDiagnosticsOverlay && (
          <ConnectionErrorBanner
            error={connectError}
            serverName={serverInfo?.name || serverInfo?.host}
            isRetrying={isRetrying}
            onShowDiagnostics={() => setShowDiagnosticsOverlay(true)}
            onRetry={handleRetry}
            onCloseTab={onCloseTab || onExit}
          />
        )}

        {/* Full Connection Failure & Diagnostics Card */}
        {connectError && showDiagnosticsOverlay && (
          <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-md">
            <ConnectionDiagnosticCard
              error={connectError}
              serverInfo={serverInfo}
              isRetrying={isRetrying}
              onRetry={handleRetry}
              onEditServer={onEditServer}
              onViewTerminal={() => setShowDiagnosticsOverlay(false)}
              onCloseTab={onCloseTab || onExit}
            />
          </div>
        )}

        {/* Floating Selection Tooltip (Mica Styled) */}
        <AnimatePresence>
          {selectionMenu && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className="absolute z-50 flex items-center gap-1 rounded-xl bg-card/85 backdrop-blur-xl border border-border/80 p-1 shadow-2xl text-xs font-sans text-foreground select-none"
              style={{
                left: `${selectionMenu.x}px`,
                top: `${selectionMenu.y}px`,
                transform: "translate(-50%, -100%)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Copy Button */}
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all font-medium text-xs cursor-pointer",
                  copied
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "hover:bg-muted/70 text-foreground active:scale-95"
                )}
                title="Copy selection (Ctrl+C)"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>

              <div className="w-[1px] h-3.5 bg-border/60 mx-0.5" />

              {/* Paste Button */}
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted/70 text-foreground transition-all font-medium text-xs active:scale-95 cursor-pointer"
                title="Paste from clipboard (Ctrl+V)"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
                <span>Paste</span>
              </button>

              <div className="w-[1px] h-3.5 bg-border/60 mx-0.5" />

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => {
                  termRef.current?.clearSelection();
                  setSelectionMenu(null);
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                title="Deselect"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

export default Terminal;
