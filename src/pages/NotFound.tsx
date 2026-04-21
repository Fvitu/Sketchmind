import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

const NotFound = () => (
  <main className="min-h-screen grid place-items-center bg-background bg-grid p-6">
    <div className="text-center space-y-6 max-w-md">
      <Logo className="justify-center" />
      <div className="space-y-2">
        <h1 className="text-6xl font-semibold tracking-tight font-hand text-gradient-brand">404</h1>
        <p className="text-muted-foreground">This page doesn't exist yet.</p>
      </div>
      <Button asChild className="bg-gradient-brand text-primary-foreground shadow-glow-accent">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  </main>
);

export default NotFound;
