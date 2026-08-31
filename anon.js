/** Anonymize calendarization for the shareable overview (no names, no task titles). */

export function isNeedResource(resource) {
  return /потребност/i.test(String(resource || ''));
}

export function specialtyLabel(entry = {}) {
  const role = String(entry.role || '').trim();
  if (!role) return '—';
  if (isNeedResource(entry.resource)) return `${role} (потребность)`;
  return role;
}

export function anonymizeEntry(entry = {}) {
  return {
    ...entry,
    task: 'задача',
    resource: specialtyLabel(entry),
    ticket: '',
  };
}

export function anonymizeTeams(teams = {}, extraKeys = []) {
  const next = { ...teams };
  for (const key of extraKeys) {
    if (key && !next[key]) next[key] = { full: key };
  }
  const renamed = {};
  Object.keys(next).forEach((key, index) => {
    const value = next[key];
    if (typeof value === 'string') {
      renamed[key] = `Команда ${index + 1}`;
      return;
    }
    renamed[key] = {
      ...value,
      full: `Команда ${index + 1}`,
    };
  });
  return renamed;
}

export function anonymizeTimeline(raw = {}) {
  const extraKeys = Array.isArray(raw.entries)
    ? raw.entries.map((entry) => entry.team).filter(Boolean)
    : [];
  return {
    ...raw,
    teams: anonymizeTeams(raw.teams, extraKeys),
    entries: Array.isArray(raw.entries) ? raw.entries.map(anonymizeEntry) : [],
  };
}

export function anonymizeRoster(roster = {}) {
  const people = Array.isArray(roster.people)
    ? roster.people.map((person, index) => ({
      ...person,
      id: `${person.role || 'role'}-${index + 1}`,
      name: person.role || 'специальность',
      note: '',
    }))
    : [];
  return {
    ...roster,
    notes: 'Штат по специальностям, без имён.',
    people,
  };
}

export function isSharePage() {
  return typeof document !== 'undefined'
    && document.documentElement
    && document.documentElement.getAttribute('data-share') === '1';
}

export function shareDataPath(file) {
  return `../${file}`;
}
