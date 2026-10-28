import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',
 workers:1,
 timeout:120000,
 expect:{timeout:10000},
 reporter:[['list'],['html',{open:'never'}]],
 use:{actionTimeout:15000,baseURL:'http://127.0.0.1:8790',trace:'retain-on-failure',
  launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}},
 webServer:{
  command:'node scripts/browser-test-server.mjs',
  url:'http://127.0.0.1:8790',reuseExistingServer:false,timeout:60000,
  env:{WRANGLER_SEND_METRICS:'false'}
 }
});
