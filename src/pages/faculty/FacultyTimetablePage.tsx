import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const PERIOD_TIMES = ["9:00-9:50", "9:50-10:40", "10:50-11:40", "11:40-12:30", "1:30-2:20", "2:20-3:10", "3:10-4:00"];

const COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
  "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
  "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
  "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200",
];

export default function FacultyTimetablePage() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const colorMap = new Map<string, string>();

  const getColor = (id: string) => {
    if (!colorMap.has(id)) colorMap.set(id, COLORS[colorMap.size % COLORS.length]);
    return colorMap.get(id)!;
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: f } = await supabase.from("faculty").select("id").eq("user_id", user.id).single();
      if (!f) return;
      const { data } = await supabase
        .from("timetable_slots")
        .select("*, subjects(name, code, is_lab), years_sections(year, section)")
        .eq("faculty_id", f.id);
      if (data) setSlots(data);
    };
    load();
  }, [user]);

  const getSlot = (day: number, period: number) => slots.find((s) => s.day_of_week === day && s.period_number === period);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Timetable</h1>
        <p className="text-muted-foreground">Your weekly teaching schedule</p>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" />Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="border border-border p-2 bg-muted text-xs font-medium text-muted-foreground w-24">Day</th>
                  {PERIODS.map((p, i) => (
                    <th key={p} className="border border-border p-2 bg-muted text-xs font-medium text-muted-foreground">
                      <div>P{p}</div>
                      <div className="text-[10px] font-normal">{PERIOD_TIMES[i]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dayIdx) => (
                  <tr key={day}>
                    <td className="border border-border p-2 font-medium text-sm bg-muted/50">{day}</td>
                    {PERIODS.map((period) => {
                      const slot = getSlot(dayIdx + 1, period);
                      return (
                        <td key={period} className="border border-border p-1 h-14">
                          {slot ? (
                            <div className={`rounded p-1.5 text-xs ${getColor(slot.subject_id)}`}>
                              <div className="font-semibold truncate">{slot.subjects?.code}</div>
                              <div className="truncate text-[10px] opacity-75">
                                Y{slot.years_sections?.year}-{slot.years_sections?.section}
                              </div>
                              {slot.is_lab && <Badge variant="outline" className="text-[9px] px-1 py-0">LAB</Badge>}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xs">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
