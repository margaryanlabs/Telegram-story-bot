// Offline, deterministic lockfile structure audit. Never download packages.
// This is NOT a substitute for npm ci, which must verify actual integrity.
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
  const invalidResolutions=[];
  for(const [name,spec] of Object.entries(declared)){
    const entry=lock.packages?.['node_modules/'+name];
    if(!entry)continue; // separately reported as missingPackages.
    // Exact-pinned dependencies may not silently resolve to another version.
    // Semver ranges, local workspace links and aliases have separate semantics.
    if(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(spec)&&entry.version!==spec)
      invalidResolutions.push({name,reason:'VERSION_MISMATCH'});
    if(entry.link===true)continue; // linked workspace packages have no tarball.
    if(typeof entry.resolved!=='string'||
       !/^(?:https?:\/\/|file:)/.test(entry.resolved))
      invalidResolutions.push({name,reason:'MISSING_RESOLVED'});
    // Metadata sanity only: npm ci validates actual tarball hashes.
    if(typeof entry.integrity!=='string'||
       !/^sha(?:256|384|512)-[A-Za-z0-9+/]{32,}={0,2}$/.test(entry.integrity))
      invalidResolutions.push({name,reason:'MISSING_INTEGRITY'});
  }
  const versionValid=Number.isInteger(lock.lockfileVersion)&&lock.lockfileVersion>=2;
  return {ok:versionValid&&mismatches.length===0&&missingPackages.length===0&&
      invalidResolutions.length===0,
    versionValid,mismatches,missingPackages,invalidResolutions,
    declaredCount:Object.keys(declared).length};
}
