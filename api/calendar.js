const ALLOWED_HOSTS = new Set([
  'calendar.google.com',
  'www.google.com',
  'calendar.googleusercontent.com',
  'outlook.office365.com',
  'outlook.live.com'
]);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  let value;
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    value = body.url;
  } catch {
    return response.status(400).json({ error: 'Invalid request body' });
  }
  if (!value) return response.status(400).json({ error: 'Calendar URL is required' });

  let target;
  try { target = new URL(value); }
  catch { return response.status(400).json({ error: 'Invalid calendar URL' }); }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return response.status(400).json({ error: 'Only Google Calendar and Outlook HTTPS iCal feeds are supported' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        'user-agent': 'SamehsChecklist/1.0',
        'accept': 'text/calendar,text/plain;q=0.9,*/*;q=0.1'
      },
      redirect: 'follow'
    });

    if (!upstream.ok) return response.status(502).json({ error: `Calendar returned ${upstream.status}` });
    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > 2_000_000) return response.status(413).json({ error: 'Calendar feed is too large' });
    const ics = await upstream.text();
    if (ics.length > 2_000_000) return response.status(413).json({ error: 'Calendar feed is too large' });
    if (!ics.includes('BEGIN:VCALENDAR')) return response.status(422).json({ error: 'This URL did not return an iCal calendar' });
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).json({ ics });
  } catch (error) {
    if (error?.name === 'AbortError') return response.status(504).json({ error: 'Calendar sync timed out' });
    return response.status(502).json({ error: 'Could not reach the calendar feed' });
  } finally {
    clearTimeout(timer);
  }
}
