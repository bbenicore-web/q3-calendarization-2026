import { processTimeline, isVacation, roleMatrix, teamFull, weekCellLabel, rolePersonDays, formatMonthLabel, WORK_DAYS_PER_MONTH } from './process.js';

const state = {
  catalog: [],
  timelineId: null,
  data: null,
  roster: { people: [] },
  teamKeys: [],
  activeTeams: new Set(),
  role: '',
  type: '',
  query: '',
  week: '',
  tab: 'gantt',
  sort: { col: null, asc: true },
};

function esc(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function currentWeekIso(weeks) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  let current = weeks[0]?.iso || '';
  for (const week of weeks) {
    if (week.iso <= todayKey) current = week.iso;
  }
  return current;
}

function teamBadge(teamKey) {
  const cfg = state.data.teams[teamKey];
  if (!cfg) return esc(teamKey);
  return `<span class="team-badge" style="background:${cfg.bg};color:${cfg.color}">${esc(cfg.full)}</span>`;
}

function badgeByFullName(fullName) {
  const entry = Object.entries(state.data.teams).find(([, cfg]) => cfg.full === fullName);
  if (!entry) return `<span class="team-badge">${esc(fullName)}</span>`;
  return teamBadge(entry[0]);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
}

async function fetchJson(path) {
  if (window.EMBEDDED_FILES && window.EMBEDDED_FILES[path]) {
    return JSON.parse(JSON.stringify(window.EMBEDDED_FILES[path]));
  }
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadCatalog() {
  try {
    const catalog = await fetchJson('timelines.json');
    state.catalog = catalog.timelines || [];
    return catalog.default || state.catalog[0]?.id;
  } catch {
    state.catalog = [{ id: 'q3-2026', title: '3Q 2026', period: '', file: 'data.json' }];
    return 'q3-2026';
  }
}

async function loadRoster() {
  try {
    state.roster = await fetchJson('roster.json');
  } catch {
    state.roster = { people: [] };
  }
}

async function loadTimeline(id) {
  const meta = state.catalog.find((item) => item.id === id) || state.catalog[0];
  if (!meta) throw new Error('Нет таймлайнов в каталоге');
  const raw = await fetchJson(meta.file);
  state.timelineId = meta.id;
  state.data = processTimeline(raw);
  state.teamKeys = Object.keys(state.data.teams);
  state.activeTeams = new Set(state.teamKeys);
  state.role = '';
  state.type = '';
  state.query = '';
  state.week = '';
  state.sort = { col: null, asc: true };
  document.title = `${meta.title} — Календаризация команд`;
  document.getElementById('subtitle').textContent = meta.period
    ? `${meta.period} · ресурсы и пересечения`
    : 'Ресурсы, роли и пересечения по неделям';
  const generated = state.data.generated
    ? 'обновлено ' + new Date(state.data.generated).toLocaleString('ru-RU')
    : 'пересечения считаются автоматически';
  document.getElementById('generated').textContent = generated;
}

function renderTimelineSwitch() {
  const root = document.getElementById('timelineSwitch');
  root.innerHTML = state.catalog.map((item) => {
    const active = item.id === state.timelineId ? 'active' : '';
    return `<button class="timeline-btn ${active}" data-id="${esc(item.id)}">${esc(item.title)}</button>`;
  }).join('');
  root.querySelectorAll('button').forEach((btn) => {
    btn.onclick = async () => {
      if (btn.dataset.id === state.timelineId) return;
      await loadTimeline(btn.dataset.id);
      const url = new URL(window.location.href);
      url.searchParams.set('timeline', state.timelineId);
      history.replaceState({}, '', url);
      bindStaticControls();
      renderAll();
    };
  });
}

function bindStaticControls() {
  const roleSel = document.getElementById('roleFilter');
  const typeSel = document.getElementById('typeFilter');
  const search = document.getElementById('search');
  roleSel.innerHTML = '<option value="">Все роли</option>';
  uniqueSorted(state.data.entries.map((entry) => entry.role)).forEach((role) => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = role;
    roleSel.appendChild(option);
  });
  typeSel.innerHTML = '<option value="">Все типы</option>';
  uniqueSorted(state.data.entries.map((entry) => entry.type)).forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    typeSel.appendChild(option);
  });
  const chips = document.getElementById('teamChips');
  chips.innerHTML = '';
  state.teamKeys.forEach((key) => {
    const cfg = state.data.teams[key];
    const chip = document.createElement('button');
    chip.className = 'chip on';
    chip.textContent = cfg.full;
    chip.style.background = cfg.color;
    chip.onclick = () => {
      if (state.activeTeams.has(key)) {
        state.activeTeams.delete(key);
        chip.classList.remove('on');
        chip.style.background = '';
      } else {
        state.activeTeams.add(key);
        chip.classList.add('on');
        chip.style.background = cfg.color;
      }
      renderAll();
    };
    chips.appendChild(chip);
  });
  search.value = '';
  roleSel.value = '';
  typeSel.value = '';
  search.oninput = () => {
    state.query = search.value.toLowerCase();
    renderAll();
  };
  roleSel.onchange = () => {
    state.role = roleSel.value;
    renderAll();
  };
  typeSel.onchange = () => {
    state.type = typeSel.value;
    renderAll();
  };
}

