export const moneyKeys = ['salary', 'otherIncome', 'main', 'emergency', 'bills', 'cardReserve', 'cardDebt', 'wallet', 'saved', 'extraSaved', 'withdrawn'];
export const defaultSettings = { monthlyGoal: 3000, emergencyFloor: 30000, emergencyGoal: 50000 };
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const formatMoney = n => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);
export function validateReport(r) {
  if (!r || typeof r !== 'object' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) throw new Error('請選擇有效的回報月份。');
  if (typeof r.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.asOf) || Number.isNaN(Date.parse(r.asOf)) || new Date(r.asOf).toISOString().slice(0, 10) !== r.asOf) throw new Error('請填入有效的盤點日期。');
  const clean = { month: r.month, asOf: r.asOf };
  for (const key of moneyKeys) {
    if (typeof r[key] !== 'number' || !Number.isSafeInteger(r[key]) || r[key] < 0 || r[key] > 100000000) throw new Error('金額須為 0～100,000,000 的整數，所有欄位都要確認。');
    clean[key] = r[key];
  }
  if (typeof r.note !== 'string' || r.note.length > 1000) throw new Error('備註最多 1,000 字。');
  if (r.confirmed !== true) throw new Error('請確認所有餘額都是本次盤點的實際數字。');
  return { ...clean, note: r.note, confirmed: true };
}
export function validateSettings(s) {
  if (!s || typeof s !== 'object') throw new Error('目標設定格式錯誤。');
  const clean = {};
  for (const key of Object.keys(defaultSettings)) {
    if (!Number.isSafeInteger(s[key]) || s[key] <= 0 || s[key] > 100000000) throw new Error('目標須為正整數。');
    clean[key] = s[key];
  }
  if (clean.emergencyFloor > clean.emergencyGoal) throw new Error('備用金目標不能低於底線。');
  return clean;
}
export function validateBackup(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.reports) || data.reports.length > 600) throw new Error('備份格式不正確，或超過 600 個月。');
  const settings = validateSettings(data.settings);
  const reports = data.reports.map(validateReport);
  if (new Set(reports.map(r => r.month)).size !== reports.length) throw new Error('備份包含重複月份。');
  return { version: 1, settings, reports, ...(data.draft == null ? {} : { draft: validateDraft(data.draft) }) };
}
export function validateDraft(r) {
  if (!r || typeof r !== 'object' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) throw new Error('草稿月份格式錯誤。');
  const candidate = { ...r, confirmed: true };
  for (const key of moneyKeys) if (r[key] === null || r[key] === '' || r[key] === undefined) candidate[key] = 0;
  const clean = validateReport(candidate);
  for (const key of moneyKeys) if (r[key] === null || r[key] === '' || r[key] === undefined) clean[key] = null;
  return { ...clean, confirmed: false };
}
export const sortReports = reports => [...reports].sort((a, b) => a.month.localeCompare(b.month));
export function metrics(r, settings = defaultSettings) {
  const income = r.salary + r.otherIncome;
  const netSaved = r.saved + r.extraSaved - r.withdrawn;
  const cardGap = Math.max(0, r.cardDebt - r.cardReserve);
  const cashAssets = r.main + r.emergency + r.bills + r.cardReserve + r.wallet;
  return {
    income, netSaved, savingsRate: income > 0 ? netSaved / income : null,
    cardGap, cashAssets, netCash: cashAssets - r.cardDebt,
    available: r.main + r.wallet - cardGap,
    goalProgress: r.emergency / settings.emergencyGoal,
    monthlyProgress: netSaved / settings.monthlyGoal
  };
}
export function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
export function comparison(current, reports, settings) {
  const prev = reports.find(r => r.month === previousMonth(current.month));
  if (!prev) return null;
  const a = metrics(current, settings), b = metrics(prev, settings);
  return { savingsDelta: a.netSaved - b.netSaved, emergencyDelta: current.emergency - prev.emergency, netCashDelta: a.netCash - b.netCash, sameDay: current.asOf.slice(8) === prev.asOf.slice(8) };
}
export function localInsights(r, reports, settings) {
  const m = metrics(r, settings), c = comparison(r, reports, settings);
  const observations = [
    `本月回報淨儲蓄 ${formatMoney(m.netSaved)}${m.savingsRate === null ? '；本月收入為 0，不計算儲蓄率。' : `，佔實際收入 ${(m.savingsRate * 100).toFixed(1)}%。`}`,
    `備用金 ${formatMoney(r.emergency)}，距離目標還有 ${formatMoney(Math.max(0, settings.emergencyGoal - r.emergency))}。`,
    c ? `與上月相比，回報淨儲蓄${c.savingsDelta >= 0 ? '增加' : '減少'} ${formatMoney(Math.abs(c.savingsDelta))}。${c.sameDay ? '即使盤點日相同，也需留意入帳與帳期差異。' : '兩次盤點日不同，餘額變化不宜直接解讀為儲蓄成果。'}` : '還沒有上個月的回報；累積紀錄後會顯示比較。'
  ];
  const actions = [];
  if (m.cardGap) actions.push(`核對信用卡預留缺口 ${formatMoney(m.cardGap)} 與繳款日期。`);
  if (m.available < 0) actions.push('目前可用資金估算為負，先核對近期必要支出與資金安排。');
  if (r.withdrawn > 0) actions.push('為本月儲蓄提領補上原因，方便區分一次性支出與持續性缺口。');
  if (r.emergency < settings.emergencyFloor) actions.push('備用金低於自己設定的底線，檢查下月可行的補回安排。');
  if (!actions.length) actions.push('下月在相近的盤點時間更新數字，持續觀察真正留下的儲蓄。');
  return { observations, actions: actions.slice(0, 3) };
}
export function makeDemo() {
  const month = today().slice(0, 7);
  const months = [previousMonth(previousMonth(month)), previousMonth(month), month];
  return months.map((month, i) => ({ month, asOf: `${month}-10`, salary: 42000, otherIncome: i === 2 ? 2000 : 0, main: 12000 + i * 1000, emergency: 24000 + i * 4000, bills: 10000, cardReserve: 6000, cardDebt: i === 1 ? 6500 : 5500, wallet: 800, saved: 3000, extraSaved: i === 2 ? 2000 : 1000, withdrawn: i === 1 ? 1000 : 0, note: '虛構示範資料，可自由修改。', confirmed: true }));
}
