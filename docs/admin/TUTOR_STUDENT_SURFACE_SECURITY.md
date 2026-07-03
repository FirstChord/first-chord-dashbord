# Tutor and Student Surface Security

The admin dashboard remains Google-auth protected. The tutor and student-facing surfaces are intentionally lower-friction, but raw operational APIs should still avoid exposing broad data by MMS ID alone.

## Current Boundary

- `/admin/*` and `/api/admin/*` require an allowed admin Google account.
- Student portal pages use friendly URLs and render notes server-side.
- Tutor dashboard access is intentionally frictionless for now.
- Raw notes access now requires a short-lived per-student token issued with the tutor roster response.
- MMS proxy routes require an admin session before using the server MMS bearer token.

## Accepted Trade-Off

The tutor dashboard does not yet have individual tutor login. This keeps lessons fast and avoids rollout friction, but it means tutor-facing roster endpoints are not a full identity boundary. Treat them as a low-friction staff surface, not as a secure admin surface.

## Guardrail

Do not expose server secrets or broad external-system proxies to unauthenticated clients. If a low-friction page needs data, prefer narrow, scoped tokens or server-rendered friendly URLs over raw IDs.

## Future Direction

The next stronger step is a proper tutor role/session, especially before adding more tutor-owned write actions. Until then:

- keep MMS proxy/admin routes behind admin auth
- keep raw student notes behind per-student tokens
- avoid adding new unauthenticated routes that accept arbitrary MMS IDs
- document any deliberate low-friction exception
