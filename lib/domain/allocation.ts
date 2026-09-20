export const policies = ['urgency', 'proportional', 'minimum', 'manual'] as const;
export type Policy = typeof policies[number];
export type AllocationNeed = { id: string; area: string; demand: number; priority: number; confirmedAt: string; target?: number; received?: number; total?: number };
export type AllocationOptions = { targets?: Record<string, number>; manual?: Record<string, number> };
export function quantity(value: number, allowZero = true): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1_000_000) throw new Error('Quantity must be a whole number between ' + (allowZero ? '0' : '1') + ' and 1,000,000.');
  return value;
}
function distribute(needs: AllocationNeed[], supply: number, demand: (n: AllocationNeed) => number): Record<string, number> {
  const total = needs.reduce((s,n) => s + demand(n), 0), used = Math.min(total, supply);
  const rows = needs.map(n => { const exact = total ? used * demand(n) / total : 0; return { id:n.id, q:Math.floor(exact), fraction:exact % 1 }; });
  let remaining = used - rows.reduce((s,r) => s+r.q,0);
  rows.sort((a,b) => b.fraction-a.fraction || a.id.localeCompare(b.id));
  for (const row of rows) { if (remaining > 0) { row.q++; remaining--; } }
  return Object.fromEntries(rows.map(r => [r.id,r.q]));
}
export function allocate(policy: Policy, needs: AllocationNeed[], supply: number, options: AllocationOptions = {}) {
  quantity(supply);
  if (!policies.includes(policy)) throw new Error('Unknown allocation policy.');
  if(new Set(needs.map(n=>n.id)).size !== needs.length) throw new Error('Duplicate need IDs.');
  needs.forEach(n => { quantity(n.demand); if(!Number.isFinite(n.priority)) throw new Error('Invalid priority.'); });
  let amounts: Record<string,number> = Object.fromEntries(needs.map(n=>[n.id,0]));
  if (policy === 'urgency') {
    let left = supply;
    [...needs].sort((a,b)=>b.priority-a.priority || a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id)).forEach(n=> { amounts[n.id]=Math.min(left,n.demand); left-=amounts[n.id]; });
  } else if (policy === 'proportional') amounts=distribute(needs,supply,n=>n.demand);
  else if (policy === 'minimum') {
    needs.forEach(n=>quantity(options.targets?.[n.id] ?? n.target ?? 0));
    amounts=distribute(needs,supply,n=>Math.min(n.demand,options.targets?.[n.id] ?? n.target ?? 0));
    const left=supply-Object.values(amounts).reduce((a,b)=>a+b,0);
    const extra=distribute(needs,left,n=>n.demand-amounts[n.id]);
    needs.forEach(n=>amounts[n.id]+=extra[n.id]);
  } else {
    for (const n of needs) { const q=quantity(options.manual?.[n.id] ?? 0); if(q>n.demand) throw new Error('Allocation exceeds remaining demand.'); amounts[n.id]=q; }
    if(Object.values(amounts).reduce((a,b)=>a+b,0)>supply) throw new Error('Allocation exceeds available stock.');
  }
  const explanation={urgency:'Operational priority, then oldest confirmation, then stable ID.',proportional:'Outstanding demand weighted equally per unit; largest remainder, stable ID ties.',minimum:'Explicit location targets first, then unmet demand; largest remainder rounding.',manual:'Coordinator-selected quantities bounded by stock and demand.'}[policy];
  const rows=needs.map(n=>({id:n.id,area:n.area,demand:n.demand,quantity:amounts[n.id],coverage:n.demand?100*amounts[n.id]/n.demand:100,shortage:n.demand-amounts[n.id],explanation}));
  const allocated=rows.reduce((s,n)=>s+n.quantity,0);
  return {policy,rows,allocated,unused:supply-allocated,shortage:rows.reduce((s,n)=>s+n.shortage,0),zeroLocations:rows.filter(n=>n.demand>0&&!n.quantity).length,algorithmVersion:'1.0.0'};
}
