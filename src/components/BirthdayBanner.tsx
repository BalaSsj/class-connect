import { motion } from "framer-motion";
import { Cake, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  name?: string;
  dob?: string | null;
}

export function BirthdayBanner({ name, dob }: Props) {
  if (!dob) return null;
  const today = new Date();
  const d = new Date(dob);
  if (d.getDate() !== today.getDate() || d.getMonth() !== today.getMonth()) return null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-5">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-primary/20 p-3">
            <Cake className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                Happy Birthday{name ? `, ${name}` : ""}! 🎉
              </h2>
              <PartyPopper className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Wishing you a wonderful year ahead from the AIRS team.
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
