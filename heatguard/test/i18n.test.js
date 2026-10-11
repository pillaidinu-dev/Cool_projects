import test from 'node:test';
import assert from 'node:assert/strict';
import { render, LANGUAGES, TEMPLATES } from '../src/i18n.js';
import { floorPlan } from '../src/heat.js';

test('every template renders in every language with no unfilled placeholders', () => {
  for (const lang of Object.keys(LANGUAGES)) {
    for (const template of TEMPLATES) {
      for (let level = 0; level <= 4; level++) {
        const text = render(template, lang, floorPlan(level));
        assert.ok(text.length > 10, `${lang}/${template}`);
        assert.ok(!/[{}]/.test(text), `${lang}/${template}: ${text}`);
      }
    }
  }
});

test('risk_update picks the right wording for the level', () => {
  assert.match(render('risk_update', 'en', floorPlan(0)), /normal/);
  assert.match(render('risk_update', 'en', floorPlan(2)), /High.*every 15 minutes.*45 min.*15 min/);
  assert.match(render('risk_update', 'en', floorPlan(4)), /Stop heavy outdoor work/);
});
