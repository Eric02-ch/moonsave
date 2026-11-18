import test from 'node:test';
import assert from 'node:assert/strict';
import { metrics, comparison, previousMonth, validateReport, validateBackup, validateDraft, validateSettings, defaultSettings, makeDemo, localInsights } from '../public/core.js';

const report = () => ({ ...makeDemo()[0], month: '2026-10', asOf: '2026-10-10' });
test('帳戶間轉帳不增加現金淨額', () => {
  const a = report(), b = { ...a, main: a.main - 1000, emergency: a.emergency + 1000 };
  assert.equal(metrics(a).netCash, metrics(b).netCash);
  assert.equal(metrics(a).netSaved, metrics(b).netSaved);
});
test('信用卡預留款不重複增加資產，欠款扣除一次', () => {
  const r = { ...report(), main: 10000, emergency: 30000, bills: 8000, cardReserve: 5000, cardDebt: 6000, wallet: 1000 };
  assert.equal(metrics(r).cashAssets, 54000);
  assert.equal(metrics(r).netCash, 48000);
  assert.equal(metrics(r).cardGap, 1000);
  assert.equal(metrics(r).available, 10000);
  const paid = { ...r, cardReserve: 0, cardDebt: 1000 };
  assert.equal(metrics(paid).netCash, metrics(r).netCash);
});
test('扣除儲蓄提領，可以為負；零收入無儲蓄率', () => {
  const m = metrics({ ...report(), salary: 0, otherIncome: 0, saved: 3000, extraSaved: 0, withdrawn: 4000 });
  assert.equal(m.netSaved, -1000); assert.equal(m.savingsRate, null);
});
test('完整回報有效，未確認、缺欄位、負數、小數或非有限數值拒絕', () => {
  assert.equal(validateReport(report()).month, '2026-10');
  for (const r of [{ ...report(), confirmed: false }, { ...report(), main: undefined }, { ...report(), main: -1 }, { ...report(), main: 1.5 }, { ...report(), main: Infinity }, { ...report(), note: 'a'.repeat(1001) }]) assert.throws(() => validateReport(r));
});
test('拒絕不存在的日期與錯誤月份', () => {
  for (const asOf of ['2026-02-30', '2026-13-01', 'hello']) assert.throws(() => validateReport({ ...report(), asOf }));
  assert.throws(() => validateReport({ ...report(), month: '2026-13' }));
});
test('跨年度前月，無上月資料不比較，相異盤點日明確標記', () => {
  assert.equal(previousMonth('2026-01'), '2025-12');
  const r = report(); assert.equal(comparison(r, [], defaultSettings), null);
  assert.equal(comparison(r, [{ ...r, month: '2026-09', asOf: '2026-09-11' }], defaultSettings).sameDay, false);
});
test('備份驗證拒絕重複月份、超量資料與錯誤設定', () => {
  assert.equal(validateBackup({ version: 1, settings: defaultSettings, reports: [report()] }).reports.length, 1);
  assert.throws(() => validateBackup({ version: 1, settings: defaultSettings, reports: [report(), report()] }));
  assert.throws(() => validateBackup({ version: 1, settings: defaultSettings, reports: Array(601).fill(report()) }));
  assert.throws(() => validateSettings({ ...defaultSettings, emergencyGoal: 100 }));
  assert.throws(() => validateSettings({ ...defaultSettings, monthlyGoal: 0 }));
});
test('本機月報資料不足不推算；建議最多三項', () => {
  const r = { ...report(), main: 0, wallet: 0, cardReserve: 0, cardDebt: 20000, emergency: 0, withdrawn: 1000 };
  const result = localInsights(r, [r], defaultSettings);
  assert.equal(result.actions.length, 3);
  assert.match(result.observations[2], /還沒有上個月/);
});
test('含草稿備份保留未知數字，不把目標或空白變成已確認儲蓄', () => {
  const draft = { ...report(), saved: null, extraSaved: '', wallet: undefined, confirmed: false };
  const backup = validateBackup({ version: 1, settings: defaultSettings, reports: [], draft });
  assert.equal(backup.draft.saved, null); assert.equal(backup.draft.extraSaved, null); assert.equal(backup.draft.wallet, null); assert.equal(backup.draft.confirmed, false);
  assert.throws(() => validateReport(backup.draft));
  assert.throws(() => validateDraft({ ...draft, emergency: -1 }));
});
