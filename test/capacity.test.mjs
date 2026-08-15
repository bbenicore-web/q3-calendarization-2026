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

test('rolePersonDays uses 22 working days per person-month', () => {
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
  });

  const design = result.rows.find((row) => row.role === 'Дизайн');
  assert.equal(design.people, 1);
  assert.equal(design.days, 7);
  assert.equal(design.capacity, 22);
  assert.equal(design.balance, 15);
  assert.equal(design.months['2026-08'].days, 7);
  assert.equal(design.months['2026-08'].balance, 15);

  const fe = result.rows.find((row) => row.role === 'FE');
  assert.equal(fe.people, 1);
  assert.equal(fe.days, 5);
  assert.equal(fe.balance, 17);
});

test('rolePersonDays treats потребность as demand without headcount', () => {
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
    ],
  });
  const fe = result.rows.find((row) => row.role === 'FE');
  assert.equal(fe.people, 0);
  assert.equal(fe.days, 5);
  assert.equal(fe.capacity, 0);
  assert.equal(fe.balance, -5);
});

test('rolePersonDays flags monthly deficit when load exceeds 22 days', () => {
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
  });
  const qa = result.rows.find((row) => row.role === 'QA');
  assert.equal(qa.days, 23);
  assert.equal(qa.capacity, 22);
  assert.equal(qa.balance, -1);
  assert.equal(qa.status, 'дефицит');
});
