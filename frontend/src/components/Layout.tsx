import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Timer, TableProperties, BarChart2, Bot, FolderOpen, LogOut } from "lucide-react";
import ChatWidget from "@/components/ChatWidget";

const navItems = [
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/entries", label: "Entries", icon: TableProperties },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/projects", label: "Projects", icon: FolderOpen },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800">
          <Timer className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold tracking-tight">AgentSentry</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-zinc-800">
          <div className="px-3 py-1 text-xs text-zinc-500 truncate mb-1">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>

      <ChatWidget />
    </div>
  );
}
