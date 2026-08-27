'use strict';

// CMS identity is a cross-repository contract. Keep this catalog independent
// from inventory discovery profiles: recognizing a CMS does not imply that this
// skill knows its component extensions, roots, or Storybook behavior.
const CMS_CATALOG = Object.freeze([
  Object.freeze({ key: 'contentful', label: 'Contentful' }),
  Object.freeze({ key: 'contentstack', label: 'Contentstack' }),
  Object.freeze({ key: 'optimizely-saas', label: 'Optimizely SaaS' }),
  Object.freeze({ key: 'optimizely-paas', label: 'Optimizely PaaS' }),
  Object.freeze({ key: 'sitecore-on-prem', label: 'Sitecore on-Prem' }),
  Object.freeze({ key: 'sitecore-ai', label: 'SitecoreAI' }),
  Object.freeze({ key: 'wordpress', label: 'Wordpress' }),
]);

const CMS_BY_KEY = new Map(CMS_CATALOG.map((entry) => [entry.key, entry]));

/** Return the canonical CMS entry for an exact key, or null. */
function cmsForKey(value) {
  return typeof value === 'string' ? CMS_BY_KEY.get(value) || null : null;
}

module.exports = { CMS_CATALOG, cmsForKey };
