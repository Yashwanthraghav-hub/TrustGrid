import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
test('public routes and configuration failure remain honest',async({page,request})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Help reach the right place.'})).toBeVisible();await page.getByRole('link',{name:'Explore the demo',exact:true}).click();await expect(page.getByRole('heading',{name:'One supply. Four ways to allocate.'})).toBeVisible();
 for(const route of ['/help','/privacy','/login','/register']){const response=await page.goto(route,{waitUntil:'domcontentloaded'});expect(response?.status()).toBe(200);}
 const response=await request.get('/api/v1/reports');expect([401,503]).toContain(response.status());expect(response.headers()['cache-control']).toContain('no-store');
 await page.goto('/admin',{waitUntil:'domcontentloaded'});await expect(page).toHaveURL(/\/login/);
});
test('judge changes policy and supply; real calculations conserve packs',async({page})=>{
 await page.goto('/demo');const north=page.getByRole('row').filter({has:page.getByRole('cell',{name:/Sample North/})});const south=page.getByRole('row').filter({has:page.getByRole('cell',{name:/Sample South/})});
 await expect(north.getByRole('cell').nth(1)).toHaveText('30 packs');await expect(south.getByRole('cell').nth(1)).toHaveText('30 packs');
 await page.getByRole('button',{name:'Urgency first',exact:true}).click();await expect(north.getByRole('cell').nth(1)).toHaveText('50 packs');await expect(south.getByRole('cell').nth(1)).toHaveText('10 packs');
 await page.getByRole('button',{name:'Minimum targets',exact:true}).click();await expect(north.getByRole('cell').nth(1)).toHaveText('40 packs');await expect(south.getByRole('cell').nth(1)).toHaveText('20 packs');
 await page.getByLabel('Available stock').fill('0');await expect(north.getByRole('cell').nth(1)).toHaveText('0 packs');await expect(south.getByRole('cell').nth(1)).toHaveText('0 packs');
 await page.getByLabel('Available stock').fill('-2');await expect(page.getByText(/Quantity must be a whole number/)).toBeVisible();
});
test('sample report preserves unknown address and relative time',async({page})=>{await page.goto('/demo');await page.getByRole('button',{name:'Load sample report',exact:true}).click();await page.getByRole('button',{name:'Preview structured report'}).click();await expect(page.getByText('Unknown — needs confirmation',{exact:true})).toBeVisible();await expect(page.getByText('User-entered structured draft',{exact:true})).toBeVisible();});
for(const width of [360,390,768,1280,1440])test(`public and demo layouts fit ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});for(const route of ['/','/demo','/login','/help']){await page.goto(route,{waitUntil:'domcontentloaded'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}await mkdir('docs/screenshots',{recursive:true});await page.goto('/demo',{waitUntil:'domcontentloaded'});await page.screenshot({path:`docs/screenshots/demo-${width}.png`,fullPage:true});});
test('keyboard skip link works',async({page})=>{await page.goto('/demo');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();});
