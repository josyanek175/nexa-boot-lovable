import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  listInstances,
  createNewInstance,
  removeInstance,
  getInstanceState,
  connectToInstance,
  disconnectInstance,
  restartEvolutionInstance,
} from "@/lib/evolution-api.functions";
import {
  Circle,
  Phone,
  Plus,
  QrCode,
  PlugZap,
  Unplug,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/numbers")({
  component: NumbersPage,
  head: () => ({
    meta: [
      { title: "Números WhatsApp — NexaBoot" },
      { name: "description", content: "Gerencie seus números de WhatsApp via Evolution API" },
    ],
  }),
});

interface InstanceInfo {
  instanceName: string;
  instanceId?: string;
  status: string;
  number?: string;
  profileName?: string;
  profilePictureUrl?: string;
  connectionState?: "open" | "close" | "connecting";
}

// ── Create Instance Modal ──
function CreateInstanceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe um nome para a instância");
      return;
    }

    setLoading(true);
    try {
      const result = await createNewInstance({
        data: {
          instanceName: name.trim().toLowerCase().replace(/\s+/g, "-"),
          number: number.trim() || undefined,
        },
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.qrcode?.base64) {
        setQrBase64(result.qrcode.base64);
        setPairingCode(result.qrcode.pairingCode || null);
        toast.success("Instância criada! Escaneie o QR Code.");
      } else {
        toast.success("Instância criada com sucesso!");
        onCreated();
        handleClose();
      }
    } catch (err) {
      toast.error("Erro ao criar instância");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setNumber("");
    setQrBase64(null);
    setPairingCode(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {qrBase64 ? "Conectar WhatsApp" : "Nova Instância"}
          </h2>
          <button onClick={handleClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {qrBase64 ? (
          <div className="text-center">
            <img src={qrBase64} alt="QR Code" className="mx-auto h-64 w-64 rounded-lg" />
            {pairingCode && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Código de pareamento:</p>
                <p className="mt-1 font-mono text-lg font-bold text-foreground tracking-widest">
                  {pairingCode}
                </p>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Abra o WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho
            </p>
            <button
              onClick={() => { onCreated(); handleClose(); }}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Já escaneei o QR Code
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Nome da instância</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: suporte, vendas, financeiro"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Apenas letras minúsculas, números e hífens
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Número (opcional)
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="5511999000001"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar instância
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── QR Code Modal ──
function QrCodeModal({
  open,
  onClose,
  instanceName,
}: {
  open: boolean;
  onClose: () => void;
  instanceName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    connectToInstance({ data: { instanceName } })
      .then((res) => {
        if (res.error) {
          setError(res.error);
        } else if (res.qrcode?.base64) {
          setQrBase64(res.qrcode.base64);
          setPairingCode(res.qrcode.pairingCode || null);
        } else {
          setError("Nenhum QR Code retornado. A instância pode já estar conectada.");
        }
      })
      .catch(() => setError("Erro ao obter QR Code"))
      .finally(() => setLoading(false));
  }, [open, instanceName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">QR Code — {instanceName}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Gerando QR Code...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </div>
        ) : qrBase64 ? (
          <>
            <img src={qrBase64} alt="QR Code" className="mx-auto h-56 w-56 rounded-lg" />
            {pairingCode && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Código:</p>
                <p className="font-mono text-lg font-bold text-foreground tracking-widest">{pairingCode}</p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Escaneie com o WhatsApp para conectar
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Delete Confirmation ──
function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  instanceName,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  instanceName: string;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">Excluir instância</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tem certeza que deseja excluir <strong className="text-foreground">{instanceName}</strong>? Todas as sessões serão desconectadas.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
function NumbersPage() {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [qrInstance, setQrInstance] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listInstances();
      if (result.error) {
        setError(result.error);
        return;
      }

      // Fetch connection state for each instance
      const enriched: InstanceInfo[] = await Promise.all(
        result.instances.map(async (inst) => {
          const instName = inst.name ?? inst.instanceName ?? "";
          const base: InstanceInfo = {
            instanceName: instName,
            instanceId: inst.instanceId ?? inst.id,
            status: inst.status ?? inst.connectionStatus ?? "unknown",
            number: inst.number,
            profileName: inst.profileName,
            profilePictureUrl: inst.profilePictureUrl ?? inst.profilePicUrl,
          };
          try {
            const stateResult = await getInstanceState({
              data: { instanceName: instName },
            });
            return { ...base, connectionState: stateResult.state };
          } catch {
            return { ...base, connectionState: "close" as const };
          }
        })
      );

      setInstances(enriched);
    } catch {
      setError("Erro ao conectar com a Evolution API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleDelete = async () => {
    if (!deletingInstance) return;
    setDeleteLoading(true);
    const result = await removeInstance({ data: { instanceName: deletingInstance } });
    setDeleteLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Instância "${deletingInstance}" excluída!`);
      setDeletingInstance(null);
      loadInstances();
    }
  };

  const handleDisconnect = async (instanceName: string) => {
    setActionLoading((prev) => ({ ...prev, [instanceName]: true }));
    const result = await disconnectInstance({ data: { instanceName } });
    setActionLoading((prev) => ({ ...prev, [instanceName]: false }));

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${instanceName} desconectado`);
      loadInstances();
    }
  };

  const handleRestart = async (instanceName: string) => {
    setActionLoading((prev) => ({ ...prev, [instanceName]: true }));
    const result = await restartEvolutionInstance({ data: { instanceName } });
    setActionLoading((prev) => ({ ...prev, [instanceName]: false }));

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${instanceName} reiniciado`);
      loadInstances();
    }
  };

  const isConnected = (inst: InstanceInfo) => inst.connectionState === "open";
  const isConnecting = (inst: InstanceInfo) => inst.connectionState === "connecting";

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Números WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas instâncias via Evolution API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadInstances}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nova instância
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro de conexão</p>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        </div>
      )}

      {loading && instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Carregando instâncias...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {instances.map((inst) => {
            const connected = isConnected(inst);
            const connecting = isConnecting(inst);
            const busy = actionLoading[inst.instanceName] || false;

            return (
              <div
                key={inst.instanceName}
                className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${connected ? "bg-primary/10" : "bg-muted"}`}>
                      <Phone className={`h-6 w-6 ${connected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{inst.instanceName}</h3>
                      {inst.number && (
                        <p className="text-xs text-muted-foreground">{inst.number}</p>
                      )}
                      {inst.profileName && (
                        <p className="text-xs text-muted-foreground">{inst.profileName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {connecting ? (
                        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                      ) : (
                        <Circle
                          className={`h-2.5 w-2.5 fill-current ${connected ? "text-status-open" : "text-status-closed"}`}
                        />
                      )}
                      <span className="text-xs font-medium text-muted-foreground">
                        {connecting ? "Conectando" : connected ? "Conectado" : "Desconectado"}
                      </span>
                    </div>
                    <button
                      onClick={() => setDeletingInstance(inst.instanceName)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir instância"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Status info */}
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-card p-3 text-center">
                    {connected ? (
                      <Wifi className="mx-auto h-4 w-4 text-primary" />
                    ) : (
                      <WifiOff className="mx-auto h-4 w-4 text-muted-foreground" />
                    )}
                    <p className="mt-1 text-xs font-medium text-foreground">
                      {connected ? "Online" : "Offline"}
                    </p>
                  </div>
                  <div className="bg-card p-3 text-center">
                    <Phone className="mx-auto h-4 w-4 text-muted-foreground" />
                    <p className="mt-1 text-xs font-medium text-foreground">
                      {inst.instanceId?.slice(0, 8) || "—"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 p-4">
                  {connected ? (
                    <>
                      <button
                        onClick={() => handleDisconnect(inst.instanceName)}
                        disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                        Desconectar
                      </button>
                      <button
                        onClick={() => handleRestart(inst.instanceName)}
                        disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Reiniciar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setQrInstance(inst.instanceName)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        QR Code
                      </button>
                      <button
                        onClick={() => handleRestart(inst.instanceName)}
                        disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                        Reconectar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && instances.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Phone className="h-16 w-16 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhuma instância encontrada</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie sua primeira instância para conectar um WhatsApp</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Criar instância
          </button>
        </div>
      )}

      <CreateInstanceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadInstances}
      />
      {deletingInstance && (
        <DeleteConfirmModal
          open={!!deletingInstance}
          onClose={() => setDeletingInstance(null)}
          onConfirm={handleDelete}
          instanceName={deletingInstance}
          loading={deleteLoading}
        />
      )}
      {qrInstance && (
        <QrCodeModal
          open={!!qrInstance}
          onClose={() => { setQrInstance(null); loadInstances(); }}
          instanceName={qrInstance}
        />
      )}
    </div>
  );
}
