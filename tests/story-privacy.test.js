import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrivacyRules,
  storyMatchesAudience,
} from '../lib/story-app-publisher.js';

function fakeApi() {
  class Rule {
    constructor(value = {}) {
      Object.assign(this, value);
      this.className = this.constructor.name;
    }
  }
  class InputPrivacyValueAllowAll extends Rule {}
  class InputPrivacyValueAllowContacts extends Rule {}
  class InputPrivacyValueAllowCloseFriends extends Rule {}
  class InputPrivacyValueAllowUsers extends Rule {}
  class InputPrivacyValueDisallowUsers extends Rule {}
  class InputUser extends Rule {}
  class ResolveUsername extends Rule {}

  return {
    InputPrivacyValueAllowAll,
    InputPrivacyValueAllowContacts,
    InputPrivacyValueAllowCloseFriends,
    InputPrivacyValueAllowUsers,
    InputPrivacyValueDisallowUsers,
    InputUser,
    contacts: { ResolveUsername },
  };
}

function fakeClient() {
  return {
    async invoke(request) {
      if (request?.constructor?.name !== 'ResolveUsername') {
        throw new Error('Unexpected request');
      }
      return {
        users: [{
          id: 101n,
          accessHash: 202n,
        }],
      };
    },
  };
}

test('Contacts audience maps to Telegram AllowContacts', async () => {
  const Api = fakeApi();
  const result = await buildPrivacyRules(fakeClient(), Api, 'contacts', [], []);
  assert.equal(result.rules.length, 1);
  assert.ok(result.rules[0] instanceof Api.InputPrivacyValueAllowContacts);
});

test('Contacts exclusions append Telegram DisallowUsers', async () => {
  const Api = fakeApi();
  const result = await buildPrivacyRules(fakeClient(), Api, 'contacts', [], ['alice']);
  assert.ok(result.rules[0] instanceof Api.InputPrivacyValueAllowContacts);
  assert.ok(result.rules[1] instanceof Api.InputPrivacyValueDisallowUsers);
  assert.equal(result.rules[1].users.length, 1);
});

test('All audience maps to AllowAll and Close Friends maps to AllowCloseFriends', async () => {
  const Api = fakeApi();
  const all = await buildPrivacyRules(fakeClient(), Api, 'all', [], []);
  const close = await buildPrivacyRules(fakeClient(), Api, 'close', [], []);
  assert.ok(all.rules[0] instanceof Api.InputPrivacyValueAllowAll);
  assert.ok(close.rules[0] instanceof Api.InputPrivacyValueAllowCloseFriends);
});

test('Selected audience resolves users and maps to AllowUsers', async () => {
  const Api = fakeApi();
  const selected = await buildPrivacyRules(fakeClient(), Api, 'selected', ['alice'], []);
  assert.ok(selected.rules[0] instanceof Api.InputPrivacyValueAllowUsers);
  assert.equal(selected.rules[0].users.length, 1);
});

test('privacy verification accepts only the requested audience', () => {
  assert.equal(storyMatchesAudience({ contacts: true }, 'contacts'), true);
  assert.equal(storyMatchesAudience({ public: true }, 'contacts'), false);

  assert.equal(storyMatchesAudience({
    privacy: [{ className: 'PrivacyValueAllowContacts' }],
  }, 'contacts'), true);

  assert.equal(storyMatchesAudience({
    privacy: [{ className: 'PrivacyValueAllowAll' }],
  }, 'contacts'), false);

  assert.equal(storyMatchesAudience({ closeFriends: true }, 'close'), true);
  assert.equal(storyMatchesAudience({ selectedContacts: true }, 'selected'), true);
});
