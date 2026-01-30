"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/composer", label: "Compositor", icon: "✏️" },
  { href: "/calendar", label: "Calendário", icon: "📅" },
  { href: "/history", label: "Histórico", icon: "📋" },
  { href: "/channels", label: "Canais", icon: "🔗" },
  { href: "/settings", label: "Definições", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-blue-600">Social Scheduler</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            🚪 Terminar sessão
          </button>
        </form>
      </div>
    </aside>
  );
}
