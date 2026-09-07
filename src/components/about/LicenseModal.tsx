import { useState } from "react";
import { FileText, Check, Copy, Heart } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIT_LICENSE_TEXT = `MIT License

Copyright (c) 2026 Muhammed Shuaib (@shuaib-07)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ACKNOWLEDGEMENTS = [
  {
    name: "Tauri & Rust Ecosystem",
    description: "tauri, portable-pty, russh, rusqlite, tokio, aes-gcm, window-vibrancy",
    license: "MIT / Apache-2.0",
  },
  {
    name: "React & Modern Web Stack",
    description: "React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Radix UI",
    license: "MIT",
  },
  {
    name: "Terminal & Icons",
    description: "xterm.js (@xterm/xterm, @xterm/addon-fit) and Lucide Icons",
    license: "MIT / ISC",
  },
  {
    name: "Flutter ServerBox",
    description: "Inspiration and architectural reference from lollipopkit/flutter_server_box",
    license: "GPL-3.0",
  },
];

export function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MIT_LICENSE_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Licenses & Open Source Credits"
      description="Legal licenses and acknowledgements for open source software used in Termizen."
      icon={<FileText className="h-4 w-4" />}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Termizen MIT License Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Termizen Software License (MIT)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-6 text-[11px] gap-1 px-2 border-white/[0.08] hover:bg-white/[0.04] cursor-pointer"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy License"}</span>
            </Button>
          </div>
          <pre className="text-[11px] font-mono text-muted-foreground bg-black/40 p-3 rounded-xl border border-white/[0.06] overflow-y-auto max-h-48 whitespace-pre-wrap leading-relaxed">
            {MIT_LICENSE_TEXT}
          </pre>
        </div>

        {/* Acknowledgements Section */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            <span>Open Source Acknowledgements</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ACKNOWLEDGEMENTS.map((ack, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/[0.05] bg-card/50 p-2.5 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-[11px]">{ack.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-white/[0.04]">
                    {ack.license}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  {ack.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border/40 pt-3">
          <Button size="sm" onClick={onClose} className="text-xs cursor-pointer">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default LicenseModal;
