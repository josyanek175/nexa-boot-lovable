import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { syncWhatsappNumbers } from "@/lib/evolution-api.functions";

type WhatsAppNumberRow = Tables<"whatsapp_numbers">;

interface NumberContextType {
  activeNumberId: string;
  setActiveNumberId: (id: string) => void;
  numbers: WhatsAppNumberRow[];
  activeNumber: WhatsAppNumberRow | null;
  loading: boolean;
  refresh: () => void;
}

const NumberContext = createContext<NumberContextType | null>(null);

export function NumberProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, session } = useAuth();
  const [activeNumberId, setActiveNumberId] = useState<string>("all");
  const [numbers, setNumbers] = useState<WhatsAppNumberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const sync = useServerFn(syncWhatsappNumbers);

  const fetchNumbers = useCallback(async () => {
    if (!isAuthenticated) {
      setNumbers([]);
      setLoading(false);
      return;
    }
    // 1. Sincroniza com a Evolution (best-effort)
    try {
      await sync({
        ...(session?.access_token
          ? { headers: { "x-supabase-access-token": session.access_token } }
          : {}),
      });
    } catch (err) {
      console.warn("Sync com Evolution falhou (usando dados do banco):", err);
    }
    // 2. Busca do banco (RLS aplica)
    const { data } = await supabase
      .from("whatsapp_numbers")
      .select("*")
      .order("created_at", { ascending: true });
    setNumbers(data ?? []);
    setLoading(false);
  }, [isAuthenticated, sync, session?.access_token]);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers, user?.id]);

  const activeNumber = numbers.find((n) => n.id === activeNumberId) || null;

  return (
    <NumberContext.Provider value={{ activeNumberId, setActiveNumberId, numbers, activeNumber, loading, refresh: fetchNumbers }}>
      {children}
    </NumberContext.Provider>
  );
}

export function useActiveNumber() {
  const ctx = useContext(NumberContext);
  if (!ctx) throw new Error("useActiveNumber must be used within NumberProvider");
  return ctx;
}
