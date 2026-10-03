export type RegistrationPeriod = 'day' | 'week' | 'month';

const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit',
});

function calendarDate(date: Date) {
  const parts = calendar.formatToParts(date);
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

function bucketStart(date: Date, period: RegistrationPeriod) {
  const start = new Date(date);
  if (period === 'month') start.setUTCDate(1);
  if (period === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return start;
}

export function registrationSeries(users: Array<{ createdAt: string }>, period: RegistrationPeriod, now = new Date()) {
  const count = period === 'day' ? 30 : 12;
  const latest = bucketStart(calendarDate(now), period);
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = new Date(latest);
    const offset = index - count + 1;
    if (period === 'month') start.setUTCMonth(start.getUTCMonth() + offset);
    else start.setUTCDate(start.getUTCDate() + offset * (period === 'week' ? 7 : 1));
    return {
      key: start.toISOString().slice(0, 10),
      date: start.toLocaleDateString('fr-FR', { timeZone: 'UTC', ...(period === 'month' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: '2-digit' }) }),
      value: 0,
    };
  });
  const byDate = new Map(buckets.map(bucket => [bucket.key, bucket]));
  for (const user of users) {
    const created = new Date(user.createdAt);
    if (!Number.isFinite(created.getTime()) || created > now) continue;
    const key = bucketStart(calendarDate(created), period).toISOString().slice(0, 10);
    const bucket = byDate.get(key);
    if (bucket) bucket.value += 1;
  }
  return buckets;
}
