import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Check, Folder, Info, Server, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Shimmer } from "@/components/ui/shimmer";
import { AnimatedCombobox, type ComboboxItem } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { SPRING_PANEL } from "@/lib/ease";
import { getFolderColor, getEmptyFolders, addEmptyFolder } from "@/lib/folderMetadata";
import { cn } from "@/lib/utils";
import { listKeys, saveKey, saveProfile, updateProfile, setProfileBgMonitoring, getProfilePassword } from "@/sessions";
import type { KeySummary, ProfileSummary, SaveProfileParams } from "@/types";

export default function ServerFormModal({
  isOpen,
  onClose,
  onServerSaved,
  editingProfile,
  profiles = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onServerSaved: (profileId: number, params: SaveProfileParams) => void;
  editingProfile?: ProfileSummary | null;
  profiles?: ProfileSummary[];
}) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [folder, setFolder] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [bgMonitoring, setBgMonitoring] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Private key state
  const [keySource, setKeySource] = useState<"vault" | "new">("vault");
  const [vaultKeys, setVaultKeys] = useState<KeySummary[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);

  // New inline key state
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyData, setNewKeyData] = useState("");
  const [newKeyPassphrase, setNewKeyPassphrase] = useState("");
  const [saveToVault, setSaveToVault] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listKeys().then((keys) => {
      setVaultKeys(keys);
      if (keys.length > 0 && !selectedKeyId) {
        setSelectedKeyId(keys[0].id);
      } else if (keys.length === 0) {
        setKeySource("new");
      }
    });

    if (editingProfile) {
      setName(editingProfile.name);
      setHost(editingProfile.host);
      setPort(editingProfile.port || 22);
      setUsername(editingProfile.username || "root");
      setFolder(editingProfile.folder || "");
      setAuthMethod(editingProfile.authMethod === "key" ? "key" : "password");
      setPassword("");
      if (editingProfile.authMethod === "password") {
        getProfilePassword(editingProfile.id)
          .then((pwd) => {
            if (pwd) setPassword(pwd);
          })
          .catch(() => {});
      }
      setBgMonitoring(Boolean(editingProfile.bgMonitoring));
      if (editingProfile.keyId) {
        setSelectedKeyId(editingProfile.keyId);
        setKeySource("vault");
      }
    } else {
      setName("");
      setHost("");
      setPort(22);
      setUsername("root");
      setFolder("");
      setPassword("");
      setNewKeyData("");
      setNewKeyName("");
      setNewKeyPassphrase("");
      setBgMonitoring(false);
    }
    setShowInfo(false);
  }, [isOpen, editingProfile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setNewKeyData(content || "");
      if (!newKeyName) {
        setNewKeyName(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim() || !username.trim()) {
      setError("Please fill in Server Name, Host, and User");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalKeyId = selectedKeyId;
      let finalKeyData: string | undefined = undefined;
      let finalPassphrase: string | undefined = undefined;

      if (authMethod === "key") {
        if (keySource === "new") {
          if (!newKeyData.trim()) {
            setError("Please provide private key content");
            setIsSubmitting(false);
            return;
          }

          if (saveToVault) {
            const savedKeyId = await saveKey({
              name: newKeyName.trim() || `${name} Key`,
              keyData: newKeyData.trim(),
              passphrase: newKeyPassphrase.trim() || undefined,
            });
            finalKeyId = savedKeyId;
          } else {
            finalKeyData = newKeyData.trim();
            finalPassphrase = newKeyPassphrase.trim() || undefined;
          }
        }
      }

      const params: SaveProfileParams = {
        name: name.trim(),
        host: host.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        folder: folder.trim() || undefined,
        authMethod,
        password: authMethod === "password" ? (password.trim() ? password : undefined) : undefined,
        keyId: authMethod === "key" && keySource === "vault" ? finalKeyId || undefined : finalKeyId || undefined,
        keyData: finalKeyData,
        passphrase: finalPassphrase,
      };

      if (editingProfile) {
        await updateProfile(editingProfile.id, params);
        if (Boolean(editingProfile.bgMonitoring) !== bgMonitoring) {
          await setProfileBgMonitoring(editingProfile.id, bgMonitoring);
        }
        onServerSaved(editingProfile.id, params);
      } else {
        const profileId = await saveProfile(params);
        if (bgMonitoring) {
          await setProfileBgMonitoring(profileId, true);
        }
        onServerSaved(profileId, params);
      }
      onClose();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const active24x7Count = (profiles || []).filter(
    (p) => p.bgMonitoring && (!editingProfile || p.id !== editingProfile.id)
  ).length;
  const is24x7LimitReached = active24x7Count >= 5;

  const existingFolders = Array.from(
    new Set([
      ...(profiles || []).map((p) => p.folder).filter(Boolean),
      ...getEmptyFolders(),
    ])
  ) as string[];

  const folderComboboxItems: ComboboxItem[] = existingFolders.map((f) => ({
    value: f,
    label: f,
    color: getFolderColor(f),
    icon: <Folder className="h-3.5 w-3.5" />,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProfile ? "Edit Server Connection" : "Add New Server"}
      description="Configure SSH host credentials"
      icon={<Server className="h-4 w-4" />}
      maxWidth="max-w-lg"
    >
      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Server Display Name</label>
            <Input
              placeholder="e.g. Zoopify Hostinger VPS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 text-xs"
              required
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Host / IP Address</label>
            <Input
              placeholder="147.93.20.139"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="mt-1 text-xs"
              required
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Port</label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="mt-1 text-xs"
              required
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">User</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 text-xs"
              required
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Folder (Optional)</label>
            <div className="mt-1">
              <AnimatedCombobox
                value={folder}
                onChange={(val) => {
                  setFolder(val);
                  if (val.trim() && !existingFolders.includes(val.trim())) {
                    addEmptyFolder(val.trim());
                  }
                }}
                items={folderComboboxItems}
                placeholder="Select or create folder..."
                searchPlaceholder="Search or type new folder..."
                allowCreate
                createPrefix="Create new folder"
                clearLabel="No Folder (Root)"
                clearValue=""
                icon={<Folder className="h-3.5 w-3.5" />}
              />
            </div>
          </div>
        </div>

        {/* Authentication Switcher */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Authentication Method</label>
            <div className="flex items-center rounded-lg bg-secondary/80 p-0.5 border border-border/60">
              <button
                type="button"
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  authMethod === "password"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setAuthMethod("password")}
              >
                Password
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  authMethod === "key"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setAuthMethod("key")}
              >
                SSH Key
              </button>
            </div>
          </div>

          {authMethod === "password" ? (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                {editingProfile && (
                  <span className="text-[10px] text-muted-foreground/70">
                    Saved in vault • Edit or leave as is
                  </span>
                )}
              </div>
              <PasswordInput
                placeholder={editingProfile ? "•••••••• (Leave blank to keep saved password)" : "Enter SSH password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 text-xs"
                required={!editingProfile}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {vaultKeys.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      keySource === "vault"
                        ? "bg-primary/10 border-primary text-primary font-medium"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setKeySource("vault")}
                  >
                    Select from Key Vault ({vaultKeys.length})
                  </button>
                  <button
                    type="button"
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      keySource === "new"
                        ? "bg-primary/10 border-primary text-primary font-medium"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setKeySource("new")}
                  >
                    + Add New Key
                  </button>
                </div>
              )}

              {keySource === "vault" && vaultKeys.length > 0 ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Select Private Key</label>
                  <Select
                    value={selectedKeyId ? String(selectedKeyId) : undefined}
                    onValueChange={(val) => setSelectedKeyId(Number(val))}
                  >
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="Choose a key from Vault" />
                    </SelectTrigger>
                    <SelectContent>
                      {vaultKeys.map((k) => (
                        <SelectItem key={k.id} value={String(k.id)}>
                          {k.name} ({k.comment || "SSH Key"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-border/80 bg-background/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">New Private Key</span>
                    <label className="cursor-pointer text-xs text-primary hover:underline flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      Upload File
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground">Key Name</label>
                    <Input
                      placeholder="e.g. AWS Production RSA Key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="mt-0.5 text-xs h-7"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground">Private Key Data</label>
                    <textarea
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                      value={newKeyData}
                      onChange={(e) => setNewKeyData(e.target.value)}
                      className="mt-0.5 w-full rounded-md border border-input bg-transparent px-2 py-1.5 font-mono text-[11px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[90px]"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Comment (Optional)</label>
                      <Input
                        placeholder="e.g. Production Ed25519"
                        className="mt-0.5 text-xs h-7"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Passphrase (if any)</label>
                      <PasswordInput
                        placeholder="Optional passphrase"
                        value={newKeyPassphrase}
                        onChange={(e) => setNewKeyPassphrase(e.target.value)}
                        className="mt-0.5 text-xs h-7"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <Checkbox
                      checked={saveToVault}
                      onCheckedChange={setSaveToVault}
                      label="Save this key to Key Vault for reuse"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Monitoring Mode Section */}
        <div className="space-y-2.5 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <label className="text-xs font-medium text-foreground">Monitoring Mode</label>
              <button
                type="button"
                onClick={() => setShowInfo((prev) => !prev)}
                aria-label="Explain monitoring options"
                className={cn(
                  "h-4 w-4 rounded-full flex items-center justify-center transition-all cursor-pointer",
                  showInfo
                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                )}
                title="Click to learn about Smart Monitoring vs 24/7 Monitoring"
              >
                <Info className="h-3 w-3" />
              </button>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {bgMonitoring ? "24/7 Active" : "Smart (Default)"}
            </span>
          </div>

          {/* Animated Info Explanation Panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING_PANEL}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-white/[0.08] bg-secondary/50 p-3 text-xs space-y-2.5 backdrop-blur-md shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-md bg-sky-500/15 p-1 text-sky-400 shrink-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        Smart Monitoring
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300">Default & Recommended</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Polls metrics on demand when you view this server or the dashboard. Cached data displays instantly (0ms). Automatically pauses background SSH polling when switching away to preserve battery, CPU, and remote network bandwidth.
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-white/[0.06]" />

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-md bg-emerald-500/15 p-1 text-emerald-400 shrink-0">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        24/7 Continuous Monitoring
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">Max 5 Servers</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Continuously polls CPU, RAM, disk, and network stats every 3.5s in the background, even when you are working on other tabs, profiles, or windows. Termizen caps this at 5 servers to prevent overloading system and network resources.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Option Cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* Smart Monitoring */}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setBgMonitoring(false);
              }}
              className={cn(
                "flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative",
                !bgMonitoring
                  ? "border-primary/60 bg-primary/10 shadow-xs ring-1 ring-primary/40 text-foreground"
                  : "border-border/60 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                  Smart Monitoring
                </div>
                {!bgMonitoring && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </div>
              <span className="text-[10px] text-muted-foreground leading-snug">
                Instant 0ms cache • On-demand • Battery friendly
              </span>
            </button>

            {/* 24/7 Monitoring */}
            <button
              type="button"
              onClick={() => {
                if (is24x7LimitReached && !bgMonitoring) {
                  setError("A maximum of 5 servers can have 24/7 background monitoring enabled. Switch another server to Smart Monitoring first.");
                  return;
                }
                setError(null);
                setBgMonitoring(true);
              }}
              disabled={is24x7LimitReached && !bgMonitoring}
              className={cn(
                "flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative",
                bgMonitoring
                  ? "border-emerald-500/60 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/40 text-foreground"
                  : is24x7LimitReached
                  ? "opacity-50 border-border/40 bg-card/30 cursor-not-allowed text-muted-foreground"
                  : "border-border/60 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                  <Activity className={cn("h-3.5 w-3.5", bgMonitoring ? "text-emerald-400 animate-pulse" : "text-muted-foreground")} />
                  24/7 Continuous
                </div>
                {bgMonitoring && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </div>
              <span className="text-[10px] text-muted-foreground leading-snug">
                {is24x7LimitReached && !bgMonitoring
                  ? "Cap reached (5/5 active)"
                  : "Live polling in background • Max 5 servers"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <Shimmer>Saving Server...</Shimmer>
            ) : editingProfile ? (
              "Update Server"
            ) : (
              "Save & Add Server"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
