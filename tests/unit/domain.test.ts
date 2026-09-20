import {describe,it,expect} from 'vitest';
import {allocate,quantity} from '@/lib/domain/allocation';
import {move,needBalance} from '@/lib/domain/inventory';
import {matchVolunteers,type Volunteer} from '@/lib/domain/matching';
import {safeReturnPath} from '@/lib/auth/redirect';
import {duplicateSuggestion} from '@/lib/domain/evidence';
import {canTransition} from '@/lib/domain/task-transitions';
const needs=[{id:'A',area:'Sample Hall',demand:50,priority:3,confirmedAt:'2026-09-20T08:00:00Z'},{id:'B',area:'Sample School',demand:50,priority:1,confirmedAt:'2026-09-20T08:00:00Z'}];
describe('allocation policies',()=>{
 it.each([['urgency',[50,10],[100,20]],['proportional',[30,30],[60,60]],['minimum',[40,20],[80,40]]] as const)('60-pack fixture: %s',(policy,expected,coverage)=>{const r=allocate(policy,needs,60,{targets:{A:40,B:20}});expect(r.rows.map(x=>x.quantity)).toEqual(expected);expect(r.rows.map(x=>x.coverage)).toEqual(coverage);expect(r.allocated).toBe(60);expect(r.shortage).toBe(40);});
 it('conserves indivisible units with deterministic ties',()=>{const n=[...needs,{...needs[1],id:'C'}];expect(allocate('proportional',n,2).rows.map(r=>r.quantity)).toEqual([1,1,0]);});
 it('conserves stock across varied supply/demand and policies',()=>{for(let stock=0;stock<120;stock++){for(const policy of ['urgency','proportional','minimum'] as const){const r=allocate(policy,needs,stock,{targets:{A:40,B:20}});expect(r.allocated+r.unused).toBe(stock);expect(r.allocated+r.shortage).toBe(100);r.rows.forEach(row=>{expect(Number.isInteger(row.quantity)).toBe(true);expect(row.quantity).toBeLessThanOrEqual(row.demand);});}}});
 it('handles zero, empty and single need',()=>{expect(allocate('proportional',needs,0).allocated).toBe(0);expect(allocate('minimum',[],10).unused).toBe(10);expect(allocate('urgency',[needs[0]],80).allocated).toBe(50);});
 it.each([-1,1.5,NaN,Infinity,1000001])('rejects bad quantity %s',q=>expect(()=>quantity(q)).toThrow());
 it('rejects manual overcommit and duplicate need IDs',()=>{expect(()=>allocate('manual',needs,60,{manual:{A:50,B:50}})).toThrow();expect(()=>allocate('urgency',[needs[0],needs[0]],10)).toThrow();});
});
describe('stock custody',()=>{
 const initial={onHand:60,reserved:0,inTransit:0,received:0,returned:0,lost:0};
 it('pickup subtracts physical stock once; receipt never subtracts it again',()=>{const b=move(move(move(initial,'reserve',20),'pickup',20),'receipt',12);expect(b).toEqual({...initial,onHand:40,reserved:0,inTransit:8,received:12});expect(()=>move(b,'receipt',9)).toThrow();});
 it('cancellation before collection and partial return preserve stock',()=>{expect(move(move(initial,'reserve',20),'release',20)).toEqual(initial);const b=move(move(move(initial,'reserve',20),'pickup',20),'return',8);expect(b.onHand+b.inTransit).toBe(60);});
 it('remaining need separates receipts from commitments',()=>expect(needBalance(100,10,20,15,5)).toEqual({remainingToReceive:70,uncommitted:50}));
 it('refuses close with unresolved custody and unauthorized transitions',()=>{expect(canTransition('exception','closed','coordinator',3)).toBe(false);expect(canTransition('en_route','receipt_confirmed','volunteer')).toBe(false);});
});
it('requires every volunteer eligibility filter before ranking',()=>{const v:Volunteer={id:'v',active:true,approved:true,availableUntil:'2030-01-01T00:00:00Z',skills:[],areas:['Hall'],capacity:{WATER_PACK_6X1L:20},maxTasks:1,activeTasks:0,distanceKm:null};const task={sku:'WATER_PACK_6X1L',quantity:20,area:'Hall'};expect(matchVolunteers([v],task).length).toBe(1);for(const bad of [{approved:false},{active:false},{activeTasks:1},{availableUntil:null},{areas:['Other']},{capacity:{WATER_PACK_6X1L:19}}])expect(matchVolunteers([{...v,...bad}],task)).toEqual([]);});
it('similar text is only a suggestion, never doubles demand',()=>{const a={text:'30 water packs needed at the sample hall',sku:'WATER_PACK_6X1L',area:null};const r=duplicateSuggestion(a,a);expect(r.suggested).toBe(true);expect(r.locationUnknown).toBe(true);expect(r.requiresHumanReview).toBe(true);});
it.each(['https://evil.example','//evil.example','/%2f%2fevil.example','/dashboard%5cevil','/dashboard\\evil','/login','/dashboard\nLocation:evil'])('rejects unsafe return path %s',value=>expect(safeReturnPath(value)).toBe('/dashboard'));
it('preserves internal return path',()=>expect(safeReturnPath('/dashboard/requests?status=active')).toBe('/dashboard/requests?status=active'));
