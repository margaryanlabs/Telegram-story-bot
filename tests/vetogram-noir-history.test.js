import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryHistory} from '../public/story-history-core.js';
import {newStoryDraft} from '../public/story-engine-core.js';

const draft = () => newStoryDraft({ownerId:'111', id:'draft-one', now:100});
test('undo and redo restore composition, media, layers and Portal without aliasing', () => {
  const h=createStoryHistory(), d=draft(); h.reset('111',d.id);
  d.imageDataUrl='data:image/jpeg;base64,AAAA';
  d.layers=[{id:'one',text:'Начало',x:.5,y:.5}];
  d.portal={type:'offer',title:'Предложение',links:[{label:'Сайт',url:'https://example.org'}]};
  h.checkpoint(d,'111'); d.title='После'; d.layers[0].text='Изменено'; d.portal.links[0].label='Другое';
  const old=h.undo(d,'111');
  assert.equal(old.layers[0].text,'Начало'); assert.equal(old.portal.links[0].label,'Сайт');
  assert.equal(old.imageDataUrl,d.imageDataUrl);
  const next=h.redo(old,'111'); assert.equal(next.title,'После');assert.equal(next.layers[0].text,'Изменено');
});
test('editing after undo discards the old redo branch', () => {
  const h=createStoryHistory(),d=draft();h.reset('111',d.id);h.checkpoint(d,'111');d.title='Вторая версия';
  const old=h.undo(d,'111');assert.equal(h.canRedo,true);
  h.checkpoint(old,'111');old.title='Другая версия';assert.equal(h.redo(old,'111'),null);
});
test('history rejects another account and another draft before returning any content', () => {
  const h=createStoryHistory(),d=draft();h.reset('111',d.id);h.checkpoint(d,'111');d.title='После';
  assert.equal(h.undo(d,'222'),null); assert.equal(h.redo(d,'222'),null);
  assert.equal(h.checkpoint({...d,id:'other'},'111'),false);
  assert.equal(h.undo({...d,id:'other'},'111'),null);
  h.reset('222','draft-two');assert.equal(h.canUndo,false);assert.equal(h.canRedo,false);
});
test('a no-op checkpoint does not create a phantom undo result', () => {
  const h=createStoryHistory(),d=draft();h.reset('111',d.id);h.checkpoint(d,'111');h.checkpoint(d,'111');
  assert.equal(h.undo(d,'111'),null);assert.equal(h.canUndo,false);
});
test('history size is bounded on long editing sessions', () => {
  const h=createStoryHistory(3),d=draft();h.reset('111',d.id);
  for(let i=0;i<10;i++){h.checkpoint(d,'111');d.title='Версия '+i;}
  let current=d,count=0;while((current=h.undo(current,'111')))count++;
  assert.equal(count,3);
});
test('large distinct photo revisions are pruned within the media budget', () => {
  const h=createStoryHistory(),d=draft();h.reset('111',d.id);
  for(let i=0;i<6;i++){d.imageDataUrl=String(i).repeat(5*1024*1024);h.checkpoint(d,'111');d.title='Версия '+i;}
  let current=d,count=0;while((current=h.undo(current,'111')))count++;
  assert.ok(count<=3,'older photo history must be evicted on memory-constrained devices');
});
