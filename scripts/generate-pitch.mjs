import pptxgen from 'pptxgenjs';
import QRCode from 'qrcode';
import path from 'node:path';

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'TrustGrid';
pptx.subject = 'Hackathon pitch — community crisis reporting, allocation, and delivery coordination';
pptx.title = 'TrustGrid — From crisis noise to coordinated action';
pptx.company = 'TrustGrid';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Manrope', bodyFontFace: 'Inter', lang: 'en-US',
  themeColors: [{ name: 'accent1', color: '0F766E' }, { name: 'accent2', color: '22D3EE' }]
};
pptx.defineSlideMaster({
  title: 'MASTER',
  background: { color: 'F7F9FC' },
  objects: [
    { line: { x: 0.65, y: 7.08, w: 12.05, h: 0, line: { color: 'D7E1EA', width: 1 } } },
    { text: { text: 'TRUSTGRID', options: { x: 0.68, y: 7.16, w: 1.7, h: 0.18, fontFace: 'Manrope', fontSize: 8, bold: true, color: '0F766E', charSpacing: 1.8, margin: 0 } } },
    { text: { text: 'From crisis noise to coordinated action.', options: { x: 9.85, y: 7.15, w: 2.8, h: 0.18, fontFace: 'Inter', fontSize: 7.5, color: '64748B', align: 'right', margin: 0 } } }
  ],
  slideNumber: { x: 12.78, y: 7.15, w: 0.22, h: 0.18, color: '64748B', fontSize: 7.5, align: 'right' }
});

const C = { navy: '071A2B', teal: '0F766E', teal2: '0D9488', cyan: '22D3EE', bg: 'F7F9FC', white: 'FFFFFF', ink: '102A43', muted: '64748B', border: 'D7E1EA', amber: 'F59E0B', red: 'E5484D', green: '16A34A', pale: 'E8F5F3', amberPale: 'FFF4DD' };
const screenshot = path.resolve('docs/screenshots/demo-1440.png');
const logo = path.resolve('public/brand/wordmark.svg');
const liveUrl = 'https://trustgrid-gamma.vercel.app';
const qr = await QRCode.toDataURL(liveUrl, { margin: 1, width: 600, color: { dark: `#${C.navy}`, light: '#FFFFFF' } });

function addTitle(slide, eyebrow, title, subtitle) {
  slide.addText(eyebrow.toUpperCase(), { x: 0.72, y: 0.46, w: 4.8, h: 0.2, fontFace: 'Inter', fontSize: 9, bold: true, color: C.teal2, charSpacing: 1.8, margin: 0 });
  slide.addText(title, { x: 0.7, y: 0.76, w: 11.9, h: 0.58, fontFace: 'Manrope', fontSize: 28, bold: true, color: C.navy, breakLine: false, margin: 0, fit: 'shrink' });
  if (subtitle) slide.addText(subtitle, { x: 0.72, y: 1.42, w: 11.6, h: 0.36, fontFace: 'Inter', fontSize: 12.5, color: C.muted, margin: 0, fit: 'shrink' });
}
function card(slide, x, y, w, h, fill = C.white, radius = 0.12) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: radius, fill: { color: fill }, line: { color: C.border, width: 1 }, shadow: { type: 'outer', color: 'B8C6D2', blur: 1, angle: 45, distance: 1, opacity: 0.14 } });
}
function pill(slide, text, x, y, w, fill, color = C.navy) {
  slide.addText(text, { x, y, w, h: 0.28, fontFace: 'Inter', fontSize: 8.5, bold: true, color, align: 'center', valign: 'mid', margin: 0.02, fill: { color: fill }, line: { color: fill }, radius: 0.14 });
}
function number(slide, n, x, y, fill = C.teal) {
  slide.addShape(pptx.ShapeType.ellipse, { x, y, w: 0.42, h: 0.42, fill: { color: fill }, line: { color: fill } });
  slide.addText(String(n), { x, y: y + 0.01, w: 0.42, h: 0.38, fontFace: 'Manrope', fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'mid', margin: 0 });
}
function addLogo(slide, x = 10.8, y = 0.44, w = 1.8, h = 0.45) { slide.addImage({ path: logo, x, y, w, h, transparency: 0 }); }

