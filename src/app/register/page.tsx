import { AuthForm } from '@/features/auth/AuthForm';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const { next, error, notice } = await searchParams;
  return <AuthForm mode="register" nextPath={next} error={error} notice={notice} />;
}
