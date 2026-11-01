// Metadata validator for curated Vetogram Play submissions.
// This does NOT execute submitted games or grant requested capabilities.
export const PLAY_SCHEMA = 'vetogram.play/v1';
const categories = new Set(['arcade','cards','puzzle','strategy','social','education','sports']);
const modes = new Set(['solo','local-multiplayer','remote-multiplayer']);
const capabilities = new Set(['haptics','share-invite','save-score']);
const languages = new Set(['ru','en','hy']);
const text = (value,min,max) => typeof value==='string' && value.trim().length>=min && value.trim().length<=max;
const unique = values => Array.isArray(values) && new Set(values).size===values.length;

export function validatePlayManifest(value) {
  const errors=[];
  if(!value || typeof value!=='object' || Array.isArray(value))return {valid:false,errors:['Manifest must be an object']};
  if(value.schema!==PLAY_SCHEMA)errors.push('schema must equal vetogram.play/v1');
  if(typeof value.id!=='string' || !/^[a-z][a-z0-9-]{2,39}$/.test(value.id))errors.push('id must be a 3-40 character slug starting with a letter');
  if(!text(value.name,2,60))errors.push('name must be 2-60 characters');
  if(!text(value.description,8,240))errors.push('description must be 8-240 characters');
  if(typeof value.version!=='string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version))errors.push('version must be SemVer (e.g. 1.0.0)');
  if(!text(value.author,2,80))errors.push('author must be 2-80 characters');
  if(!text(value.license,2,60))errors.push('license must be declared');
  if(!categories.has(value.category))errors.push('category is not supported');
  const entry=value.entry;
  if(typeof entry!=='string' || entry.length>160 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*\.html$/.test(entry) || entry.split('/').some(part=>part==='.'||part==='..'||part==='') || entry.includes('://'))errors.push('entry must be a safe relative HTML path');
  if(!unique(value.languages) || value.languages.length===0 || !value.languages.every(x=>languages.has(x)))errors.push('languages must be a unique subset of ru, en, hy');
  if(!modes.has(value.mode))errors.push('mode is not supported');
  if(!unique(value.capabilities) || !value.capabilities.every(x=>capabilities.has(x)))errors.push('capabilities must be a unique subset of allowed requests');
  return {valid:errors.length===0,errors};
}