// 1 — Problem
{
  const s = pptx.addSlide('MASTER'); addTitle(s, '01 · The coordination gap', 'One repeated message can become two demands.', 'Scarce supply moves quickly. Evidence, demand, stock, and custody need different states.'); addLogo(s);
  card(s, 0.72, 2.0, 4.75, 4.6, C.white); card(s, 5.78, 2.0, 6.8, 4.6, C.navy);
  pill(s, 'FICTIONAL EXAMPLE', 1.03, 2.34, 1.5, C.amberPale, '8A4B00');
  s.addText('Two messages.\nOne actual need.', { x: 1.03, y: 2.86, w: 3.8, h: 0.95, fontFace: 'Manrope', fontSize: 24, bold: true, color: C.navy, margin: 0 });
  s.addText('“North hall needs 50 water packs.”', { x: 1.03, y: 4.02, w: 3.75, h: 0.5, fontFace: 'Inter', fontSize: 14, color: C.ink, italic: true, margin: 0 });
  s.addText('“Same hall still needs fifty packs.”', { x: 1.03, y: 4.74, w: 3.75, h: 0.5, fontFace: 'Inter', fontSize: 14, color: C.ink, italic: true, margin: 0 });
  s.addText('If each becomes demand, 60 available packs appear insufficient by 40 more units than reality.', { x: 1.03, y: 5.58, w: 3.9, h: 0.62, fontFace: 'Inter', fontSize: 11.5, color: C.muted, margin: 0, fit: 'shrink' });
  s.addText('What breaks without coordination', { x: 6.2, y: 2.43, w: 5.6, h: 0.4, fontFace: 'Manrope', fontSize: 17, bold: true, color: C.white, margin: 0 });
  const rows = [['01', 'Repeated reports', 'Evidence gets mistaken for demand.'], ['02', 'Stale supply', 'Offers get mistaken for confirmed stock.'], ['03', 'Unclear fairness', 'A decision has no inspectable policy.'], ['04', 'Missing custody', '“Delivered” lacks source and recipient confirmation.']];
  rows.forEach((r, i) => { const y = 3.15 + i * 0.76; s.addText(r[0], { x: 6.2, y, w: 0.42, h: 0.28, fontFace: 'Inter', fontSize: 9, bold: true, color: C.cyan, margin: 0 }); s.addText(r[1], { x: 6.82, y: y - 0.03, w: 2.1, h: 0.28, fontFace: 'Manrope', fontSize: 12.5, bold: true, color: C.white, margin: 0 }); s.addText(r[2], { x: 9.0, y: y - 0.03, w: 2.8, h: 0.34, fontFace: 'Inter', fontSize: 10.5, color: 'C7D5E0', margin: 0, fit: 'shrink' }); if (i < 3) s.addShape(pptx.ShapeType.line, { x: 6.2, y: y + 0.48, w: 5.5, h: 0, line: { color: '274155', width: 1 } }); });
}

// 2 — Solution
{
  const s = pptx.addSlide('MASTER'); addTitle(s, '02 · The TrustGrid flow', 'Human judgment at every consequential step.', 'AI organizes a draft. Coordinators confirm demand and policy. Participants confirm custody.'); addLogo(s);
  const items = [
    ['Report', 'Original words + corrected structured draft', C.teal],
    ['Review', 'Link duplicate/conflicting evidence to one need', '137F83'],
    ['Allocate', 'Compare named policies against current stock', '116F78'],
    ['Handoff', 'Source → volunteer → recipient events', C.navy]
  ];
  items.forEach((it, i) => { const x = 0.75 + i * 3.08; card(s, x, 2.18, 2.62, 2.2, i === 3 ? C.navy : C.white); number(s, i + 1, x + 0.25, 2.46, it[2]); s.addText(it[0], { x: x + 0.25, y: 3.0, w: 1.95, h: 0.34, fontFace: 'Manrope', fontSize: 17, bold: true, color: i === 3 ? C.white : C.navy, margin: 0 }); s.addText(it[1], { x: x + 0.25, y: 3.47, w: 2.05, h: 0.56, fontFace: 'Inter', fontSize: 10.3, color: i === 3 ? 'C7D5E0' : C.muted, margin: 0, fit: 'shrink' }); if (i < 3) s.addShape(pptx.ShapeType.chevron, { x: x + 2.72, y: 2.98, w: 0.27, h: 0.48, fill: { color: C.cyan }, line: { color: C.cyan } }); });
  card(s, 0.75, 4.78, 12.02, 1.55, C.pale);
  s.addText('The safety boundary', { x: 1.05, y: 5.08, w: 2.2, h: 0.32, fontFace: 'Manrope', fontSize: 15, bold: true, color: C.teal, margin: 0 });
  s.addText('TrustGrid does not verify truth, dispatch emergency services, diagnose needs, or guarantee assistance. Unknown location and relative time stay unknown until a person confirms them.', { x: 3.15, y: 5.03, w: 8.8, h: 0.62, fontFace: 'Inter', fontSize: 11.2, color: C.ink, margin: 0, fit: 'shrink' });
  pill(s, 'AI-EXTRACTED DRAFT', 1.05, 5.76, 1.72, 'DDF4F2', C.teal); pill(s, 'AWAITING REVIEW', 3.0, 5.76, 1.54, C.amberPale, '8A4B00'); pill(s, 'PARTICIPANT-CONFIRMED', 4.78, 5.76, 2.1, 'DCFCE7', '126331');
}

