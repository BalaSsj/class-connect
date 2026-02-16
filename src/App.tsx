import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import YearsSectionsPage from "./pages/admin/YearsSectionsPage";
import SubjectsPage from "./pages/admin/SubjectsPage";
import FacultyPage from "./pages/admin/FacultyPage";
import TimetablePage from "./pages/admin/TimetablePage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import HodDashboard from "./pages/hod/HodDashboard";
import LeaveRequestsPage from "./pages/hod/LeaveRequestsPage";
import ReallocationPage from "./pages/hod/ReallocationPage";
import HodFacultyPage from "./pages/hod/HodFacultyPage";
import FacultyDashboard from "./pages/faculty/FacultyDashboard";
import FacultyTimetablePage from "./pages/faculty/FacultyTimetablePage";
import LeaveApplicationPage from "./pages/faculty/LeaveApplicationPage";
import LabManualsPage from "./pages/faculty/LabManualsPage";
import NotificationsPage from "./pages/faculty/NotificationsPage";
import SyllabusPage from "./pages/faculty/SyllabusPage";
import MyReallocationsPage from "./pages/faculty/MyReallocationsPage";

const queryClient = new QueryClient();

function AdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout />
    </ProtectedRoute>
  );
}

function HodLayout() {
  return (
    <ProtectedRoute allowedRoles={["hod", "admin"]}>
      <AppLayout />
    </ProtectedRoute>
  );
}

function FacultyLayout() {
  return (
    <ProtectedRoute allowedRoles={["faculty", "hod", "admin"]}>
      <AppLayout />
    </ProtectedRoute>
  );
}

function ProfileLayout() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />

            {/* Profile (any authenticated user) */}
            <Route element={<ProfileLayout />}>
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Admin routes */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/departments" element={<DepartmentsPage />} />
              <Route path="/admin/years-sections" element={<YearsSectionsPage />} />
              <Route path="/admin/subjects" element={<SubjectsPage />} />
              <Route path="/admin/faculty" element={<FacultyPage />} />
              <Route path="/admin/timetable" element={<TimetablePage />} />
              <Route path="/admin/analytics" element={<AnalyticsPage />} />
            </Route>

            {/* HOD routes */}
            <Route element={<HodLayout />}>
              <Route path="/hod" element={<HodDashboard />} />
              <Route path="/hod/leave-requests" element={<LeaveRequestsPage />} />
              <Route path="/hod/reallocations" element={<ReallocationPage />} />
              <Route path="/hod/faculty" element={<HodFacultyPage />} />
            </Route>

            {/* Faculty routes */}
            <Route element={<FacultyLayout />}>
              <Route path="/faculty" element={<FacultyDashboard />} />
              <Route path="/faculty/timetable" element={<FacultyTimetablePage />} />
              <Route path="/faculty/syllabus" element={<SyllabusPage />} />
              <Route path="/faculty/my-reallocations" element={<MyReallocationsPage />} />
              <Route path="/faculty/leave" element={<LeaveApplicationPage />} />
              <Route path="/faculty/lab-manuals" element={<LabManualsPage />} />
              <Route path="/faculty/notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
