import { AuthForm } from '@/features/auth/AuthForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const { next, error, notice } = await searchParams;
  return <AuthForm mode="login" nextPath={next} error={error} notice={notice} />;
}
