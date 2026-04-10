import dayjs from 'dayjs';

export function formatDateTime(value) {
  if (value == null || value === '') return '—';

  const parsed = dayjs(value);
  if (!parsed.isValid()) return String(value);

  return parsed.format('DD MMM YYYY, hh:mm:ss A');
}