import { AuthForm } from '@/features/auth/AuthForm';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="register" nextPath={next} />;
}