function matchesFilters(entry) {
  if (!state.activeTeams.has(entry.team)) return false;
  if (state.role && entry.role !== state.role) return false;
  if (state.type && entry.type !== state.type) return false;
  if (state.week && !entry.weeks[state.week]) return false;
  if (state.query) {
    const hay = `${entry.task} ${entry.resource} ${entry.ticket} ${entry.role} ${entry.type}`.toLowerCase();
    if (!hay.includes(state.query)) return false;
  }
  return Object.keys(entry.weeks || {}).length > 0;
}

function filterEntries() {
  const entries = state.data.entries.filter(matchesFilters);
  const col = state.sort.col;
  if (!col) return entries;
  return [...entries].sort((a, b) => {
    const av = (a[col] || '').toString();
    const bv = (b[col] || '').toString();
    return state.sort.asc ? av.localeCompare(bv, 'ru') : bv.localeCompare(av, 'ru');
  });
}

function isConflictWeekRole(weekIso, role) {
  return state.data.conflicts.some((conflict) => conflict.week === weekIso && conflict.role === role);
}

function visibleCapacity() {
  const weeks = state.week ? state.data.weeks.filter((week) => week.iso === state.week) : state.data.weeks;
  const entries = state.data.entries.filter((entry) => {
    if (state.role && entry.role !== state.role) return false;
    if (state.type && entry.type !== state.type) return false;
    if (state.query) {
      const hay = `${entry.task} ${entry.resource} ${entry.ticket} ${entry.role} ${entry.type}`.toLowerCase();
      if (!hay.includes(state.query)) return false;
    }
    return Object.keys(entry.weeks || {}).length > 0;
  });
  return rolePersonDays(
    { weeks, entries, roster: state.roster },
    { teams: [...state.activeTeams] }
  );
}

