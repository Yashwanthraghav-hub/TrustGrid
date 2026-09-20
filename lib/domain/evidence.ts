export function duplicateSuggestion(a:{text:string;sku:string|null;area:string|null;observedAt?:string|null},b:{text:string;sku:string|null;area:string|null;observedAt?:string|null}) {
  const normalize=(s:string)=>new Set(s.toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(x=>x.length>1));
  const x=normalize(a.text),y=normalize(b.text);const intersection=[...x].filter(v=>y.has(v)).length;const union=new Set([...x,...y]).size;
  const reasons:string[]=[]; if(union&&intersection/union>.65)reasons.push('Similar wording; forwarded copies are not independent confirmation.');
  if(a.sku&&a.sku===b.sku)reasons.push('Same resource category.');
  if(a.area&&a.area===b.area)reasons.push('Same declared area; exact location still needs review.');
  if(a.observedAt&&b.observedAt&&Math.abs(Date.parse(a.observedAt)-Date.parse(b.observedAt))<86400000)reasons.push('Observation times within 24 hours.');
  return {suggested:reasons.length>=2&&intersection/Math.max(union,1)>.4,reasons,locationUnknown:!a.area||!b.area,requiresHumanReview:true};
}
