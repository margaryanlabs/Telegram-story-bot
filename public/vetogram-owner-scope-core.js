// Browser and Node-compatible guards for owner-bound Mini App requests.
// Signed Telegram initData, not an untrusted display name, scopes responses.
export function ownerScopeMatches(request,active,signedInitData){
  return Boolean(request&&active&&
    typeof request.identity==='string'&&request.identity.length>0&&
    typeof request.ownerId==='string'&&/^\d{1,20}$/.test(request.ownerId)&&
    Number.isSafeInteger(request.epoch)&&request.epoch>=0&&
    request.identity===signedInitData&&
    request.identity===active.identity&&
    request.ownerId===active.ownerId&&
    request.epoch===active.epoch);
}
// An OLD request may reset its own expired UI, never a NEW owner's UI.
export function oldRequestCanReset(currentIdentity,requestIdentity){
  return typeof requestIdentity==='string'&&requestIdentity.length>0&&
    currentIdentity===requestIdentity;
}
