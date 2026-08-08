'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');

    try {
      const supabase = createClient();
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setStatus('Аккаунт создан. Проверь почту и подтверди адрес, затем войди.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      router.push('/campaigns/online');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось выполнить вход.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/campaigns" className="brand">✥ TTV</Link>
        <span className="eyebrow">{mode === 'login' ? 'ВХОД' : 'НОВЫЙ АККАУНТ'}</span>
        <h1>{mode === 'login' ? 'Вернуться к кампании' : 'Создать профиль'}</h1>
        <p>{mode === 'login' ? 'Войди, чтобы открыть серверные кампании.' : 'Один аккаунт для ролей мастера и игрока.'}</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>Имя<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Как тебя показывать в кампании" /></label>
          )}
          <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Пароль<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов" /></label>
          <button className="button primary full" disabled={busy}>{busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
        </form>
        {status && <div className="auth-status">{status}</div>}
        <div className="auth-switch">
          {mode === 'login' ? <>Нет аккаунта? <Link href="/register">Регистрация</Link></> : <>Уже есть аккаунт? <Link href="/login">Войти</Link></>}
        </div>
      </section>
    </main>
  );
}
