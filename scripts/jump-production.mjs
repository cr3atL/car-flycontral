import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[];
page.on('response',r=>{if(r.status()>=400)warnings.push(r.status()+' '+r.url());});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push({text:m.text(),location:m.location()});});
await page.goto('http://localhost:4173');await page.locator('#start-practice').click();await page.waitForFunction(()=>document.getElementById('action').textContent.includes('黄区推进'));
await page.waitForTimeout(300);await page.keyboard.down('Space');await page.waitForTimeout(1000);await page.keyboard.up('Space');
await page.waitForFunction(()=>document.getElementById('action').textContent.includes('一跳完成'),{},{timeout:20000});await page.screenshot({path:'docs/screenshots/jump-production-complete.png'});
const completion=await page.locator('#action').textContent(),debugExposed=await page.evaluate(()=>('__FLIGHT_DEV__'in window));await page.keyboard.press('r');await page.waitForFunction(()=>document.getElementById('action').textContent.includes('前方黄区'));const retry=await page.locator('#action').textContent();
const result={method:'Current production build, original-speed native keyboard, normal entry, yellow-zone 1s boost then release with no full stunts; actual completion DOM and R retry. No DEV entry or state writes.',completion,retry,debugExposed,errors,warnings};writeFileSync('docs/jump-production.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();if(errors.length||warnings.length||debugExposed)process.exitCode=1;
