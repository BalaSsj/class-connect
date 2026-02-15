import { useState } from "react";
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
import { GraduationCap, ShieldCheck, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type View = "login" | "otp-request" | "otp-verify" | "reset-request" | "reset-confirm";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>("login");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Login successful!");
      navigate("/");
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
      navigate("/");
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg"
          >
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AIRS</h1>
          <p className="text-sm text-muted-foreground">AI-Based Intelligent Faculty Reallocation System</p>
          <p className="text-xs text-muted-foreground">Adhiyamaan College of Engineering — Dept. of CSE</p>
        </div>

        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Card className="border-border/50 shadow-lg backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Sign In
                  </CardTitle>
                  <CardDescription>Choose your preferred login method</CardDescription>
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
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" placeholder="you@adhiyamaan.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <button type="button" onClick={() => setView("reset-request")} className="text-xs text-primary hover:underline">
                              Forgot password?
                            </button>
                          </div>
                          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                          {isLoading ? "Signing in..." : "Sign In"}
                        </Button>
                      </form>
                    </TabsContent>
                    <TabsContent value="otp">
                      <form onSubmit={handleOtpRequest} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="otp-email">Email</Label>
                          <Input id="otp-email" type="email" placeholder="you@adhiyamaan.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
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
            <motion.div key="otp-verify" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <button onClick={() => setView("login")} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
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
                  <Button className="w-full" onClick={handleOtpVerify} disabled={isLoading || otp.length !== 6}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === "reset-request" && (
            <motion.div key="reset" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Card className="border-border/50 shadow-lg">
                <CardHeader>
                  <button onClick={() => setView("login")} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
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
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground">
          Contact your administrator if you need an account
        </p>
      </motion.div>
    </div>
  );
}
