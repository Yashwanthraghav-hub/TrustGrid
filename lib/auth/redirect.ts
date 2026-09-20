export function safeReturnPath(value:string|null|undefined):string {
  if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\%\u0000-\u0020]/.test(value))return '/dashboard';
  if(!/^\/(dashboard|admin|onboarding)(\/|\?|$)/.test(value))return '/dashboard';
  return value;
}
