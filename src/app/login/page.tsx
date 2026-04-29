import { LoginForm } from "@/components/auth/login-form";
import { entraEnabled } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm entraEnabled={entraEnabled} initialError={error} />
    </div>
  );
}
