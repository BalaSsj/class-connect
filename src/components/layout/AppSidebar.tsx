import {
  LayoutDashboard, Building2, Users, BookOpen, Calendar, GraduationCap,
  ClipboardList, Shuffle, Bell, LogOut, Layers, FlaskConical,
  User, BarChart3, Brain,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const adminLinks = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Departments", url: "/admin/departments", icon: Building2 },
  { title: "Years & Sections", url: "/admin/years-sections", icon: Layers },
  { title: "Subjects", url: "/admin/subjects", icon: BookOpen },
  { title: "Faculty", url: "/admin/faculty", icon: Users },
  { title: "Timetable", url: "/admin/timetable", icon: Calendar },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

const hodLinks = [
  { title: "Dashboard", url: "/hod", icon: LayoutDashboard },
  { title: "Leave Requests", url: "/hod/leave-requests", icon: ClipboardList },
  { title: "Reallocations", url: "/hod/reallocations", icon: Brain },
  { title: "Faculty", url: "/hod/faculty", icon: Users },
];

const facultyLinks = [
  { title: "Dashboard", url: "/faculty", icon: LayoutDashboard },
  { title: "My Timetable", url: "/faculty/timetable", icon: Calendar },
  { title: "Leave / OD", url: "/faculty/leave", icon: ClipboardList },
  { title: "Lab Manuals", url: "/faculty/lab-manuals", icon: FlaskConical },
  { title: "Notifications", url: "/faculty/notifications", icon: Bell },
];

export function AppSidebar() {
  const { primaryRole, signOut, user } = useAuth();
  const location = useLocation();

  const links =
    primaryRole === "admin" ? adminLinks :
    primaryRole === "hod" ? hodLinks :
    facultyLinks;

  const roleLabel =
    primaryRole === "admin" ? "Administrator" :
    primaryRole === "hod" ? "Head of Department" :
    "Faculty";

  const initials = (user?.user_metadata?.full_name || user?.email || "?")
    .split(/[@\s]/)
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">AIRS</span>
            <span className="text-xs text-sidebar-foreground/60">{roleLabel}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-wider">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/profile"} tooltip="Profile">
                  <NavLink to="/profile">
                    <User className="h-4 w-4" />
                    <span>My Profile</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign Out">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
