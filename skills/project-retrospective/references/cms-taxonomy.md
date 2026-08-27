# CMS taxonomy

Use this contract whenever an analyze or retrospectives-only run writes CMS identity. CMS recognition is separate from component discovery capability.

| CMS label | Canonical key |
|---|---|
| Contentful | `contentful` |
| Contentstack | `contentstack` |
| Optimizely SaaS | `optimizely-saas` |
| Optimizely PaaS | `optimizely-paas` |
| Sitecore on-Prem | `sitecore-on-prem` |
| SitecoreAI | `sitecore-ai` |
| Wordpress | `wordpress` |

`inventory.cjs` writes the exact pair to `config.cmsKey` and `config.cmsLabel`. `meta.json` repeats it as `platform` and `platformDisplay`, and the report repeats it in the Run table. Use a `null`/`null` metadata pair and `unknown` in the report only when inventory has no recognized CMS identity.

Dedicated discovery profiles exist for `contentstack`, `optimizely-saas`, and `sitecore-ai`. `toolkit` remains a supported non-CMS discovery profile. The other four catalog entries are recognized identities but use the broad fallback scan with an `unsupported-cms-discovery` warning; recognition must not invent extensions, roots, or Storybook behavior.

Legacy values such as `contentstack-sdk`, `optimizely`, `sitecore-xp`, and `sitecore-xm-cloud` are not aliases. A new inventory treats them as unknown adapters, and the validator rejects them in new `meta.json` output. Historical evidence normalization belongs at the evidence repository's read boundary, not in this producer.