function signedDays(value) {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return formatNumber(value);
  return '0';
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '∞';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function formatFte(value) {
  return formatNumber(value);
}

function formatLoad(load) {
  if (!Number.isFinite(load)) return '∞';
  return `${Math.round(load * 100)}%`;
}

function renderStats() {
  const active = state.data.entries.filter((entry) => Object.keys(entry.weeks || {}).length > 0);
  const visible = filterEntries();
  document.getElementById('stats').innerHTML = [
    ['Строк в плане', visible.length, `из ${active.length}`],
    ['Пересечений', state.data.conflicts.length, 'роль × неделя'],
    ['Недель', state.data.weeks.length, state.data.weeks[0]?.label + ' — ' + state.data.weeks.at(-1)?.label],
    ['Команд', state.teamKeys.length, 'в выбранном таймлайне'],
    ['Ролей в дефиците', visibleCapacity().rows.filter((row) => row.balance < 0).length, `штат × ${WORK_DAYS_PER_MONTH} дн./мес.`],
  ].map(([label, value, hint]) => `
    <article class="stat">
      <div class="val">${esc(value)}</div>
      <div class="lbl">${esc(label)}</div>
      <div class="muted">${esc(hint || '')}</div>
    </article>
  `).join('');
}

function renderHeatmap() {
  const current = currentWeekIso(state.data.weeks);
  document.getElementById('heatmap').innerHTML = state.data.weekly.map((week) => {
    const hot = week.conflicts.length >= 4;
    const warm = week.conflicts.length >= 1 && !hot;
    const on = state.week === week.week ? 'on' : '';
    const now = week.week === current ? 'current' : '';
    const cls = ['heat-cell', hot ? 'hot' : '', warm ? 'warm' : '', on, now].filter(Boolean).join(' ');
    return `<button class="${cls}" data-week="${week.week}">
      <div class="w">${esc(week.weekLabel)}</div>
      <div class="n">${week.total}</div>
      <div class="w">${week.conflicts.length ? week.conflicts.length + ' пересеч.' : 'без пересечений'}</div>
    </button>`;
  }).join('');
  document.querySelectorAll('#heatmap [data-week]').forEach((btn) => {
    btn.onclick = () => {
      state.week = state.week === btn.dataset.week ? '' : btn.dataset.week;
      renderAll();
    };
  });
}

function bindSort(selector, rerender) {
  document.querySelectorAll(`${selector} th[data-col]`).forEach((th) => {
    th.onclick = () => {
      const col = th.dataset.col;
      if (state.sort.col === col) state.sort.asc = !state.sort.asc;
      else {
        state.sort.col = col;
        state.sort.asc = true;
      }
      rerender();
    };
  });
}

function renderGantt() {
  const entries = filterEntries();
  const current = currentWeekIso(state.data.weeks);
  const thead = document.querySelector('#ganttTable thead');
  const tbody = document.querySelector('#ganttTable tbody');
  const weekHeaders = state.data.weeks.map((week) => {
    const cls = week.iso === current ? 'current-week' : '';
    return `<th class="${cls}">${esc(week.label)}</th>`;
  }).join('');
  thead.innerHTML = `<tr>
    <th class="sticky-col col-team" data-col="team">Команда</th>
    <th class="sticky-col col-task" data-col="task">Задача</th>
    <th data-col="resource">Ресурс</th>
    <th data-col="role">Роль</th>
    <th data-col="ticket">Тикет</th>
    ${weekHeaders}
  </tr>`;

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="${5 + state.data.weeks.length}" class="empty">Нет данных по фильтрам</td></tr>`;
    return;
  }

  tbody.innerHTML = entries.map((entry) => {
    const cfg = state.data.teams[entry.team];
    const cells = state.data.weeks.map((week) => {
      const value = entry.weeks[week.iso];
      const currentCls = week.iso === current ? 'current-week' : '';
      if (!value) return `<td class="week-cell ${currentCls}"></td>`;
      const shown = weekCellLabel(value);
      const vacation = isVacation(value);
      const conflict = isConflictWeekRole(week.iso, entry.role);
      const cls = [
        'week-cell',
        'filled',
        vacation ? 'vacation' : '',
        !vacation && conflict ? 'conflict' : '',
        currentCls,
      ].filter(Boolean).join(' ');
      const bg = vacation || conflict ? '' : `background:${cfg.color};color:#fff;`;
      const title = vacation ? 'отпуск' : `${shown} дн.`;
      return `<td class="${cls}" style="${bg}" title="${esc(title)}">${esc(shown)}</td>`;
    }).join('');
    return `<tr>
      <td class="sticky-col col-team">${teamBadge(entry.team)}</td>
      <td class="sticky-col col-task task-cell">${esc(entry.task)}</td>
      <td>${esc(entry.resource)}</td>
      <td>${esc(entry.role)}</td>
      <td>${esc(entry.ticket)}</td>
      ${cells}
    </tr>`;
  }).join('');

  bindSort('#ganttTable', renderGantt);
}

