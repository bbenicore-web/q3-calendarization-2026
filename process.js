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

export const WORK_DAYS_PER_MONTH = 22;

export function occupancyDays(value) {
  if (!value) return 0;
  if (isVacation(value)) return 0;
  const parsed = Number(weekCellLabel(value));
  return Number.isFinite(parsed) ? parsed : 1;
}

export function weekMonthKey(isoMonday) {
  if (!isoMonday || !/^\d{4}-\d{2}-\d{2}$/.test(isoMonday)) return '';
  const date = new Date(`${isoMonday}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 2);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey) {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const [, month] = String(monthKey).split('-');
  return months[Number(month) - 1] || monthKey;
}

function balanceStatus(balance) {
  if (balance < 0) return 'дефицит';
  if (balance > 0) return 'профицит';
  return 'норма';
}

export function canonicalTeam(roster, team) {
  const aliases = roster && roster.aliases ? roster.aliases : {};
  return aliases[team] || team;
}

export function rosterHeadcount(roster, role, selectedTeams) {
  const people = Array.isArray(roster && roster.people) ? roster.people : [];
  const selected = selectedTeams
    ? new Set([...selectedTeams].map((team) => canonicalTeam(roster, team)))
    : null;
  let fte = 0;
  const names = [];
  for (const person of people) {
    if ((person.role || '') !== role) continue;
    let personFte = 0;
    for (const alloc of person.allocations || []) {
      const team = canonicalTeam(roster, alloc.team);
      if (!selected || selected.has(team)) personFte += Number(alloc.fte) || 0;
    }
    if (personFte <= 0) continue;
    fte += Math.min(personFte, 1);
    names.push(person.name || person.id || role);
  }
  return { fte, people: names.length, names };
}

export function rolePersonDays(data = {}, options = {}) {
  const roster = options.roster || data.roster || { people: [] };
  const teamFilter = options.teams;
  const selectedTeams = Array.isArray(teamFilter) ? new Set(teamFilter.map((team) => canonicalTeam(roster, team))) : null;
  const weeks = normalizeWeeks(data.weeks, data.entries);
  const allowedWeeks = new Set(weeks.map((week) => week.iso));
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const months = [...new Set(weeks.map((week) => weekMonthKey(week.iso)).filter(Boolean))].sort();
  const byRole = new Map();

  const ensure = (role) => {
    if (!byRole.has(role)) {
      byRole.set(role, { demand: new Map() });
    }
    return byRole.get(role);
  };

  for (const entry of entries) {
    const role = entry.role || '';
    if (!role || role === 'Отпуск') continue;
    const team = canonicalTeam(roster, entry.team);
    if (selectedTeams && !selectedTeams.has(team)) continue;
    const bucket = ensure(role);
    for (const [iso, value] of Object.entries(entry.weeks || {})) {
      if (!value) continue;
      if (allowedWeeks.size && !allowedWeeks.has(iso)) continue;
      const month = weekMonthKey(iso);
      if (!month) continue;
      bucket.demand.set(month, (bucket.demand.get(month) || 0) + occupancyDays(value));
    }
  }

  const monthCount = months.length || 1;
  const rows = [...byRole.keys()].sort((a, b) => a.localeCompare(b, 'ru')).map((role) => {
    const bucket = byRole.get(role);
    const headcount = rosterHeadcount(roster, role, teamFilter);
    const monthMap = {};
    for (const month of months) {
      const days = bucket.demand.get(month) || 0;
      const capacity = headcount.fte * WORK_DAYS_PER_MONTH;
      const balance = capacity - days;
      monthMap[month] = {
        days,
        fte: headcount.fte,
        people: headcount.people,
        capacity,
        balance,
        neededFte: days / WORK_DAYS_PER_MONTH,
        status: balanceStatus(balance),
      };
    }
    const days = Object.values(monthMap).reduce((sum, item) => sum + item.days, 0);
    const capacity = Object.values(monthMap).reduce((sum, item) => sum + item.capacity, 0);
    const balance = capacity - days;
    return {
      role,
      fte: headcount.fte,
      people: headcount.people,
      names: headcount.names,
      days,
      capacity,
      balance,
      neededFte: days / WORK_DAYS_PER_MONTH / monthCount,
      status: balanceStatus(balance),
      load: capacity ? days / capacity : (days ? Infinity : 0),
      months: monthMap,
    };
  });

  return { months, rows, workDaysPerMonth: WORK_DAYS_PER_MONTH };
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
