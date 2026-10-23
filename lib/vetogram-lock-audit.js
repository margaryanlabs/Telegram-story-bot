// Offline, deterministic lockfile structure audit. Never download packages.
export function auditNpmLock(manifest,lock){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
     !lock||typeof lock!=='object'||Array.isArray(lock))
    throw Error('LOCK_AUDIT_INPUT_INVALID');
  const declared={...manifest.dependencies,...manifest.optionalDependencies,
    ...manifest.devDependencies};
  const root=lock.packages?.['']||{};
  const locked={...root.dependencies,...root.optionalDependencies,
    ...root.devDependencies};
  const mismatches=Object.entries(declared).filter(([name,spec])=>
    typeof spec!=='string'||locked[name]!==spec).map(([name,spec])=>
      ({name,required:spec,locked:locked[name]??null}));
  const missingPackages=Object.keys(declared).filter(name=>
    !lock.packages?.['node_modules/'+name]);
  const versionValid=Number.isInteger(lock.lockfileVersion)&&lock.lockfileVersion>=2;
  return {ok:versionValid&&mismatches.length===0&&missingPackages.length===0,
    versionValid,mismatches,missingPackages,declaredCount:Object.keys(declared).length};
}
