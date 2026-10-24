/* VETOGRAM Inbox Pulse — read-only, per-session data summary.
 * No network, storage, AI, sessions, permissions or side effects.
 * chat IDs can recur while a page updates; counting one chat once avoids
 * misleading totals. Counts reflect only currently loaded owner-scoped chats.
 */
(function(root){
  'use strict';
  function safeCount(value){
    const number=Number(value);
    return Number.isFinite(number)&&number>0
      ? Math.min(999999,Math.floor(number)):0;
  }
  function summarize(chats){
    const seen=new Set();
    const summary={loaded:0,unreadChats:0,attentionChats:0,
      savedChats:0,deletedMessages:0};
    for(const chat of Array.isArray(chats)?chats:[]){
      if(!chat||chat.id===undefined||chat.id===null)continue;
      const id=String(chat.id);
      if(!id||seen.has(id))continue;
      seen.add(id);
      summary.loaded++;
      if(safeCount(chat.unreadCount)>0)summary.unreadChats++;
      if(chat.inbox?.needsAttention===true)summary.attentionChats++;
      if(chat.savedCopy===true){
        summary.savedChats++;
        summary.deletedMessages+=safeCount(chat.deletedCount);
      }
    }
    return summary;
  }
  root.VetogramInboxPulse=Object.freeze({summarize});
})(typeof window!=='undefined'?window:{});