// 3 — Product
{
  const s = pptx.addSlide('MASTER'); addTitle(s, '03 · Working product', 'Change the inputs. Inspect the tradeoff.', 'The deployed demo runs the same deterministic allocation module used by the operational workspace.'); addLogo(s);
  card(s, 0.72, 1.96, 8.0, 4.72, C.white);
  s.addImage({ path: screenshot, x: 0.9, y: 2.14, w: 7.64, h: 4.36, sizing: 'crop' });
  pill(s, 'ACTUAL DEPLOYMENT SCREENSHOT', 1.08, 6.16, 2.15, C.amberPale, '8A4B00');
  card(s, 9.05, 1.96, 3.53, 4.72, C.navy);
  s.addText('60 packs', { x: 9.38, y: 2.34, w: 2.8, h: 0.48, fontFace: 'Manrope', fontSize: 26, bold: true, color: C.white, margin: 0 });
  s.addText('one fixed supply', { x: 9.4, y: 2.88, w: 2.2, h: 0.25, fontFace: 'Inter', fontSize: 9.5, color: 'C7D5E0', margin: 0 });
  const policies = [['Equal / proportional', '30 / 30'], ['Urgency first', '50 / 10'], ['Minimum targets', '40 / 20']];
  policies.forEach((r, i) => { const y = 3.42 + i * 0.78; s.addText(r[0], { x: 9.4, y, w: 1.65, h: 0.3, fontFace: 'Inter', fontSize: 10, color: 'C7D5E0', margin: 0 }); s.addText(r[1], { x: 11.25, y: y - 0.04, w: 0.85, h: 0.35, fontFace: 'Manrope', fontSize: 15, bold: true, color: i === 1 ? C.cyan : C.white, align: 'right', margin: 0 }); });
  s.addShape(pptx.ShapeType.line, { x: 9.4, y: 5.8, w: 2.72, h: 0, line: { color: '274155', width: 1 } });
  s.addText('Also live', { x: 9.4, y: 6.02, w: 1.0, h: 0.28, fontFace: 'Inter', fontSize: 9, bold: true, color: C.cyan, charSpacing: 1.2, margin: 0 });
  s.addText('Editable report example preserves unknown address and ambiguous “tomorrow morning.”', { x: 10.25, y: 5.95, w: 1.85, h: 0.48, fontFace: 'Inter', fontSize: 8.8, color: 'C7D5E0', margin: 0, fit: 'shrink' });
}

// 4 — Technology
{
  const s = pptx.addSlide('MASTER'); addTitle(s, '04 · Technology that proves the claim', 'Each layer answers a different trust question.', 'One Next.js application; PostgreSQL owns authorization and accounting invariants.'); addLogo(s);
  const cells = [
    ['AI extraction', 'Schema + source snippets', 'Proves what the draft came from — not that it is true.', C.teal],
    ['RLS + org keys', 'Scoped reads and references', 'Proves one organization cannot rely on a client-supplied scope.', '116F78'],
    ['Row locks + ledger', 'Atomic reservation and custody', 'Proves the same physical units cannot be committed twice.', C.navy],
    ['Realtime + receipts', 'Authorized refetch and actors', 'Proves who recorded each state and when.', '334E68']
  ];
  cells.forEach((c, i) => { const x = i % 2 === 0 ? 0.75 : 6.78; const y = i < 2 ? 2.02 : 4.42; card(s, x, y, 5.77, 2.03, C.white); s.addShape(pptx.ShapeType.rect, { x, y, w: 0.12, h: 2.03, fill: { color: c[3] }, line: { color: c[3] } }); s.addText(c[0], { x: x + 0.4, y: y + 0.28, w: 2.2, h: 0.32, fontFace: 'Manrope', fontSize: 16, bold: true, color: C.navy, margin: 0 }); pill(s, c[1], x + 3.0, y + 0.28, 2.27, C.pale, C.teal); s.addText(c[2], { x: x + 0.4, y: y + 0.9, w: 4.85, h: 0.68, fontFace: 'Inter', fontSize: 11.2, color: C.muted, margin: 0, fit: 'shrink' }); });
  s.addText('Next.js 16  ·  Supabase Auth / PostgreSQL / Storage / Realtime  ·  Google GenAI  ·  Vitest / PGlite / Playwright', { x: 0.78, y: 6.63, w: 11.7, h: 0.24, fontFace: 'Inter', fontSize: 9.2, color: C.muted, align: 'center', margin: 0 });
}

