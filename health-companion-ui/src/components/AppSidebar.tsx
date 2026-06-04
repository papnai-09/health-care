import Link from "next/link";
import { useRouter } from "next/router";
import { CalendarCheck, FileHeart, LayoutDashboard, LogOut, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Profile", url: "/profile", icon: UserRound },
  { title: "AI Chatbot", url: "/chatbot", icon: MessageCircle },
  { title: "Appointments", url: "/appointments", icon: CalendarCheck },
  { title: "Health Records", url: "/records", icon: FileHeart },
];

const doctorItems = [
  { title: "Dashboard", url: "/doctor-dashboard", icon: LayoutDashboard },
  { title: "Profile", url: "/profile", icon: UserRound },
  { title: "AI Support", url: "/chatbot", icon: MessageCircle },
  { title: "Schedule", url: "/appointments", icon: CalendarCheck },
  { title: "Clinical Records", url: "/records", icon: FileHeart },
];

const adminItems = [
  { title: "Admin", url: "/admin", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const router = useRouter();
  const { signOut, user } = useAuth();
  const menuItems = user?.role === "admin" ? adminItems : user?.role === "doctor" ? doctorItems : items;

  const linkCls = (isActive: boolean) =>
    `flex items-center text-sm font-medium transition-smooth ${
      collapsed ? "mx-auto h-11 w-11 justify-center rounded-xl p-0" : "w-full gap-3 rounded-lg px-3 py-2.5"
    } ${
      isActive
        ? collapsed
          ? "bg-primary text-primary-foreground shadow-soft"
          : "bg-primary-soft text-primary shadow-soft"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={`flex h-16 items-center border-b border-sidebar-border ${collapsed ? "px-2" : "px-4"}`}>
        {!collapsed ? (
          <Logo />
        ) : (
          <Link href="/" className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-soft transition-smooth hover:bg-primary/90" aria-label="MediCare home">
            <span className="text-sm font-bold text-primary-foreground">M</span>
          </Link>
        )}
      </SidebarHeader>

      <SidebarContent className={collapsed ? "px-2 py-4" : "px-3 py-4"}>
        <SidebarGroup className={collapsed ? "p-0" : undefined}>
          <SidebarGroupLabel className={`mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${collapsed ? "sr-only" : ""}`}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className={collapsed ? "items-center gap-2" : "gap-1"}>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className={collapsed ? "h-11 w-11 p-0" : "h-auto p-0"}>
                    <Link href={item.url} className={linkCls(router.pathname === item.url)} aria-label={item.title}>
                      <item.icon className={collapsed ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"} />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border ${collapsed ? "items-center p-2" : "p-3"}`}>
        <button
          onClick={() => {
            signOut();
            router.push("/login");
          }}
          className={`flex text-sm font-medium text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive ${
            collapsed ? "h-11 w-11 items-center justify-center rounded-xl" : "w-full items-center gap-3 rounded-lg px-3 py-2.5"
          }`}
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
