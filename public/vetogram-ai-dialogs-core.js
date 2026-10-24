// Pure owner-view dialog paging helpers. No MTProto reads or model calls.
export const MAX_DIALOG_PAGES=11; // 0:24; 1-10:up to 50 each (API cap 500)
export const MAX_OWNER_DIALOGS=500;
export function mergeSendableDialogs(previous,incoming){
  const sendable=new Set(['private','group','bot','saved']);
  const existing=Array.isArray(previous)?previous:[];
  const next=Array.isArray(incoming)?incoming:[];
  const merged=[],seen=new Set();
  for(const row of [...existing,...next]){
    if(!row||row.archiveOnly||row.serverCanSend===false||
       !sendable.has(row.type)||!(/^-?\d{1,22}$/).test(String(row.id||'')))continue;
    const id=String(row.id);
    if(seen.has(id))continue;
    seen.add(id);merged.push(row);
    if(merged.length>=MAX_OWNER_DIALOGS)break;
  }
  return merged;
}
export function shouldContinueDialogLookup(page,hasMore,target,dialogs){
  if(!hasMore||!Number.isInteger(page)||page>=MAX_DIALOG_PAGES)return false;
  if(!target||!(/^-?\d{1,22}$/).test(String(target)))return false;
  return !dialogs.some(row=>String(row.id)===String(target));
}
export function hasMoreDialogPages(nextPage,providerHasMore){
  return providerHasMore===true&&Number.isInteger(nextPage)&&nextPage<MAX_DIALOG_PAGES;
}
