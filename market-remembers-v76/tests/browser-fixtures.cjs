const {test:base,expect,request}=require('@playwright/test');
// The managed environment's browser NSS store does not contain its proxy CA.
// For optional deployed checks, fetch exact live responses using the configured
// proxy and Node's injected trusted CA. TLS verification remains enabled.
const test=base.extend({context:async({context},use)=>{
 let api;
 if(process.env.V10_VERIFIED_PROXY_FETCH==='1'){
  if(!process.env.V10_BASE_URL||!process.env.HTTPS_PROXY)throw Error('Deployed base URL and managed HTTPS proxy are required.');
  api=await request.newContext({proxy:{server:process.env.HTTPS_PROXY},ignoreHTTPSErrors:false});
  const origin=new URL(process.env.V10_BASE_URL).origin;
  await context.route(origin+'/**',async route=>{
   const response=await api.fetch(route.request().url(),{method:route.request().method()});
   await route.fulfill({response});
  });
 }
 try{await use(context);}finally{await api?.dispose();}
}});
module.exports={test,expect};
