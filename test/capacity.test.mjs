import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  occupancyDays,
  weekMonthKey,
  WORK_DAYS_PER_MONTH,
  rolePersonDays,
} from '../process.js';

test('occupancyDays reads week cell day counts and ignores vacation', () => {
  assert.equal(occupancyDays('5'), 5);
  assert.equal(occupancyDays('2'), 2);
  assert.equal(occupancyDays('отпуск'), 0);
  assert.equal(occupancyDays('отпуск Лера'), 0);
  assert.equal(occupancyDays('3 на ресайзы'), 3);
  assert.equal(occupancyDays('FE'), 1);
  assert.equal(occupancyDays(''), 0);
});

test('weekMonthKey uses the Wednesday of the ISO week', () => {
  assert.equal(weekMonthKey('2026-08-03'), '2026-08');
  assert.equal(weekMonthKey('2026-08-31'), '2026-09');
  assert.equal(weekMonthKey('2026-06-29'), '2026-07');
});

const megaDesignRoster = {
  people: [
    {
      id: 'lera',
      name: 'Лера',
      role: 'Дизайн',
      allocations: [{ team: 'МегаИнтернет', fte: 1 }],
    },
    {
      id: 'vikulin',
      name: 'Викулин Виталий',
      role: 'FE',
      allocations: [{ team: 'МегаИнтернет', fte: 1 }],
    },
  ],
};

test('rolePersonDays uses roster FTE × 22, not unique gantt labels', () => {
  assert.equal(WORK_DAYS_PER_MONTH, 22);
  const result = rolePersonDays({
    weeks: [
      { iso: '2026-08-03', label: '03.08' },
      { iso: '2026-08-10', label: '10.08' },
    ],
    entries: [
      {
        team: 'МегаИнтернет',
        task: '5G кино',
        resource: 'Лера (диз)',
        role: 'Дизайн',
        weeks: { '2026-08-03': '2', '2026-08-10': '5' },
      },
      {
        team: 'МегаИнтернет',
        task: '5G кино',
        resource: 'FE',
        role: 'FE',
        weeks: { '2026-08-10': '5' },
      },
    ],
    roster: megaDesignRoster,
  });

  const design = result.rows.find((row) => row.role === 'Дизайн');
  assert.equal(design.fte, 1);
  assert.equal(design.people, 1);
  assert.equal(design.days, 7);
  assert.equal(design.capacity, 22);
  assert.equal(design.balance, 15);
  assert.equal(design.neededFte, 7 / 22);
  assert.equal(design.months['2026-08'].days, 7);
  assert.equal(design.months['2026-08'].balance, 15);

  const fe = result.rows.find((row) => row.role === 'FE');
  assert.equal(fe.fte, 1);
  assert.equal(fe.days, 5);
  assert.equal(fe.balance, 17);
});

