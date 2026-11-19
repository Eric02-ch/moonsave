import {dashboardEntries,accountSummary,missingItems,periodComparison} from './dashboard.js';

export function feedbackContext(state,entryId,includeNotes=false) {
  const all=dashboardEntries(state),selected=all.find(e=>e.id===entryId);
  if(!selected)throw new Error('找不到這筆回報，請重新選擇。');
  const entries=all.filter(e=>e.date<=selected.date&&e.id!==entryId).slice(-2).concat(selected);
  return {
    version:1,currency:'TWD',selectedId:entryId,
    goal:{name:state.settings.goalName,amount:state.settings.goalAmount,accountId:state.settings.goalAccount},
    entries:entries.map(e=>{
      const summary=accountSummary(e),account=e.accounts.find(a=>a.id===state.settings.goalAccount&&a.kind!=='credit');
      return {id:e.id,month:e.month,observationDate:e.date,status:e.status,timing:e.timing,
        income:e.income,expense:e.expense,expenseSource:e.expenseSource,
        surplus:e.income==null||e.expense==null?null:e.income-e.expense,
        knownAssetSubtotal:summary.assetSubtotal,knownDebtSubtotal:summary.debtSubtotal,accountNet:summary.net,
        accounts:e.accounts.map(a=>({id:a.id,name:a.name,kind:a.kind,balance:a.balance})),
        goalBalance:account?.balance??null,goalProgress:account?.balance==null?null:account.balance/state.settings.goalAmount,
        missing:missingItems(e),comparison:e.type==='report'?periodComparison(e.record,state.reports):null,
        nextAction:e.record.action||null,
        ...(includeNotes?{note:e.note.slice(0,1000)}:{}),
      };
    }),
    includesNotes:includeNotes,
  };
}
export async function contextDigest(context,cryptoImpl=globalThis.crypto) {
  const digest=await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(context)));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
