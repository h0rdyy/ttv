import { AuthForm } from '@/features/auth/AuthForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" nextPath={next} />;
}
