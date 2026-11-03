import {defineConfig} from '@playwright/test';

export default defineConfig({
 testDir:'./tests',
 testMatch:'v9-visual.spec.ts',
 timeout:30000,
 expect:{timeout:8000},
 retries:0,
 reporter:'list',
 use:{
   baseURL:'http://127.0.0.1:4173',
   browserName:'chromium',
   screenshot:'only-on-failure',
   trace:'retain-on-failure'
 },
 webServer:{
   command:'python3 -m http.server 4173 --bind 127.0.0.1 --directory market-remembers-v76',
   url:'http://127.0.0.1:4173/',
   reuseExistingServer:!process.env.CI,
   timeout:20000
 }
});