// 5 — Impact & feasibility
{
  const s = pptx.addSlide('MASTER'); addTitle(s, '05 · Demonstrated today', 'Auditable coordination, with honest limits.', 'The public product is live; account-owner OAuth setup unlocks the authenticated judging flow.'); addLogo(s);
  const stats = [['26', 'domain tests'], ['8', 'database integration tests'], ['9 / 9', 'live browser checks'], ['4', 'verified SQL migrations']];
  stats.forEach((st, i) => { const x = 0.75 + i * 2.2; card(s, x, 2.0, 1.98, 1.28, C.white); s.addText(st[0], { x: x + 0.14, y: 2.25, w: 1.7, h: 0.38, fontFace: 'Manrope', fontSize: 22, bold: true, color: C.teal, align: 'center', margin: 0 }); s.addText(st[1], { x: x + 0.14, y: 2.76, w: 1.7, h: 0.22, fontFace: 'Inter', fontSize: 8.5, color: C.muted, align: 'center', margin: 0, fit: 'shrink' }); });
  card(s, 0.75, 3.62, 8.62, 2.68, C.navy);
  s.addText('What works now', { x: 1.08, y: 3.98, w: 2.5, h: 0.35, fontFace: 'Manrope', fontSize: 17, bold: true, color: C.white, margin: 0 });
  const now = ['Multilingual draft + structured fallback', 'Explainable duplicate review and allocation policies', 'Transactional inventory, volunteer, custody, and audit model'];
  now.forEach((t, i) => { s.addText('✓', { x: 1.08, y: 4.52 + i * 0.48, w: 0.24, h: 0.25, fontFace: 'Inter', fontSize: 12, bold: true, color: C.cyan, margin: 0 }); s.addText(t, { x: 1.42, y: 4.49 + i * 0.48, w: 5.85, h: 0.3, fontFace: 'Inter', fontSize: 10.8, color: 'DDE8F0', margin: 0, fit: 'shrink' }); });
  s.addText('Limits', { x: 1.08, y: 5.98, w: 0.7, h: 0.22, fontFace: 'Inter', fontSize: 8.5, bold: true, color: C.amber, charSpacing: 1.2, margin: 0 });
  s.addText('Self-reported data, connectivity, participant collusion, and review capacity remain real constraints.', { x: 1.78, y: 5.92, w: 5.48, h: 0.33, fontFace: 'Inter', fontSize: 8.8, color: 'C7D5E0', margin: 0, fit: 'shrink' });
  card(s, 9.65, 2.0, 2.92, 4.3, C.white);
  s.addText('TRY THE LIVE DEMO', { x: 9.9, y: 2.32, w: 2.42, h: 0.22, fontFace: 'Inter', fontSize: 8.2, bold: true, color: C.teal2, charSpacing: 1.2, align: 'center', margin: 0 });
  s.addImage({ data: qr, x: 10.31, y: 2.68, w: 1.62, h: 1.62 });
  s.addText('trustgrid-gamma.vercel.app', { x: 9.95, y: 4.42, w: 2.32, h: 0.34, fontFace: 'Manrope', fontSize: 11.5, bold: true, color: C.navy, align: 'center', margin: 0, fit: 'shrink', hyperlink: { url: liveUrl } });
  s.addShape(pptx.ShapeType.line, { x: 9.95, y: 4.94, w: 2.32, h: 0, line: { color: C.border, width: 1 } });
  s.addText('Repository: local Git ready; GitHub authorization pending.', { x: 9.95, y: 5.15, w: 2.32, h: 0.38, fontFace: 'Inter', fontSize: 8.3, color: C.ink, align: 'center', margin: 0, fit: 'shrink' });
  s.addText('TEAM · OWNER TO FILL', { x: 9.95, y: 5.78, w: 2.32, h: 0.23, fontFace: 'Inter', fontSize: 8.8, bold: true, color: C.red, align: 'center', margin: 0 });
}

await pptx.writeFile({ fileName: path.resolve('docs/pitch.pptx') });
console.log('Generated docs/pitch.pptx with 5 slides and the verified live URL QR code.');
