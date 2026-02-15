import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, FileText, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function LabManualsPage() {
  const [manuals, setManuals] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [m, s] = await Promise.all([
        supabase.from("lab_manuals").select("*, subjects(name, code)").order("experiment_number"),
        supabase.from("subjects").select("*").eq("is_lab", true).order("name"),
      ]);
      if (m.data) setManuals(m.data);
      if (s.data) setSubjects(s.data);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lab Manuals</h1>
        <p className="text-muted-foreground">Access experiment procedures and lab resources</p>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {manuals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No lab manuals available yet. Contact your admin to upload resources.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {manuals.map((m) => (
              <Card key={m.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      {m.experiment_number ? `Exp ${m.experiment_number}: ` : ""}{m.title}
                    </CardTitle>
                    <Badge variant="secondary">{m.subjects?.code}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {m.description && <p className="text-xs text-muted-foreground mb-2">{m.description}</p>}
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <ExternalLink className="h-3 w-3" /> View Document
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
