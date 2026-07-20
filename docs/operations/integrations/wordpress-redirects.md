---
status: supporting
audience: [human, agent]
last_verified: 2026-07-20
---
# WordPress student-portal redirects

WordPress can turn `https://firstchord.co.uk/<friendlyUrl>` into the public
Railway student portal. The live rule is stored in WordPress, not this
repository, so verify the actual plugin configuration before treating this note
as current evidence.

## Intended routing

```text
Source regex: ^/([a-z-]+)/?$
Target:       https://efficient-sparkle-production.up.railway.app/$1
```

The rule must have regex matching enabled. A broad one-segment pattern can also
match real WordPress pages, so exclusions must reflect the live site. Previously
documented examples include:

```text
^/(?!handbook|about|contact|lessons)([a-z-]+)/?$
```

Do not copy that exclusion list without checking current WordPress routes. A
new top-level WordPress page can otherwise be silently redirected to Railway.

Friendly URLs come from `lib/config/students-registry.js`. The redirect does not
prove a student exists and must not become a second student registry.

## Safe change process

1. In WordPress **Tools → Redirection**, export the current rules.
2. Record the current source, target, status code, exclusions, and plugin group.
3. Use a temporary `302` while changing or diagnosing the rule; switch to `301`
   only after the target and exclusions are verified because browsers/CDNs cache
   permanent redirects.
4. Test at least:
   - one current friendly URL from the registry;
   - a friendly URL containing a hyphen;
   - every protected top-level WordPress page;
   - an unknown slug, confirming the failure experience is acceptable.
5. Test in a private browser window and inspect the redirect response/target.
6. Export the working rule again and store it in the approved private operating
   location, not in Git if it contains sensitive site detail.

## Adding or changing a student

Ordinary student onboarding should not require a WordPress rule change. The
shared regex picks up the new `friendlyUrl` after the registry change is deployed.
Use `/admin/onboard`, then test the friendly URL after deployment. For a slug
change, expect cached `301` responses and preserve an old-to-new redirect if a
family already uses the previous address.

## Failure and recovery

If a student URL does not redirect:

1. Confirm the slug in the canonical registry and test the Railway URL directly.
2. Confirm the WordPress Redirection plugin and rule are enabled.
3. Check regex mode, exclusions, target domain, and redirect logs.
4. Clear WordPress/CDN/browser caches or test with `curl` and a private window.
5. If the rule is damaging normal pages, disable it and restore the exported
   known-good configuration; families can temporarily use the direct Railway URL.

If Railway's public domain changes, update the target and test multiple portals
before making the redirect permanent. This public student/tutor runtime is
separate from the canonical admin/API runtime; do not redirect admin or Practice
Chat writeback traffic here.

## Privacy boundary

Friendly URLs are discoverable public routes, not authentication. Do not put
contact, payment, attendance, or other sensitive information behind the
assumption that a first-name URL is secret. Current exposure decisions live in
[the data-protection map](../../policies/data-protection.md) and
[tutor/student security](../../architecture/security/tutor-student-surfaces.md).
