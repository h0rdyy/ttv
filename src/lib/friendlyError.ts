export function friendlyError(error: unknown, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lower = message.toLowerCase();

  if (!message) return fallback;
  if (lower.includes('permission denied') || lower.includes('access denied') || lower.includes('owner access required')) {
    return 'У вас нет доступа к этому действию.';
  }
  if (lower.includes('authentication required') || lower.includes('jwt') || lower.includes('not authenticated')) {
    return 'Сессия закончилась. Войдите в аккаунт ещё раз.';
  }
  if (lower.includes('invite not found')) return 'Эта ссылка приглашения больше не существует.';
  if (lower.includes('invite disabled')) return 'Это приглашение отключено мастером.';
  if (lower.includes('invite expired')) return 'Срок действия приглашения закончился.';
  if (lower.includes('invite exhausted')) return 'Эта ссылка приглашения больше не действует.';
  if (lower.includes('campaign name does not match')) return 'Название кампании введено неверно.';
  if (lower.includes('member not found')) return 'Участник не найден.';
  if (lower.includes('actor not found')) return 'Персонаж не найден.';
  if (lower.includes('already registered') || lower.includes('user already registered')) return 'Аккаунт с этой почтой уже существует.';
  if (lower.includes('invalid login credentials')) return 'Неверная почта или пароль.';
  if (lower.includes('password')) return 'Проверьте пароль и попробуйте ещё раз.';
  if (lower.includes('duplicate') || lower.includes('unique constraint')) return 'Такая запись уже существует.';

  return fallback;
}
