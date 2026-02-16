import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, Mail, KeyRound, ArrowLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import collegeLogo from "@/assets/college-logo.jpg";

type View = "login" | "otp-request" | "otp-verify" | "reset-request" | "reset-confirm";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>("login");
  const { signIn, user, loading, primaryRole } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users — fixes the "double login" issue
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (primaryRole === "admin") navigate("/admin", { replace: true });
    else if (primaryRole === "hod") navigate("/hod", { replace: true });
    else if (primaryRole === "faculty") navigate("/faculty", { replace: true });
  }, [user, loading, primaryRole, navigate]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Login successful!");
      // Navigation handled by useEffect above after roles load
    }
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("OTP sent to your email!");
      setView("otp-verify");
    }
  };

  const handleOtpVerify = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Login successful!");
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent to your email!");
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated! You can now login.");
      setView("login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-primary/10"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full border border-primary/5"
        />
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-primary/20 animate-pulse" />
        <div className="absolute top-3/4 right-1/3 w-1.5 h-1.5 rounded-full bg-primary/15 animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        {/* College Branding Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl shadow-primary/10 bg-card"
          >
            <img src={collegeLogo} alt="Adhiyamaan College of Engineering" className="w-full h-full object-cover" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-1"
          >
            <h1 className="text-xl font-extrabold tracking-tight text-primary uppercase">
              Adhiyamaan College of Engineering
            </h1>
            <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">Hosur</p>
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-primary/40" />
              <Sparkles className="h-3 w-3 text-primary/60" />
              <span className="text-[10px] font-bold text-primary/70 tracking-[0.2em] uppercase">Achieve · Create · Excel</span>
              <Sparkles className="h-3 w-3 text-primary/60" />
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-primary/40" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary">AIRS — Intelligent Faculty Reallocation</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Department of Computer Science & Engineering</p>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <Card className="border-border/50 shadow-2xl shadow-primary/5 backdrop-blur-sm bg-card/95">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Sign In
                  </CardTitle>
                  <CardDescription>Choose your preferred authentication method</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="password" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="password"><KeyRound className="h-3 w-3 mr-1" />Password</TabsTrigger>
                      <TabsTrigger value="otp"><Mail className="h-3 w-3 mr-1" />Email OTP</TabsTrigger>
                    </TabsList>
                    <TabsContent value="password">
                      <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input id="email" type="email" placeholder="you@adhiyamaan.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} required className="transition-all focus:shadow-md focus:shadow-primary/10" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <button type="button" onClick={() => setView("reset-request")} className="text-xs text-primary hover:underline font-medium">
                              Forgot password?
                            </button>
                          </div>
                          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="transition-all focus:shadow-md focus:shadow-primary/10" />
                        </div>
                        <Button type="submit" className="w-full font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all" disabled={isLoading}>
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                              Signing in...
                            </span>
                          ) : "Sign In"}
                        </Button>
                      </form>
                    </TabsContent>
                    <TabsContent value="otp">
                      <form onSubmit={handleOtpRequest} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="otp-email">Email Address</Label>
                          <Input id="otp-email" type="email" placeholder="you@adhiyamaan.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} required className="transition-all focus:shadow-md focus:shadow-primary/10" />
                        </div>
                        <Button type="submit" className="w-full font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all" disabled={isLoading}>
                          {isLoading ? "Sending OTP..." : "Send OTP"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === "otp-verify" && (
            <motion.div key="otp-verify" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <Card className="border-border/50 shadow-2xl shadow-primary/5 bg-card/95">
                <CardHeader>
                  <button onClick={() => setView("login")} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                    <ArrowLeft className="h-3 w-3" /> Back to login
                  </button>
                  <CardTitle className="text-lg">Enter OTP</CardTitle>
                  <CardDescription>We sent a 6-digit code to {email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <InputOTP value={otp} onChange={setOtp} maxLength={6}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button className="w-full font-semibold" onClick={handleOtpVerify} disabled={isLoading || otp.length !== 6}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === "reset-request" && (
            <motion.div key="reset" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <Card className="border-border/50 shadow-2xl shadow-primary/5 bg-card/95">
                <CardHeader>
                  <button onClick={() => setView("login")} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                    <ArrowLeft className="h-3 w-3" /> Back to login
                  </button>
                  <CardTitle className="text-lg">Reset Password</CardTitle>
                  <CardDescription>Enter your email to receive a reset link</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleResetRequest} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" placeholder="you@adhiyamaan.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-[11px] text-muted-foreground"
        >
          Contact your administrator if you need an account
        </motion.p>
      </motion.div>
    </div>
  );
}
