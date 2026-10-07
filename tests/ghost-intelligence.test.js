import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveIntelligenceBrief } from '../api/viewer-sync.js';
import { AUTOMATION_PRESETS } from '../api/automations.js';

test('Ghost Intelligence Brief stays evidence-based', () => {
  const brief = deriveIntelligenceBrief({
    totalViews: 80,
    identifiedViews: 60,
    uniqueViewers: 20,
    repeatViewers: 8,
    avgDelaySec: 720,
    topPeople: [
      {
        viewerUserId: '42',
        username: 'anna',
        viewedStories: 4,
        activityScore: 88,
      },
    ],
    storyPerformance: [
      { storyId: 10, views15m: 30, views: 55 },
      { storyId: 9, views15m: 18, views: 44 },
    ],
  });

  assert.equal(brief.confidence, 'MEDIUM');
  assert.equal(brief.sampleSize, 80);
  assert.ok(brief.items.length >= 3);
  assert.match(brief.items.find(item => item.kind === 'retention')?.evidence || '', /8 repeat/);
  assert.match(brief.items.find(item => item.kind === 'identity')?.evidence || '', /60 identified/);
  assert.match(brief.items.find(item => item.kind === 'momentum')?.title || '', /Story #10/);
});

test('Ghost Intelligence Brief refuses to invent data', () => {
  const brief = deriveIntelligenceBrief({
    totalViews: 0,
    identifiedViews: 0,
    uniqueViewers: 0,
    repeatViewers: 0,
    avgDelaySec: null,
    topPeople: [],
    storyPerformance: [],
  });

  assert.equal(brief.confidence, 'NO DATA');
  assert.equal(brief.sampleSize, 0);
  assert.deepEqual(brief.items, []);
});

test('automation presets only use durable existing rules', () => {
  assert.deepEqual(AUTOMATION_PRESETS.quiet, {
    security_changes: true,
    smart_action: false,
    watch_changes: false,
    confirmed_viewer: false,
  });
  assert.deepEqual(AUTOMATION_PRESETS.smart, {
    security_changes: true,
    smart_action: true,
    watch_changes: true,
    confirmed_viewer: false,
  });
  assert.deepEqual(AUTOMATION_PRESETS.full, {
    security_changes: true,
    smart_action: true,
    watch_changes: true,
    confirmed_viewer: true,
  });
});
