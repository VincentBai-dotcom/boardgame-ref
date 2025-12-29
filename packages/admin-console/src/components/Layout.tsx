import { type ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Menu, MessageSquare, Upload, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface LayoutProps {
  children: ReactNode;
  sidebarContent?: ReactNode;
}

export function Layout({ children, sidebarContent }: LayoutProps) {
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/chat", label: "Chat", icon: MessageSquare },
    { path: "/ingestion", label: "Ingestion", icon: Upload },
  ];

  const sidebarContentElement = (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-base transition-colors ${
                isActive
                  ? "bg-neutral-900 dark:bg-neutral-100 text-neutral-50 dark:text-neutral-900"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {sidebarContent && <Separator />}

      {/* Custom sidebar content (e.g., conversation list for chat) */}
      {sidebarContent}

      <Separator />

      {/* Logout */}
      <div className="p-4 mt-auto">
        <Button onClick={logout} variant="outline" size="sm" className="w-full">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        {sidebarContentElement}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-2 p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              {sidebarContentElement}
            </SheetContent>
          </Sheet>
          <h1 className="font-semibold">
            {navItems.find((item) => item.path === location.pathname)?.label ||
              "App"}
          </h1>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
