import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Lightbulb, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FacultyAnalysis {
  id: string;
  name: string;
  department: string;
  designation: string;
  totalPeriods: number;
  labPeriods: number;
  teachingDays: number;
  subjects: string[];
  maxPerDay: number;
  utilization: number;
  leavesDays: number;
  substitutions: number;
  status: string;
}

interface AIInsights {
  summary: string;
  recommendations: string[];
  concerns: string[];
  overallHealth: string;
}

export default function AnalyticsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState("all");
  const [analysis, setAnalysis] = useState<FacultyAnalysis[]>([]);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    supabase.from("departments").select("*").order("name").then(({ data }) => {
      if (data) setDepartments(data);
    });
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    setHasRun(true);
    const res = await supabase.functions.invoke("ai-analytics", {
      body: {
        action: "workload-analysis",
        department_id: filterDept === "all" ? null : filterDept,
      },
    });
    setLoading(false);
    if (res.error) {
      console.error("Analysis error:", res.error);
      return;
    }
    setAnalysis(res.data.analysis || []);
    setInsights(res.data.insights || null);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "overloaded": return "text-destructive";
      case "optimal": return "text-green-600 dark:text-green-400";
      case "moderate": return "text-yellow-600 dark:text-yellow-400";
      default: return "text-blue-500";
    }
  };

  const statusBg = (s: string) => {
    switch (s) {
      case "overloaded": return "bg-destructive/10";
      case "optimal": return "bg-green-500/10";
      case "moderate": return "bg-yellow-500/10";
      default: return "bg-blue-500/10";
    }
  };

  const healthIcon = (h: string) => {
    switch (h) {
      case "good": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "poor": return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default: return <TrendingUp className="h-5 w-5 text-yellow-500" />;
    }
  };

  const overloaded = analysis.filter(a => a.status === "overloaded").length;
  const optimal = analysis.filter(a => a.status === "optimal").length;
  const underutilized = analysis.filter(a => a.status === "underutilized").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AI Workload Analytics
          </h1>
          <p className="text-muted-foreground">AI-powered faculty workload analysis and recommendations</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={runAnalysis} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</> : <><Brain className="mr-2 h-4 w-4" />Run AI Analysis</>}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {hasRun && !loading && insights && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* AI Insights Card */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {healthIcon(insights.overallHealth)}
                  AI Insights
                  <Badge variant="outline" className="capitalize ml-2">{insights.overallHealth} Health</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{insights.summary}</p>
                {insights.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Lightbulb className="h-4 w-4 text-yellow-500" />Recommendations</h4>
                    <ul className="space-y-1">
                      {insights.recommendations.map((r, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-primary font-bold">{i + 1}.</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {insights.concerns.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-destructive" />Concerns</h4>
                    <ul className="space-y-1">
                      {insights.concerns.map((c, i) => (
                        <li key={i} className="text-sm text-destructive/80">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Faculty</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{analysis.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />Optimal Load</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-green-600">{optimal}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" />Overloaded</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-destructive">{overloaded}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3 text-blue-500" />Underutilized</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-blue-500">{underutilized}</div></CardContent>
              </Card>
            </div>

            {/* Faculty Workload Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {analysis.sort((a, b) => b.utilization - a.utilization).map((f, i) => (
                <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className={`${statusBg(f.status)} border-l-4 ${f.status === "overloaded" ? "border-l-destructive" : f.status === "optimal" ? "border-l-green-500" : f.status === "moderate" ? "border-l-yellow-500" : "border-l-blue-500"}`}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-sm">{f.name}</h3>
                          <p className="text-xs text-muted-foreground">{f.designation} • {f.department}</p>
                        </div>
                        <Badge variant="outline" className={`capitalize text-xs ${statusColor(f.status)}`}>{f.status}</Badge>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Utilization</span>
                          <span className="font-semibold">{f.utilization}%</span>
                        </div>
                        <Progress value={f.utilization} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-1.5 rounded bg-background/50">
                          <div className="text-sm font-bold">{f.totalPeriods}</div>
                          <div className="text-[10px] text-muted-foreground">Periods</div>
                        </div>
                        <div className="p-1.5 rounded bg-background/50">
                          <div className="text-sm font-bold">{f.subjects.length}</div>
                          <div className="text-[10px] text-muted-foreground">Subjects</div>
                        </div>
                        <div className="p-1.5 rounded bg-background/50">
                          <div className="text-sm font-bold">{f.substitutions}</div>
                          <div className="text-[10px] text-muted-foreground">Subs</div>
                        </div>
                      </div>
                      {f.leavesDays > 0 && (
                        <p className="text-xs text-muted-foreground">📅 {f.leavesDays} leave days approved</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasRun && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-4">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <div>
              <h3 className="text-lg font-semibold">AI-Powered Workload Analysis</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Click "Run AI Analysis" to get intelligent insights about faculty workload distribution, 
                identify overloaded or underutilized staff, and receive actionable recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
