'use client';

import { useFormStatus } from 'react-dom';

export function AuthSubmitButton({ mode }: { mode: 'login' | 'register' }) {
  const { pending } = useFormStatus();
  const idleText = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
  const pendingText = mode === 'login' ? 'Входим…' : 'Регистрируем…';

  return (
    <button
      className="button primary full"
      type="submit"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingText : idleText}
    </button>
  );
}
