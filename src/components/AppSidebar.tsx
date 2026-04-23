import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  LayoutDashboard,
  Users,
  Settings,
  Zap,
  Headphones,
  Smartphone,
  Plug,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { to: "/", icon: MessageSquare, label: "Conversas", adminOnly: false },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", adminOnly: false },
  { to: "/numbers", icon: Smartphone, label: "Números", adminOnly: true },
  { to: "/agents", icon: Headphones, label: "Atendentes", adminOnly: true },
  { to: "/contacts", icon: Users, label: "Contatos", adminOnly: false },
  { to: "/automations", icon: Zap, label: "Automações", adminOnly: true },
  { to: "/integracoes", icon: Plug, label: "Integrações", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Configurações", adminOnly: true },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, isAdmin, signOut } = useAuth();

  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);
  const roleLabel = role?.nome ?? (isAdmin ? "Administrador" : "Atendente");

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const initials = profile?.nome
    ? profile.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  return (
    <aside className="flex h-screen w-16 flex-col items-center bg-nav-bg py-4 lg:w-56 lg:items-start lg:px-3">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <MessageSquare className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="hidden text-lg font-bold text-nav-foreground lg:block">
          NexaBoot
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 w-full">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== "/" && location.pathname.startsWith(item.to));
          const isHome = item.to === "/" && location.pathname === "/";
          const active = isActive || isHome;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-nav-active/15 text-nav-active"
                  : "text-nav-foreground/60 hover:bg-nav-foreground/5 hover:text-nav-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-nav-active" : ""}`} />
              <span className="hidden lg:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto w-full space-y-2 px-2 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {initials}
          </div>
          <div className="hidden lg:block min-w-0 flex-1">
            <p className="text-xs font-medium text-nav-foreground truncate">{profile?.nome ?? "Carregando..."}</p>
            <p className="text-[10px] text-nav-foreground/50 flex items-center gap-1">
              {isAdmin && <Shield className="h-3 w-3" />}
              {roleLabel}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-nav-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden lg:block">Sair</span>
        </button>
      </div>
    </aside>
  );
}
