import { useEffect, useState } from "react";
import { Key, Plus, Shield, Calendar, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Modal } from "@/components/ui/modal";
import { Shimmer } from "@/components/ui/shimmer";
import { AnimatedBadge } from "@/components/AnimatedBadge";
import { NativeDelete } from "@/components/NativeDelete";
import { useToast } from "@/components/ui/animated-toast-stack";
import { deleteKey, listKeys, saveKey } from "@/sessions";
import type { KeySummary } from "@/types";

export default function KeyVaultView({
  onKeyAdded,
}: {
  onKeyAdded?: () => void;
}) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [keyData, setKeyData] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshKeys = async () => {
    try {
      const list = await listKeys();
      setKeys(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshKeys();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setKeyData(content || "");
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsText(file);
  };

  const handleSaveKey = async () => {
    if (!name.trim() || !keyData.trim()) {
      setError("Name and private key data are required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const savedKeyName = name.trim();
      await saveKey({
        name: savedKeyName,
        keyData: keyData.trim(),
        passphrase: passphrase.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setName("");
      setKeyData("");
      setPassphrase("");
      setComment("");
      setShowAddModal(false);
      await refreshKeys();
      toast({
        title: "Key Added to Vault",
        description: `Successfully saved ${savedKeyName}`,
        status: "success",
      });
      if (onKeyAdded) onKeyAdded();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const targetKey = keys.find((k) => k.id === id);
    await deleteKey(id);
    await refreshKeys();
    toast({
      title: "Key Removed",
      description: targetKey ? `Deleted ${targetKey.name} from Key Vault` : undefined,
      status: "neutral",
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6 bg-transparent">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">SSH Key Vault</h1>
              <p className="text-xs text-muted-foreground">
                Securely manage reusable private keys (AES-256 encrypted at rest).
              </p>
            </div>
          </div>
        </div>

        <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5 shadow-sm font-medium">
          <Plus className="h-4 w-4" /> Add Private Key
        </Button>
      </div>

      {/* Keys List */}
      {keys.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/30 rounded-xl space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-1">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">No SSH Keys in Vault</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Add your `.pem`, `id_rsa`, or `id_ed25519` private keys once and reuse them effortlessly across any server profile.
          </p>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add First Key
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {keys.map((k) => (
            <Card
              key={k.id}
              className="flex flex-col justify-between p-4 border border-border bg-card/60 hover:bg-card/80 transition-colors shadow-sm rounded-xl"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-muted text-foreground border border-border">
                      <Key className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{k.name}</h4>
                      <AnimatedBadge status="success" size="sm">
                        AES-256 Encrypted
                      </AnimatedBadge>
                    </div>
                  </div>
                  <NativeDelete size="sm" onConfirm={() => {}} onDelete={() => handleDelete(k.id)} />
                </div>

                {k.comment && (
                  <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-md">
                    {k.comment}
                  </p>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {k.createdAt || "Saved"}
                </span>
                <AnimatedBadge status="neutral" size="sm">
                  Key #{k.id}
                </AnimatedBadge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Key Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add SSH Private Key to Vault"
        description="Store encrypted private key for reusable connections"
        icon={<Key className="h-4 w-4" />}
        maxWidth="max-w-lg"
      >
        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Key Name / Identifier</label>
            <Input
              placeholder="e.g. AWS EC2 Prod Key or Hostinger Key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Private Key Content</label>
              <label className="cursor-pointer text-[11px] text-primary hover:underline flex items-center gap-1">
                <FileText className="h-3 w-3" /> Browse File...
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              placeholder="Paste raw private key (-----BEGIN OPENSSH PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----)..."
              value={keyData}
              onChange={(e) => setKeyData(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border border-input bg-background/80 px-3 py-2 font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Passphrase (if encrypted key)</label>
            <PasswordInput
              placeholder="Leave empty if no passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Comment / Notes (Optional)</label>
            <Input
              placeholder="e.g. Used for Ubuntu VPS instances"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
          <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={isSaving || !name || !keyData} onClick={handleSaveKey}>
            {isSaving ? <Shimmer>Encrypting & Saving...</Shimmer> : "Save Key to Vault"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
