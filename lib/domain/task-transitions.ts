export const taskStates=['awaiting_assignment','accepted','pickup_confirmed','en_route','dropoff_recorded','receipt_confirmed','closed','cancelled_before_pickup','exception'] as const;
export type TaskState=typeof taskStates[number];
export function canTransition(from:TaskState,to:TaskState,actor:'coordinator'|'volunteer'|'recipient',unresolved=0) {
  if(to==='exception')return actor!=='recipient'&&!['closed','cancelled_before_pickup'].includes(from);
  if(to==='cancelled_before_pickup')return actor==='coordinator'&&['awaiting_assignment','accepted'].includes(from);
  if(to==='closed')return actor==='coordinator'&&['receipt_confirmed','exception'].includes(from)&&unresolved===0;
  if(to==='receipt_confirmed')return actor==='recipient'&&['dropoff_recorded','exception'].includes(from);
  return actor==='volunteer'&&({awaiting_assignment:'accepted',accepted:'pickup_confirmed',pickup_confirmed:'en_route',en_route:'dropoff_recorded'} as Record<string,string>)[from]===to;
}
