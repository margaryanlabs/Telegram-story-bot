// A successful HTTP/Telegram response without a valid Story ID does not
// authorize a "published" UI state or storage history entry. The operation
// may already have happened, so retries must require manual inspection.
export function confirmedBotStoryId(data){
  if(data?.ok!==true)throw Error('STORY_PUBLISH_NOT_CONFIRMED');
  const id=data?.result?.id;
  if(!Number.isSafeInteger(id)||id<=0)
    throw Error('STORY_PUBLISH_RESULT_UNCERTAIN');
  return id;
}
