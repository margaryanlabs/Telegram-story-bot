const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 outputDir:process.env.V10_BASE_URL?'test-results/deployed':'test-results/chromium',
 testDir:'./tests',testMatch:['v10-browser.spec.cjs','v12-rc6-browser.spec.cjs','v14-crimson-browser.spec.cjs','v15-obsidian-browser.spec.cjs','v16-signal-browser.spec.cjs','v16-precision-polish-browser.spec.cjs','v18-people-mirror-browser.spec.cjs','v18-visible-date-probes-browser.spec.cjs','v19-reader-worlds-browser.spec.cjs'],timeout:30000,
 expect:{timeout:9000},workers:1,retries:0,
 reporter:[['list'],['json',{outputFile:process.env.V10_BASE_URL?'test-results/v10-live-results.json':'test-results/v10-results.json'}]],
 use:{baseURL:process.env.V10_BASE_URL||'http://127.0.0.1:4173',screenshot:'only-on-failure',trace:'retain-on-failure',
  launchOptions:{...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 },
 projects:[{name:'chromium',use:{browserName:'chromium'}}],
 webServer:process.env.V10_BASE_URL?undefined:{command:'python3 -m http.server 4173 --bind 127.0.0.1 --directory .',url:'http://127.0.0.1:4173/',reuseExistingServer:!process.env.CI}
});