test('rolePersonDays does not treat gantt names as headcount', () => {
  const roster = {
    people: [
      { id: 'anton', name: 'Антон', role: 'Дизайн', allocations: [{ team: 'Тарифы', fte: 1 }] },
      { id: 'egor', name: 'Егор', role: 'Дизайн', allocations: [{ team: 'ДИ', fte: 1 }] },
      { id: 'nastya', name: 'Настя', role: 'Дизайн', allocations: [{ team: 'ДГП', fte: 1 }] },
      { id: 'lera', name: 'Лера', role: 'Дизайн', allocations: [{ team: 'МегаИнтернет', fte: 1 }] },
      { id: 'stas', name: 'Стас', role: 'Дизайн', allocations: [{ team: 'МегаИнтернет', fte: 1 }] },
    ],
  };
  const result = rolePersonDays({
    weeks: [{ iso: '2026-08-03', label: '03.08' }],
    entries: [
      { team: 'Тарифы', task: 'A', resource: 'Калинкин', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
      { team: 'Тарифы', task: 'B', resource: 'Юрасов', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
      { team: 'ДИ', task: 'C', resource: 'DUX', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
      { team: 'ДГП', task: 'D', resource: 'Настя', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
      { team: 'МегаИнтернет', task: 'E', resource: 'Лера (диз)', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
      { team: 'МегаИнтернет', task: 'F', resource: 'Стас (диз)', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
      { team: 'Монетизация', task: 'G', resource: 'дизайн', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
    ],
    roster,
  });
  const design = result.rows.find((row) => row.role === 'Дизайн');
  assert.equal(design.fte, 5);
  assert.equal(design.people, 5);
  assert.equal(design.days, 35);
  assert.equal(design.capacity, 110);
  assert.equal(design.balance, 75);
});

test('Монетизация has design backlog and zero designers → deficit', () => {
  const roster = {
    people: [
      { id: 'anton', name: 'Антон', role: 'Дизайн', allocations: [{ team: 'Тарифы', fte: 1 }] },
    ],
  };
  const result = rolePersonDays({
    weeks: [{ iso: '2026-08-03', label: '03.08' }],
    entries: [
      { team: 'Монетизация', task: 'Орига', resource: 'дизайн', role: 'Дизайн', weeks: { '2026-08-03': '5' } },
    ],
    roster,
  }, { teams: ['Монетизация'] });
  const design = result.rows.find((row) => row.role === 'Дизайн');
  assert.equal(design.fte, 0);
  assert.equal(design.people, 0);
  assert.equal(design.days, 5);
  assert.equal(design.capacity, 0);
  assert.equal(design.balance, -5);
  assert.equal(design.status, 'дефицит');
});

test('shared BE counts once globally and 0.5 FTE per team', () => {
  const roster = {
    people: [
      {
        id: '17001591',
        name: 'Судариков Алексей Александрович',
        role: 'BE',
        allocations: [
          { team: 'Монетизация', fte: 0.5 },
          { team: 'ДИ', fte: 0.5 },
        ],
      },
    ],
  };
  const entries = [
    { team: 'Монетизация', task: 'A', resource: 'бэк', role: 'BE', weeks: { '2026-08-03': '10' } },
    { team: 'ДИ', task: 'B', resource: 'BE', role: 'BE', weeks: { '2026-08-03': '10' } },
  ];
  const weeks = [{ iso: '2026-08-03', label: '03.08' }];

  const all = rolePersonDays({ weeks, entries, roster });
  const beAll = all.rows.find((row) => row.role === 'BE');
  assert.equal(beAll.fte, 1);
  assert.equal(beAll.people, 1);
  assert.equal(beAll.days, 20);
  assert.equal(beAll.capacity, 22);
  assert.equal(beAll.balance, 2);

  const monetization = rolePersonDays({ weeks, entries, roster }, { teams: ['Монетизация'] });
  const beMon = monetization.rows.find((row) => row.role === 'BE');
  assert.equal(beMon.fte, 0.5);
  assert.equal(beMon.people, 1);
  assert.equal(beMon.days, 10);
  assert.equal(beMon.capacity, 11);
  assert.equal(beMon.balance, 1);
});

test('rolePersonDays treats потребность and missing roster roles as demand without headcount', () => {
  const result = rolePersonDays({
    weeks: [{ iso: '2026-08-03', label: '03.08' }],
    entries: [
      {
        team: 'Тарифы',
        task: 'Карточка',
        resource: 'Потребность front ЦКО',
        role: 'FE',
        weeks: { '2026-08-03': '5' },
      },
      {
        team: 'Тарифы',
        task: 'Тарифный план',
        resource: 'Крымов',
        role: 'Контент',
        weeks: { '2026-08-03': '4' },
      },
    ],
    roster: { people: [] },
  });
  const fe = result.rows.find((row) => row.role === 'FE');
  assert.equal(fe.fte, 0);
  assert.equal(fe.people, 0);
  assert.equal(fe.days, 5);
  assert.equal(fe.capacity, 0);
  assert.equal(fe.balance, -5);

  const content = result.rows.find((row) => row.role === 'Контент');
  assert.equal(content.fte, 0);
  assert.equal(content.days, 4);
  assert.equal(content.capacity, 0);
  assert.equal(content.status, 'дефицит');
});

test('rolePersonDays flags monthly deficit when load exceeds roster × 22', () => {
  const result = rolePersonDays({
    weeks: [
      { iso: '2026-08-03', label: '03.08' },
      { iso: '2026-08-10', label: '10.08' },
      { iso: '2026-08-17', label: '17.08' },
      { iso: '2026-08-24', label: '24.08' },
    ],
    entries: [
      {
        team: 'ДИ',
        task: 'FMC',
        resource: 'QA',
        role: 'QA',
        weeks: {
          '2026-08-03': '5',
          '2026-08-10': '5',
          '2026-08-17': '5',
          '2026-08-24': '8',
        },
      },
    ],
    roster: {
      people: [
        { id: '17000142', name: 'Комаров Илья', role: 'QA', allocations: [{ team: 'ДИ', fte: 1 }] },
      ],
    },
  });
  const qa = result.rows.find((row) => row.role === 'QA');
  assert.equal(qa.days, 23);
  assert.equal(qa.fte, 1);
  assert.equal(qa.capacity, 22);
  assert.equal(qa.balance, -1);
  assert.equal(qa.status, 'дефицит');
});

test('h2 roster: 5 designers, shared BE once, Monetization design is pure deficit', () => {
  const roster = JSON.parse(readFileSync(new URL('../roster.json', import.meta.url), 'utf8'));
  const raw = JSON.parse(readFileSync(new URL('../data-h2-2026.json', import.meta.url), 'utf8'));
  const all = rolePersonDays({ weeks: raw.weeks, entries: raw.entries, roster });

  const design = all.rows.find((row) => row.role === 'Дизайн');
  assert.equal(design.fte, 5);
  assert.equal(design.people, 5);
  assert.equal(design.months['2026-08'].capacity, 110);
  assert.ok(design.months['2026-08'].days > 110, `august design demand ${design.months['2026-08'].days}`);
  assert.equal(design.months['2026-08'].status, 'дефицит');

  const be = all.rows.find((row) => row.role === 'BE');
  assert.equal(be.fte, 4);
  assert.equal(be.people, 4);

  const sa = all.rows.find((row) => row.role === 'SA');
  assert.equal(sa.fte, 6);
  const fe = all.rows.find((row) => row.role === 'FE');
  assert.equal(fe.fte, 6);
  const qa = all.rows.find((row) => row.role === 'QA');
  assert.equal(qa.fte, 6);

  const content = all.rows.find((row) => row.role === 'Контент');
  assert.equal(content.fte, 0);
  assert.ok(content.days > 0);
  assert.equal(content.status, 'дефицит');

  const monetization = rolePersonDays(
    { weeks: raw.weeks, entries: raw.entries, roster },
    { teams: ['Репрайсы'] }
  );
  const monDesign = monetization.rows.find((row) => row.role === 'Дизайн');
  assert.equal(monDesign.fte, 0);
  assert.ok(monDesign.days > 0);
  assert.equal(monDesign.status, 'дефицит');
  const monBe = monetization.rows.find((row) => row.role === 'BE');
  assert.equal(monBe.fte, 0.5);

  const di = rolePersonDays(
    { weeks: raw.weeks, entries: raw.entries, roster },
    { teams: ['Фикса'] }
  );
  const diBe = di.rows.find((row) => row.role === 'BE');
  assert.equal(diBe.fte, 0.5);
  const diDesign = di.rows.find((row) => row.role === 'Дизайн');
  assert.equal(diDesign.fte, 1);
});

