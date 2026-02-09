import {
  LayoutDashboard,
  Building2,
  Users,
  BookOpen,
  Calendar,
  GraduationCap,
  ClipboardList,
  Shuffle,
  Bell,
  LogOut,
  Layers,
  FlaskConical,
  FileText,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
} from "@/components/ui/sidebar";

const adminLinks = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Departments", url: "/admin/departments", icon: Building2 },
  { title: "Years & Sections", url: "/admin/years-sections", icon: Layers },
  { title: "Subjects", url: "/admin/subjects", icon: BookOpen },
  { title: "Faculty", url: "/admin/faculty", icon: Users },
  { title: "Timetable", url: "/admin/timetable", icon: Calendar },
];

const hodLinks = [
  { title: "Dashboard", url: "/hod", icon: LayoutDashboard },
  { title: "Leave Requests", url: "/hod/leave-requests", icon: ClipboardList },
  { title: "Reallocations", url: "/hod/reallocations", icon: Shuffle },
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
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-sidebar-foreground/50 truncate px-2">
            {user?.email}
          </p>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sign Out">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
