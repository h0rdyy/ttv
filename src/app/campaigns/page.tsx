import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const signedIn = Boolean(auth.user);

  return (
    <main className="landing-page">
      <header className="landing-topbar">
        <div className="brand">✥ TTV</div>
        <nav className="hub-actions">
          <Link className="button" href="/campaign/demo/play">Демо без регистрации</Link>
          {signedIn ? (
            <Link className="button primary" href="/campaigns/online">Мои кампании</Link>
          ) : (
            <>
              <Link className="button" href="/login">Войти</Link>
              <Link className="button primary" href="/register">Создать аккаунт</Link>
            </>
          )}
        </nav>
      </header>

      <section className="landing-hero">
        <span className="eyebrow">ВИРТУАЛЬНЫЙ СТОЛ ДЛЯ НАСТОЛЬНЫХ РОЛЕВЫХ ИГР</span>
        <h1>Вся партия за одним столом — прямо в браузере</h1>
        <p>
          Карты и фишки, туман войны, кубы и листы персонажей. Мастер создаёт кампанию,
          игроки заходят по ссылке — ничего устанавливать не нужно.
        </p>
        <div className="landing-cta">
          {signedIn ? (
            <Link className="button primary xl" href="/campaigns/online">Продолжить игру</Link>
          ) : (
            <Link className="button primary xl" href="/register">Начать играть</Link>
          )}
          <Link className="button xl" href="/campaign/demo/play">Посмотреть демо</Link>
        </div>
        <small className="landing-hint">Демо открывается без аккаунта — посмотрите стол глазами мастера.</small>
      </section>

      <section className="landing-steps">
        <article>
          <span className="landing-step-num">1</span>
          <h3>Создайте кампанию</h3>
          <p>Достаточно названия — стол, карта и инструменты мастера уже внутри.</p>
        </article>
        <article>
          <span className="landing-step-num">2</span>
          <h3>Пригласите друзей</h3>
          <p>Отправьте игрокам ссылку-приглашение: они создадут персонажей прямо за столом.</p>
        </article>
        <article>
          <span className="landing-step-num">3</span>
          <h3>Ведите приключение</h3>
          <p>Фишки и сетка, туман войны, броски кубов и бой по инициативе — всё под рукой.</p>
        </article>
      </section>

      <footer className="landing-footer">✥ TTV · сделано для своих кампаний</footer>
    </main>
  );
}
