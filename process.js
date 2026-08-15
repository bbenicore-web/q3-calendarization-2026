const PALETTE = [
  { color: '#2E75B6', bg: '#DDEBF7' },
  { color: '#C65911', bg: '#FCE4D6' },
  { color: '#7030A0', bg: '#E4DFEC' },
  { color: '#BF9000', bg: '#FFF2CC' },
  { color: '#548235', bg: '#E2EFDA' },
  { color: '#C00000', bg: '#F8CBAD' },
  { color: '#385723', bg: '#C6EFCE' },
  { color: '#1F4E79', bg: '#BDD7EE' },
];

export const TASK_LABEL_LIMIT = 45;

export function teamFull(teams, key) {
  return (teams && teams[key] && teams[key].full) || key;
}

export function truncateTask(task, limit = TASK_LABEL_LIMIT) {
  const text = task == null ? '' : String(task);
  return text.length > limit ? text.slice(0, limit) : text;
}

export function isVacation(value) {
  return String(value || '').toLowerCase().includes('отпуск');
}

export function weekCellLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (isVacation(text)) return 'отпуск';
  const match = text.match(/^(\d+)/);
  if (match) return match[1];
  return text;
}

export function conflictTaskLabel(teams, entry) {
  const full = teamFull(teams, entry.team);
  return `[${full}] ${truncateTask(entry.task || '')} / ${entry.resource || ''}`;
}

export function normalizeTeams(rawTeams = {}, entries = []) {
  const teams = { ...rawTeams };
  for (const entry of entries) {
    if (entry.team && !teams[entry.team]) {
      teams[entry.team] = { full: String(entry.team).replace(/_/g, '/') };
    }
  }
  const normalized = {};
  Object.keys(teams).forEach((key, index) => {
    const value = teams[key];
    const palette = PALETTE[index % PALETTE.length];
    if (typeof value === 'string') {
      normalized[key] = { full: value, color: palette.color, bg: palette.bg };
      return;
    }
    normalized[key] = {
      full: value.full || key.replace(/_/g, '/'),
      color: value.color || palette.color,
      bg: value.bg || palette.bg,
    };
  });
  return normalized;
}

export function normalizeWeeks(rawWeeks, entries = []) {
  if (Array.isArray(rawWeeks) && rawWeeks.length) {
    return rawWeeks.map((week) => ({
      iso: week.iso || week.date || week.start,
      label: week.label || formatWeekLabel(week.iso || week.date || week.start),
    }));
  }
  const isoSet = new Set();
  for (const entry of entries) {
    Object.keys(entry.weeks || {}).forEach((iso) => isoSet.add(iso));
  }
  return [...isoSet].sort().map((iso) => ({ iso, label: formatWeekLabel(iso) }));
}

export function formatWeekLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

export function processTimeline(raw = {}) {
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const teams = normalizeTeams(raw.teams, entries);
  const weeks = normalizeWeeks(raw.weeks, entries);
  const conflicts = [];
  const weekly = [];

  for (const week of weeks) {
    const hasWork = new Set();
    for (const entry of entries) {
      const value = entry.weeks && entry.weeks[week.iso];
      if (value && !isVacation(value)) {
        hasWork.add(`${entry.team}\0${entry.role || ''}`);
      }
    }

    const byRole = new Map();
    const counts = {};
    let total = 0;

    for (const entry of entries) {
      const value = entry.weeks && entry.weeks[week.iso];
      if (!value) continue;
      total += 1;
      const full = teamFull(teams, entry.team);
      counts[full] = (counts[full] || 0) + 1;
      const role = entry.role || '';
      if (!byRole.has(role)) {
        byRole.set(role, { teams: new Set(), tasks: [] });
      }
      const bucket = byRole.get(role);
      bucket.teams.add(full);
      if (isVacation(value) && hasWork.has(`${entry.team}\0${role}`)) continue;
      bucket.tasks.push(conflictTaskLabel(teams, entry));
    }

    const weekConflicts = [];
    for (const [role, info] of byRole) {
      if (info.teams.size < 2) continue;
      const teamList = [...info.teams].sort((a, b) => a.localeCompare(b, 'ru'));
      const conflict = {
        week: week.iso,
        weekLabel: week.label,
        role,
        teams: teamList,
        tasks: info.tasks,
      };
      conflicts.push(conflict);
      weekConflicts.push({ role, teams: teamList });
    }

    weekly.push({
      week: week.iso,
      weekLabel: week.label,
      total,
      counts,
      activeTeams: Object.keys(counts).sort((a, b) => a.localeCompare(b, 'ru')),
      conflicts: weekConflicts,
    });
  }

  return {
    generated: raw.generated || null,
    title: raw.title || null,
    teams,
    weeks,
    entries,
    conflicts,
    weekly,
  };
}

export function roleMatrix(data) {
  const roles = [...new Set(data.entries.map((entry) => entry.role || ''))].sort((a, b) =>
    a.localeCompare(b, 'ru')
  );
  const rows = roles.map((role) => {
    const cells = data.weeks.map((week) => {
      const teams = new Set();
      let busy = 0;
      let vacation = 0;
      for (const entry of data.entries) {
        const value = entry.weeks && entry.weeks[week.iso];
        if (!value || (entry.role || '') !== role) continue;
        teams.add(teamFull(data.teams, entry.team));
        if (isVacation(value)) vacation += 1;
        else busy += 1;
      }
      return {
        week: week.iso,
        weekLabel: week.label,
        teams: [...teams].sort((a, b) => a.localeCompare(b, 'ru')),
        busy,
        vacation,
        conflict: teams.size >= 2,
      };
    });
    return { role, cells };
  });
  return rows;
}
