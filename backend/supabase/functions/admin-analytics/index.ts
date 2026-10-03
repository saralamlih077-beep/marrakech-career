import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const pageSize = 1000;
const sentStatuses = new Set(['applied', 'interview', 'accepted', 'rejected']);

type Profile = { id: string; full_name: string | null; job_title: string | null; skills: string | null; education?: string | null; experience?: string | null };
type Application = { user_id: string; statut: string | null; created_at?: string };
type Event = { user_id: string; event_type: string; occurred_at: string };
type StatusEvent = { statut: string; occurred_at: string };


const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' });
function bucketKey(value: string | Date, period: 'week' | 'month') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = calendar.formatToParts(date);
  const get = (type: string) => Number(parts.find(item => item.type === type)?.value);
  const start = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  if (period === 'month') start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  return start.toISOString().slice(0, 10);
}
function periods(period: 'week' | 'month') {
  const latest = new Date(bucketKey(new Date(), period));
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(latest);
    if (period === 'month') start.setUTCMonth(start.getUTCMonth() + index - 11);
    else start.setUTCDate(start.getUTCDate() + (index - 11) * 7);
    return { key: start.toISOString().slice(0, 10), date: start.toLocaleDateString('fr-FR', { timeZone: 'UTC', ...(period === 'month' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: '2-digit' }) }) };
  });
}
function engagementSeries(events: Event[], createdById: Map<string, string>, startedAt: string | null, period: 'week' | 'month') {
  return periods(period).map(point => {
    if (!startedAt || point.key < bucketKey(startedAt, period)) return { ...point, activeUsers: null, newUsers: null, returningUsers: null, cvViews: null, offerViews: null };
    const current = events.filter(item => bucketKey(item.occurred_at, period) === point.key);
    const active = new Set(current.map(item => item.user_id));
    const newUsers = [...active].filter(id => bucketKey(createdById.get(id) || '', period) === point.key).length;
    return { ...point, activeUsers: active.size, newUsers, returningUsers: active.size - newUsers, cvViews: current.filter(item => item.event_type === 'cv_view').length, offerViews: current.filter(item => item.event_type === 'offer_view').length };
  });
}
function applicationSeries(applications: Application[], events: StatusEvent[], startedAt: string | null, period: 'week' | 'month') {
  return periods(period).map(point => {
    const history = events.filter(item => bucketKey(item.occurred_at, period) === point.key);
    const tracked = Boolean(startedAt && point.key >= bucketKey(startedAt, period));
    return { ...point,
      registered: applications.filter(item => bucketKey(item.created_at || '', period) === point.key).length,
      sent: tracked ? history.filter(item => item.statut === 'applied').length : null,
      interviews: tracked ? history.filter(item => item.statut === 'interview').length : null,
      accepted: tracked ? history.filter(item => item.statut === 'accepted').length : null,
    };
  });
}
function normalizedSkill(value: string) { return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function skillCoverage(profiles: Profile[], offers: Array<{ status: string; skills?: string[] }>) {
  const relevant = offers.filter(item => item.status === 'verified');
  const skills = new Map<string, { skill: string; profiles: number; offers: number; rate: number }>();
  for (const profile of profiles) {
    const seen = new Set<string>();
    for (const label of (profile.skills || '').split(/[,;\n]/)) {
      const key = normalizedSkill(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const row = skills.get(key) || { skill: label.trim(), profiles: 0, offers: 0, rate: 0 };
      row.profiles += 1;
      skills.set(key, row);
    }
  }
  for (const offer of relevant) {
    for (const key of new Set((offer.skills || []).map(normalizedSkill))) {
      const row = skills.get(key);
      if (row) row.offers += 1;
    }
  }
  return { verifiedOffers: relevant.length, skills: [...skills.values()].map(row => ({ ...row, rate: relevant.length ? Math.round(row.offers / relevant.length * 100) : 0 })).sort((a, b) => b.profiles - a.profiles).slice(0, 6) };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await service.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const allowed = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!user.email || !allowed.includes(user.email.toLowerCase())) return Response.json({ error: 'Forbidden' }, { status: 403, headers });

    // Read every page: analytics must not stop at the API's 1,000-row limit.
    async function allRows<T>(table: string, columns: string, orderColumn = 'id'): Promise<T[]> {
      const result: T[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await service.from(table).select(columns).order(orderColumn).range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as unknown as T[];
        result.push(...rows);
        if (rows.length < pageSize) return result;
      }
    }
    async function allUsers() {
      const result = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: pageSize });
        if (error) throw error;
        result.push(...data.users);
        if (data.users.length < pageSize) return result;
      }
    }

    const [users, profiles, applications, offers, favoriteResult, feedbackResult, eventResult, statusResult, trackingResult] = await Promise.all([
      allUsers(),
      allRows<Profile>('profiles', 'id,full_name,job_title,skills,education,experience'),
      allRows<Application>('candidatures', 'user_id,statut,created_at'),
      allRows<{ status: string; skills?: string[] }>('job_offers', 'status,skills'),
      service.from('favoris').select('*', { count: 'exact', head: true }),
      allRows<{ rating: number }>('user_feedback', 'rating', 'user_id')
        .then(rows => ({ rows, available: true })).catch(() => ({ rows: [], available: false })),
      allRows<Event>('user_activity_events', 'user_id,event_type,occurred_at').then(rows => ({ rows, available: true })).catch(() => ({ rows: [], available: false })),
      allRows<StatusEvent>('candidature_status_events', 'statut,occurred_at').then(rows => ({ rows, available: true })).catch(() => ({ rows: [], available: false })),
      allRows<{ key: string; started_at: string }>('analytics_tracking_settings', 'key,started_at', 'key').catch(() => []),
    ]);
    if (favoriteResult.error) throw favoriteResult.error;
    const profileById = new Map(profiles.map(profile => [profile.id, profile]));
    const applicationsByUser = new Map<string, { total: number; sent: number }>();
    const applicationsByStatus: Record<string, number> = {};
    for (const application of applications) {
      const status = application.statut?.trim().toLowerCase() || 'saved';
      applicationsByStatus[status] = (applicationsByStatus[status] || 0) + 1;
      const counts = applicationsByUser.get(application.user_id) || { total: 0, sent: 0 };
      counts.total += 1;
      if (sentStatuses.has(status)) counts.sent += 1;
      applicationsByUser.set(application.user_id, counts);
    }
    const registeredUsers = users.map(item => {
      const profile = profileById.get(item.id);
      const counts = applicationsByUser.get(item.id);
      const metadataName = item.user_metadata?.full_name || item.user_metadata?.name;
      return {
        id: item.id,
        email: item.email || '',
        fullName: profile?.full_name?.trim() || (typeof metadataName === 'string' ? metadataName.trim() : ''),
        createdAt: item.created_at,
        emailConfirmedAt: item.email_confirmed_at || null,
        applicationCount: counts?.total || 0,
        sentApplicationCount: counts?.sent || 0,
      };
    }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    const profilesCompleted = users.filter(item => {
      const profile = profileById.get(item.id);
      return Boolean(profile?.job_title?.trim() && profile.skills?.trim());
    }).length;
    const confirmedEmails = users.filter(item => Boolean(item.email_confirmed_at)).length;
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const offerStatus = { total: offers.length, verified: 0, pending: 0, closed: 0 };
    for (const offer of offers) {
      if (offer.status === 'verified') offerStatus.verified += 1;
      else if (offer.status === 'closed') offerStatus.closed += 1;
      else offerStatus.pending += 1;
    }
    const ratings = [1, 2, 3, 4, 5].map(rating => ({ rating, value: feedbackResult.rows.filter(item => item.rating === rating).length }));
    const totalFeedback = ratings.reduce((sum, item) => sum + item.value, 0);
    const averageRating = totalFeedback ? Math.round(ratings.reduce((sum, item) => sum + item.rating * item.value, 0) / totalFeedback * 10) / 10 : 0;

    const activityStartedAt = trackingResult.find(item => item.key === 'activity')?.started_at || null;
    const statusStartedAt = trackingResult.find(item => item.key === 'application_status')?.started_at || null;
    const createdById = new Map(users.map(item => [item.id, item.created_at]));
    const activeLast30Days = new Set(eventResult.rows.filter(item => Date.parse(item.occurred_at) >= since).map(item => item.user_id)).size;
    const profileFields = ['full_name', 'job_title', 'skills', 'education', 'experience'] as const;
    const profileQuality = profileFields.map(field => ({ field, value: users.filter(item => Boolean(profileById.get(item.id)?.[field]?.trim())).length }));

    return Response.json({
      schemaVersion: 2,
      users: {
        total: users.length,
        newLast30Days: users.filter(item => Date.parse(item.created_at) >= since).length,
        profilesCompleted,
        registeredUsers,
        emailConfirmation: [{ name: 'Confirmés', value: confirmedEmails }, { name: 'À confirmer', value: users.length - confirmedEmails }],
        profileCompletion: [{ name: 'Profils complets', value: profilesCompleted }, { name: 'À compléter', value: users.length - profilesCompleted }],
      },
      activity: { favorites: favoriteResult.count || 0, applications: applications.length, applicationsByStatus },
      offers: offerStatus,
      engagement: {
        available: eventResult.available && Boolean(activityStartedAt), startedAt: activityStartedAt, activeLast30Days,
        week: engagementSeries(eventResult.rows, createdById, activityStartedAt, 'week'),
        month: engagementSeries(eventResult.rows, createdById, activityStartedAt, 'month'),
      },
      applicationTrends: {
        statusTrackingAvailable: statusResult.available && Boolean(statusStartedAt), startedAt: statusStartedAt,
        week: applicationSeries(applications, statusResult.rows, statusStartedAt, 'week'),
        month: applicationSeries(applications, statusResult.rows, statusStartedAt, 'month'),
      },
      skills: skillCoverage(profiles.filter(profile => createdById.has(profile.id)), offers),
      profileQuality,
      feedback: feedbackResult.available ? {
        total: totalFeedback, averageRating, ratings,
        interpretation: totalFeedback ? `${averageRating}/5 de satisfaction sur ${totalFeedback} avis.` : 'Aucun avis utilisateur pour le moment.',
      } : null,
    }, { headers });
  } catch (error) {
    console.error('admin-analytics:', error);
    return Response.json({ error: 'Impossible de charger les données administrateur.' }, { status: 500, headers });
  }
});
