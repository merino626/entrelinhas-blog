const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  return dtf.format(new Date(date));
}

export function timeAgo(date: string | Date): string {
  const diffMs = new Date(date).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (abs < min) return 'agora mesmo';
  if (abs < hour) return rtf.format(Math.round(diffMs / min), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day');
  return formatDate(date);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