function renderConflicts() {
  const rows = state.data.conflicts.filter((conflict) => {
    if (state.role && conflict.role !== state.role) return false;
    if (state.week && conflict.week !== state.week) return false;
    const teamMatch = conflict.teams.some((full) => {
      const key = Object.entries(state.data.teams).find(([, cfg]) => cfg.full === full)?.[0];
      return key && state.activeTeams.has(key);
    });
    if (!teamMatch) return false;
    if (state.query && !(conflict.role + conflict.teams.join() + conflict.tasks.join()).toLowerCase().includes(state.query)) {
      return false;
    }
    return true;
  });

  const thead = document.querySelector('#conflictsTable thead');
  const tbody = document.querySelector('#conflictsTable tbody');
  thead.innerHTML = '<tr><th>Неделя</th><th>Роль</th><th>Команды</th><th>Задачи</th></tr>';
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Нет пересечений по фильтрам</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((conflict) => `<tr class="conflict-row">
    <td>${esc(conflict.weekLabel)}</td>
    <td><strong>${esc(conflict.role)}</strong></td>
    <td>${conflict.teams.map(badgeByFullName).join(' ')}</td>
    <td><div class="conflict-tasks">${conflict.tasks.map(esc).join('<br>')}</div></td>
  </tr>`).join('');
}

function renderWeekly() {
  const thead = document.querySelector('#weeklyTable thead');
  const tbody = document.querySelector('#weeklyTable tbody');
  const teamHeaders = state.teamKeys.map((key) => `<th>${esc(state.data.teams[key].full)}</th>`).join('');
  thead.innerHTML = `<tr><th>Неделя</th><th>Всего</th>${teamHeaders}<th>Команды</th><th>Конфликты</th></tr>`;
  const rows = state.data.weekly.filter((week) => !state.week || week.week === state.week);
  tbody.innerHTML = rows.map((week) => {
    const hasConflict = week.conflicts.length > 0;
    const multiTeam = week.activeTeams.length >= 2;
    const cls = hasConflict ? 'conflict-row' : (multiTeam ? 'multi-row' : '');
    const conflicts = week.conflicts.map((item) => `${item.role} (${item.teams.join('+')})`).join('; ');
    const teamCells = state.teamKeys.map((key) => {
      const name = state.data.teams[key].full;
      return `<td>${week.counts[name] ?? week.counts[key] ?? 0}</td>`;
    }).join('');
    return `<tr class="${cls}">
      <td>${esc(week.weekLabel)}</td>
      <td><strong>${week.total}</strong></td>
      ${teamCells}
      <td>${esc(week.activeTeams.join(', '))}</td>
      <td style="color:var(--danger)">${esc(conflicts)}</td>
    </tr>`;
  }).join('');
}

function renderRoles() {
  const matrix = roleMatrix(state.data).filter((row) => !state.role || row.role === state.role);
  const current = currentWeekIso(state.data.weeks);
  const thead = document.querySelector('#rolesTable thead');
  const tbody = document.querySelector('#rolesTable tbody');
  thead.innerHTML = `<tr><th>Роль</th>${state.data.weeks.map((week) =>
    `<th class="${week.iso === current ? 'current-week' : ''}">${esc(week.label)}</th>`
  ).join('')}</tr>`;
  tbody.innerHTML = matrix.map((row) => {
    const cells = row.cells.map((cell) => {
      const count = cell.teams.length;
      const cls = count >= 2 ? 'role-cell conflict' : (count === 1 ? 'role-cell one' : 'role-cell');
      const title = count ? `${cell.teams.join(', ')} · занято ${cell.busy}` : 'нет загрузки';
      return `<td class="${cls}${cell.week === current ? ' current-week' : ''}" title="${esc(title)}">${count || ''}</td>`;
    }).join('');
    return `<tr><td><strong>${esc(row.role || '—')}</strong></td>${cells}</tr>`;
  }).join('');
}

