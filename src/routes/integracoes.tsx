import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Key,
  Webhook,
  Shield,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getIntegrationSettings,
  saveIntegrationSettings,
  testEvolutionApi,
} from "@/lib/integration-settings.functions";

export const Route = createFileRoute("/integracoes")({
  component: IntegracoesPage,
  head: () => ({
    meta: [
      { title: "Integrações — NexaBoot" },
      { name: "description", content: "Configure a Evolution API e webhooks" },
    ],
  }),
});

interface FormState {
  evolution_api_url: string;
  evolution_api_key: string;
  webhook_url: string;
  webhook_secret: string;
}

function IntegracoesPage() {
  const [form, setForm] = useState<FormState>({
    evolution_api_url: "",
    evolution_api_key: "",
    webhook_url: "",
    webhook_secret: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await getIntegrationSettings();
        if (result.error) {
          toast.error(`Erro ao carregar: ${result.error}`);
        } else if (result.settings) {
          setForm({
            evolution_api_url: result.settings.evolution_api_url ?? "",
            evolution_api_key: result.settings.evolution_api_key ?? "",
            webhook_url: result.settings.webhook_url ?? "",
            webhook_secret: result.settings.webhook_secret ?? "",
          });
        }
      } catch {
        toast.error("Falha ao carregar configurações");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveIntegrationSettings({ data: form });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Configurações salvas!");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao salvar"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Salva antes de testar (caso usuário tenha mudado)
      await saveIntegrationSettings({ data: form });
      const result = await testEvolutionApi();
      if (result.success) {
        setTestResult({
          ok: true,
          message: `Conexão OK! ${result.instanceCount} instância(s) encontrada(s).`,
        });
        toast.success("Conexão estabelecida!");
      } else {
        setTestResult({ ok: false, message: result.error ?? "Falha" });
        toast.error(result.error ?? "Falha na conexão");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const suggestedWebhook =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/webhook`
      : "";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-sm text-muted-foreground">
          Configure a Evolution API e o webhook de recebimento
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Evolution API Config */}
        <div className="rounded-xl border-2 border-primary/30 bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-foreground">
                Evolution API
              </h2>
              <p className="text-xs text-muted-foreground">
                Configurações de conexão com seu servidor Evolution
              </p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                URL da API
              </label>
              <input
                type="text"
                value={form.evolution_api_url}
                onChange={(e) =>
                  setForm({ ...form, evolution_api_url: e.target.value })
                }
                placeholder="https://seu-servidor.ngrok.app"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Sem barra final. Ex: https://abc123.ngrok-free.app
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={form.evolution_api_key}
                  onChange={(e) =>
                    setForm({ ...form, evolution_api_key: e.target.value })
                  }
                  placeholder="Sua API key da Evolution"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing || !form.evolution_api_url || !form.evolution_api_key}
                className="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Testar conexão
              </button>
              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    testResult.ok
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Webhook Config */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 border-b border-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Webhook</h2>
              <p className="text-xs text-muted-foreground">
                URL que receberá os eventos da Evolution API
              </p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="rounded-lg bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                <Shield className="mr-1 inline h-3.5 w-3.5 text-primary" />
                URL pública sugerida deste app:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {suggestedWebhook}
                </code>
                <button
                  onClick={() => {
                    copy(suggestedWebhook, "URL");
                    setForm({ ...form, webhook_url: suggestedWebhook });
                  }}
                  className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                URL do Webhook
              </label>
              <input
                type="text"
                value={form.webhook_url}
                onChange={(e) =>
                  setForm({ ...form, webhook_url: e.target.value })
                }
                placeholder="https://seu-app.lovable.app/api/public/webhook"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Webhook Secret (opcional)
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={form.webhook_secret}
                  onChange={(e) =>
                    setForm({ ...form, webhook_secret: e.target.value })
                  }
                  placeholder="Chave para validação de origem"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  );
}
