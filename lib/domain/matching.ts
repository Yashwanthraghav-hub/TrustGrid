export type Volunteer={id:string;active:boolean;approved:boolean;availableUntil:string|null;skills:string[];areas:string[];capacity:Record<string,number>;maxTasks:number;activeTasks:number;distanceKm:number|null};
export function matchVolunteers(volunteers:Volunteer[],task:{sku:string;quantity:number;area:string;skill?:string},now=new Date()) {
  return volunteers.filter(v=>v.active&&v.approved&&v.availableUntil&&new Date(v.availableUntil)>now&&(!task.skill||v.skills.includes(task.skill))&&v.areas.includes(task.area)&&(v.capacity[task.sku]??0)>=task.quantity&&v.activeTasks<v.maxTasks)
    .sort((a,b)=>(a.distanceKm??Infinity)-(b.distanceKm??Infinity)||a.activeTasks-b.activeTasks||a.id.localeCompare(b.id))
    .map(v=>({...v,reason:`Available until ${v.availableUntil}; capacity ${v.capacity[task.sku]} ${task.sku}; in selected service area; ${v.activeTasks}/${v.maxTasks} active tasks.`}));
}
