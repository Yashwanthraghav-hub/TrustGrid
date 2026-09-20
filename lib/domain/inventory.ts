import { quantity } from './allocation';
export type Balance = { onHand:number; reserved:number; inTransit:number; received:number; returned:number; lost:number };
export function move(balance: Balance, action:'reserve'|'release'|'pickup'|'receipt'|'return'|'loss', q:number): Balance {
  quantity(q,false); const b={...balance};
  if(action==='reserve'){ if(q>b.onHand-b.reserved) throw new Error('Insufficient stock'); b.reserved+=q; }
  if(action==='release'){ if(q>b.reserved) throw new Error('Exceeds reserved'); b.reserved-=q; }
  if(action==='pickup'){ if(q>b.reserved||q>b.onHand) throw new Error('Exceeds reserved stock'); b.reserved-=q;b.onHand-=q;b.inTransit+=q; }
  if(['receipt','return','loss'].includes(action)){ if(q>b.inTransit) throw new Error('Exceeds unresolved custody'); b.inTransit-=q; if(action==='receipt')b.received+=q; if(action==='return'){b.onHand+=q;b.returned+=q;} if(action==='loss')b.lost+=q; }
  return b;
}
export function needBalance(target:number,external:number,received:number,reserved:number,inTransit:number) { [target,external,received,reserved,inTransit].forEach(n=>quantity(n)); const remaining=Math.max(0,target-external-received); return {remainingToReceive:remaining,uncommitted:Math.max(0,remaining-reserved-inTransit)}; }
