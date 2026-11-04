const base=require('./v10-playwright.config.cjs');
module.exports={...base,outputDir:'test-results/webkit',testMatch:'v10-webkit.spec.cjs',
 reporter:[['list'],['json',{outputFile:'test-results/v10-webkit-results.json'}]],
 use:{...base.use,launchOptions:{}},
 projects:[{name:'webkit-mobile',use:{browserName:'webkit',viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}}]
};
