import { test, expect } from '@playwright/test';
const state = p => p.evaluate(() => window.__FLIGHT_DEV__.getState());
test('buildable car three-quarter studies and three playable districts', async ({ page }) => {
  test.setTimeout(45000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/'); await page.waitForFunction(() => !!window.__FLIGHT_DEV__);
  await page.locator('#menu [data-effects]').selectOption('rich'); await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.evaluate(() => { const d = window.__FLIGHT_DEV__; d.setManual(true); d.reset(); d.inspectCar('front'); });
  await page.screenshot({ path: 'docs/screenshots/art-car-front.png' }); await page.evaluate(() => window.__FLIGHT_DEV__.inspectCar('rear')); await page.screenshot({ path: 'docs/screenshots/art-car-rear.png' });
  console.log('ART INITIAL', JSON.stringify({ art: (await state(page)).art, meshes: (await state(page)).meshCount }));
  await page.evaluate(() => { const d = window.__FLIGHT_DEV__; d.inspectCar(null); d.startChallenge(); });
  for (const [name, z] of [['civic', 300], ['port', 1300], ['coast', 2300]]) {
    await page.evaluate(z => { const d = window.__FLIGHT_DEV__; for (let i = 0; i < 1000 && d.getState().z < z && d.getState().session.phase !== 'results'; i++) d.advanceWithPilot(.1, { combo: true }); }, z);
    const s = await state(page); expect(s.art.environment.district).toBe(name); expect(s.crashes).toBe(0); console.log('ART DISTRICT', JSON.stringify({ name, art: s.art, meshes: s.meshCount, draws: s.drawCalls })); await page.screenshot({ path: `docs/screenshots/art-district-${name}.png` });
    if (name === 'port') { await page.evaluate(() => { const d = window.__FLIGHT_DEV__; for (let i = 0; i < 1000; i++) { d.advanceWithPilot(.05, { combo: true }); const s = d.getState(); if (s.session.groups.some(g => g.gap && s.z > g.gap.start + 5 && s.z < g.gap.end - 5)) break; } }); const gap = await state(page); expect(gap.grounded).toBe(false); expect(gap.floor.gaps.length).toBeGreaterThan(0); for (const g of gap.floor.gaps) expect(gap.floor.solids.some(([a, b]) => a < g.end && b > g.start)).toBe(false); await page.screenshot({ path: 'docs/screenshots/art-real-gap.png' }); }
  }
  await page.evaluate(() => { const d = window.__FLIGHT_DEV__; d.advanceWithPilot(.1); d.pause(); });
  const frozen = await state(page); await page.waitForTimeout(120); expect((await state(page)).art.car.wheelAngle).toBe(frozen.art.car.wheelAngle);
  await page.evaluate(() => { const d = window.__FLIGHT_DEV__; d.resume(); d.advanceWithPilot(2); });
  await page.evaluate(() => window.__FLIGHT_DEV__.advanceWithPilot(40, { combo: true })); expect((await state(page)).session.result.elapsed).toBe(90); expect(errors).toEqual([]);
});

test('mobile quality switch preserves CSS projection and actually reduces geometry',async({browser})=>{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();await page.goto('/');await page.waitForFunction(()=>!!window.__FLIGHT_DEV__);await page.locator('#menu [data-effects]').selectOption('rich');await page.getByRole('button',{name:'自由练习',exact:true}).tap();await page.keyboard.down('Space');await page.waitForTimeout(500);await page.keyboard.up('Space');await page.keyboard.press('Escape');const rich=await state(page);await page.locator('#overlay [data-effects]').selectOption('low');await page.waitForTimeout(100);const low=await state(page);expect(rich.art.renderWidth).toBe(1055);expect(low.art.renderWidth).toBe(675);expect(low.art.activeTriangles).toBeLessThan(rich.art.activeTriangles);expect(low.art.projectedOrigin.x).toBeCloseTo(rich.art.projectedOrigin.x,0);expect(low.art.projectedOrigin.y).toBeCloseTo(rich.art.projectedOrigin.y,0);await context.close();
});
test('DPR 1/2/3 keep explicit scene density, reduced motion and resources survive loops/restarts', async ({ browser }) => {
  const results = [];
  for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true }); const page = await context.newPage(); await page.goto('/'); await page.waitForFunction(() => !!window.__FLIGHT_DEV__); await page.locator('#menu [data-effects]').selectOption('rich'); await page.getByRole('button', { name: '自由练习', exact: true }).tap();
    const rich = await state(page); expect(rich.art.renderWidth).toBe(dpr === 1 ? 844 : 1055); expect(rich.art.projectedOrigin.x).toBeCloseTo(422, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(140); const low = await state(page); expect(low.art.quality).toBe('low'); expect(low.art.renderWidth).toBe(675); expect(low.art.reducedMotion).toBe(true);
    expect(low.art.activeTriangles).toBeLessThan(rich.art.activeTriangles); results.push({ dpr, rich: [rich.art.renderWidth, rich.art.renderHeight], low: [low.art.renderWidth, low.art.renderHeight], projection: [rich.art.projectedOrigin, low.art.projectedOrigin] });
    if (dpr === 1) {
      const loop = await page.evaluate(() => { const d = window.__FLIGHT_DEV__; d.setManual(true); d.reset(); for (let i = 0; i < 300 && d.getState().x < 9; i++) d.advance(.025, { steer: 1 }); const before = d.getState(); for (let i = 0; i < 5; i++) d.advance(120); const after = d.getState(); for (let i = 0; i < 20; i++) { d.reset(); d.advance(.1); } return { before, after, end: d.getState() }; });
      expect(loop.after.z).toBeGreaterThan(18000); expect(loop.after.crashes).toBe(0); for (const key of ['materials', 'textures', 'geometries']) { expect(loop.after.art[key]).toBe(loop.before.art[key]); expect(loop.end.art[key]).toBe(loop.before.art[key]); } expect(loop.after.meshCount).toBe(loop.before.meshCount); expect(loop.end.art.car.wheelAngle).toBe(0);
      console.log('ART LOOP', JSON.stringify({ z: loop.after.z, meshes: loop.after.meshCount, art: loop.after.art }));
    }
    await context.close();
  }
  console.log('ART DPR', JSON.stringify(results));
});
