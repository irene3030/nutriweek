function qpDecode(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)));
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<(?:br|p|div|tr|td|th|h[1-6]|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ').replace(/&[a-z]{2,8};/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodePart(body, headers) {
  const m = headers.match(/Content-Transfer-Encoding:\s*(\S+)/i);
  const enc = m ? m[1].toLowerCase() : '7bit';
  if (enc === 'quoted-printable') return qpDecode(body);
  if (enc === 'base64') {
    try { return atob(body.replace(/\s/g, '')); } catch { return body; }
  }
  return body;
}

// Extracts readable text from a .eml file string.
// Prefers text/plain; falls back to HTML-stripped text/html.
// Returns up to 3500 chars to keep AI token costs reasonable.
export function parseEml(raw) {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const topSep = text.indexOf('\n\n');
  if (topSep === -1) return text.slice(0, 3500);
  const topHeaders = text.slice(0, topSep);
  const topBody = text.slice(topSep + 2);

  const topCtMatch = topHeaders.match(/^Content-Type:\s*([^\n]+(?:\n[ \t][^\n]+)*)/im);
  const topCt = topCtMatch ? topCtMatch[1].replace(/\s+/g, ' ') : '';
  const bMatch = topCt.match(/boundary=["']?([^"';\s\n]+)["']?/i);

  if (!bMatch) {
    const decoded = decodePart(topBody, topHeaders);
    const result = topCt.toLowerCase().includes('html') ? stripHtml(decoded) : decoded;
    return result.slice(0, 3500);
  }

  const boundary = bMatch[1];
  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`\n--${escaped}(?:--)?\n?`)).slice(1);

  let plain = '';
  let html = '';

  for (const part of parts) {
    const sep = part.indexOf('\n\n');
    if (sep === -1) continue;
    const headers = part.slice(0, sep);
    const body = part.slice(sep + 2);
    const ct = (headers.match(/Content-Type:\s*([^\n;]+)/i)?.[1] || '').trim().toLowerCase();

    if (ct === 'text/plain' && !plain) plain = decodePart(body, headers).trim();
    else if (ct === 'text/html' && !html) html = stripHtml(decodePart(body, headers));
    else if (ct.startsWith('multipart/') && !plain && !html) {
      // Try to extract from nested multipart
      const nested = parseEml(headers + '\n\n' + body);
      if (nested) plain = nested;
    }
  }

  return (plain || html || '').slice(0, 3500);
}
