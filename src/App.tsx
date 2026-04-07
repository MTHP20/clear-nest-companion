import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "@/contexts/SessionContext";
import Landing from "./pages/Landing";
import Conversation from "./pages/Conversation";
import Dashboard from "./pages/Dashboard";
import AdminLogin from "./pages/AdminLogin";
import Blog from "./pages/Blog";
import NotFound from "./pages/NotFound";
import { LegalDocument } from "./pages/LegalDocument";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SessionProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/conversation" element={<Conversation />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/privacy" element={<LegalDocument doc="privacy" />} />
            <Route path="/terms" element={<LegalDocument doc="terms" />} />
            <Route path="/safeguarding" element={<LegalDocument doc="safeguarding" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
