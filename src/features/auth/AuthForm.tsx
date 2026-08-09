import Link from 'next/link';
import { login, register } from './actions';

const errorText: Record<string, string> = {
  required: 'Заполните все поля.',
  'invalid-credentials': 'Неверная почта или пароль.',
  'already-registered': 'Аккаунт с этой почтой уже существует.',
  'confirm-failed': 'Не удалось подтвердить почту. Попробуйте открыть письмо ещё раз.',
  email: 'Проверьте адрес почты и попробуйте ещё раз.',
  password: 'Проверьте пароль. Нужно минимум 8 символов.',
  unknown: 'Не удалось выполнить вход. Попробуйте ещё раз.',
};

export function AuthForm({
  mode,
  nextPath = '/campaigns/online',
  error,
  notice,
}: {
  mode: 'login' | 'register';
  nextPath?: string;
  error?: string;
  notice?: string;
}) {
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/campaigns/online';
  const registerHref = `/register?next=${encodeURIComponent(safeNext)}`;
  const loginHref = `/login?next=${encodeURIComponent(safeNext)}`;
  const action = mode === 'login' ? login : register;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/campaigns" className="brand">✥ TTV</Link>
        <span className="eyebrow">{mode === 'login' ? 'ВХОД' : 'НОВЫЙ АККАУНТ'}</span>
        <h1>{mode === 'login' ? 'С возвращением' : 'Создать профиль'}</h1>
        <p>{mode === 'login' ? 'Войдите, чтобы продолжить свои кампании.' : 'Один аккаунт для мастера и игрока.'}</p>

        <form action={action} className="auth-form">
          <input type="hidden" name="next" value={safeNext} />

          {mode === 'register' && (
            <label htmlFor="displayName">
              Имя или ник
              <input id="displayName" name="displayName" required autoComplete="nickname" placeholder="Например, Raven" />
            </label>
          )}

          <label htmlFor="email">
            Почта
            <input id="email" name="email" required type="email" autoComplete="email" />
          </label>

          <label htmlFor="password">
            Пароль
            <input
              id="password"
              name="password"
              required
              minLength={8}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Минимум 8 символов"
            />
          </label>

          <button className="button primary full" type="submit">
            {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        {error && <div className="auth-status">{errorText[error] ?? errorText.unknown}</div>}
        {notice === 'check-email' && <div className="auth-status">Аккаунт создан. Откройте письмо и подтвердите почту.</div>}

        <div className="auth-switch">
          {mode === 'login' ? <>Нет аккаунта? <Link href={registerHref}>Регистрация</Link></> : <>Уже есть аккаунт? <Link href={loginHref}>Войти</Link></>}
        </div>
      </section>
    </main>
  );
}
