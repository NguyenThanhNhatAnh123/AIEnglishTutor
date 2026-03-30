/**
 * Format a date/timestamp to a human-readable string.
 *
 * @param {string|Date|null} value  - ISO string, Date object, or null
 * @param {string}           style  - 'date' | 'datetime' | 'time' | 'relative'
 * @returns {string}
 */
export function formatDate(value, style = 'date') {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) return '—';

  const locale = 'en-US';

  switch (style) {
    case 'datetime':
      return date.toLocaleString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

    case 'time':
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    case 'relative': {
      const now     = Date.now();
      const diffMs  = now - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr  = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr  / 24);

      if (diffSec < 60)  return 'just now';
      if (diffMin < 60)  return `${diffMin} min ago`;
      if (diffHr  < 24)  return `${diffHr} hr ago`;
      if (diffDay < 7)   return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
      return formatDate(date, 'date');
    }

    case 'date':
    default:
      return date.toLocaleDateString(locale, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
  }
}

/**
 * Format seconds into MM:SS countdown string.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a duration in minutes to a readable string.
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export default formatDate;