function renderCapacity() {
  const data = visibleCapacity();
  const note = document.getElementById('capacityNote');
  note.textContent = `Ёмкость = штат × ${WORK_DAYS_PER_MONTH} раб. дня в месяц. Баланс = ёмкость − человеко-дни из плана. Фикса = Домашний интернет, Репрайсы = Монетизация. Совмещённые (Судариков, Фёдорова) считаются один раз. Монетизация без дизайнера: спрос идёт в дефицит. Контент в штате нет.`;
  const thead = document.querySelector('#capacityTable thead');
  const tbody = document.querySelector('#capacityTable tbody');
  const monthHeaders = data.months.map((month) => `<th>${esc(formatMonthLabel(month))}</th>`).join('');
  thead.innerHTML = `<tr>
    <th>Специальность</th>
    <th>FTE есть</th>
    <th>FTE нужно</th>
    <th>Чел.-дни</th>
    <th>Ёмкость</th>
    <th>Баланс</th>
    <th>Загрузка</th>
    ${monthHeaders}
  </tr>`;
  if (!data.rows.length) {
    tbody.innerHTML = `<tr><td colspan="${7 + data.months.length}" class="empty">Нет данных по фильтрам</td></tr>`;
    return;
  }
  tbody.innerHTML = data.rows.map((row) => {
    const monthCells = data.months.map((month) => {
      const cell = row.months[month];
      const cls = cell.balance < 0 ? 'deficit' : (cell.days ? 'surplus' : '');
      const title = `${cell.days} чел.-дн. · ${formatFte(cell.fte)} FTE · ёмкость ${formatNumber(cell.capacity)} · нужно ${formatFte(cell.neededFte)} · ${signedDays(cell.balance)}`;
      return `<td class="${cls}" title="${esc(title)}">${cell.days ? `${formatNumber(cell.days)} / ${signedDays(cell.balance)}` : '—'}</td>`;
    }).join('');
    const rowCls = row.balance < 0 ? 'deficit-row' : '';
    const names = (row.names || []).join(', ') || 'нет в штате';
    return `<tr class="${rowCls}">
      <td><strong title="${esc(names)}">${esc(row.role)}</strong></td>
      <td title="${esc(names)}">${esc(formatFte(row.fte))}</td>
      <td>${esc(formatFte(row.neededFte))}</td>
      <td>${esc(formatNumber(row.days))}</td>
      <td>${esc(formatNumber(row.capacity))}</td>
      <td class="${row.balance < 0 ? 'deficit' : 'surplus'}"><strong>${esc(signedDays(row.balance))}</strong> ${esc(row.status)}</td>
      <td>${esc(formatLoad(row.load))}</td>
      ${monthCells}
    </tr>`;
  }).join('');
}

function renderAll() {
  renderTimelineSwitch();
  renderStats();
  renderHeatmap();
  renderGantt();
  renderConflicts();
  renderWeekly();
  renderRoles();
  renderCapacity();
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.onclick = () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    };
  });
}

async function boot() {
  try {
    const defaultId = await loadCatalog();
    await loadRoster();
    const requested = new URLSearchParams(window.location.search).get('timeline');
    await loadTimeline(requested || defaultId);
    bindTabs();
    bindStaticControls();
    renderAll();
  } catch (err) {
    document.querySelector('.layout').innerHTML = `<div class="error-box">
      <h2>Не удалось загрузить данные</h2>
      <p>Запустите локальный сервер в корне репозитория:</p>
      <p><code>python3 -m http.server 8080</code></p>
      <p>${esc(err.message)}</p>
    </div>`;
  }
}

boot();
