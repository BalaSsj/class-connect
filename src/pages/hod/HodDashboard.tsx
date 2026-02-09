import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Shuffle, Users } from "lucide-react";

export default function HodDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">HOD Dashboard</h1>
        <p className="text-muted-foreground">Department overview and management</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Leaves</CardTitle>
            <ClipboardList className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">—</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Reallocations</CardTitle>
            <Shuffle className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">—</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faculty Available</CardTitle>
            <Users className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">—</div></CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">Full HOD features coming in Phase 4.</p>
    </div>
  );
}
