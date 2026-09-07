import { useState } from "react";
import type { SaveProfileParams, SshConnectParams } from "./sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export default function ConnectForm({
  onConnect,
  onSaveAndConnect,
}: {
  onConnect: (params: SshConnectParams) => void;
  onSaveAndConnect: (params: SaveProfileParams) => void;
}) {
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const buildParams = (): SshConnectParams => ({
    host,
    port,
    username,
    authMethod,
    password: authMethod === "password" ? password : undefined,
    keyPath: authMethod === "key" ? keyPath : undefined,
    passphrase: authMethod === "key" ? passphrase : undefined,
  });

  return (
    <Card className="mx-auto flex w-80 flex-col gap-2.5 p-5">
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          onConnect(buildParams());
        }}
      >
        <h2 className="text-base font-semibold">Connect via SSH</h2>
        <Input placeholder="Host" value={host} onChange={(e) => setHost(e.currentTarget.value)} required />
        <Input type="number" placeholder="Port" value={port} onChange={(e) => setPort(Number(e.currentTarget.value))} required />
        <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} required />
        <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as "password" | "key")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="password">Password</SelectItem>
            <SelectItem value="key">Private key</SelectItem>
          </SelectContent>
        </Select>
        {authMethod === "password" ? (
          <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required />
        ) : (
          <>
            <Input placeholder="Path to private key" value={keyPath} onChange={(e) => setKeyPath(e.currentTarget.value)} required />
            <PasswordInput placeholder="Key passphrase (optional)" value={passphrase} onChange={(e) => setPassphrase(e.currentTarget.value)} />
          </>
        )}
        <Button type="submit">Connect</Button>

        <hr className="border-border" />
        <Input placeholder="Save as (name)" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Input placeholder="Folder (optional)" value={folder} onChange={(e) => setFolder(e.currentTarget.value)} />
        <Button type="button" variant="secondary" disabled={!name} onClick={() => onSaveAndConnect({ ...buildParams(), name, folder: folder || undefined })}>
          Save & Connect
        </Button>
      </form>
    </Card>
  );
}
