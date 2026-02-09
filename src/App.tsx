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
import AdminDashboard from "./pages/admin/AdminDashboard";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import YearsSectionsPage from "./pages/admin/YearsSectionsPage";
import SubjectsPage from "./pages/admin/SubjectsPage";
import FacultyPage from "./pages/admin/FacultyPage";
import TimetablePage from "./pages/admin/TimetablePage";
import HodDashboard from "./pages/hod/HodDashboard";
import FacultyDashboard from "./pages/faculty/FacultyDashboard";

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
    <ProtectedRoute allowedRoles={["hod"]}>
      <AppLayout />
    </ProtectedRoute>
  );
}

function FacultyLayout() {
  return (
    <ProtectedRoute allowedRoles={["faculty"]}>
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

            {/* Admin routes */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/departments" element={<DepartmentsPage />} />
              <Route path="/admin/years-sections" element={<YearsSectionsPage />} />
              <Route path="/admin/subjects" element={<SubjectsPage />} />
              <Route path="/admin/faculty" element={<FacultyPage />} />
              <Route path="/admin/timetable" element={<TimetablePage />} />
            </Route>

            {/* HOD routes */}
            <Route element={<HodLayout />}>
              <Route path="/hod" element={<HodDashboard />} />
            </Route>

            {/* Faculty routes */}
            <Route element={<FacultyLayout />}>
              <Route path="/faculty" element={<FacultyDashboard />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
