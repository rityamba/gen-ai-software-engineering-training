# HTTP and API review

Read this when the branch touches HTTP handlers, routes, middleware, API clients, or API schema files. Work through the checklist against the changed endpoints only (plus endpoints whose contract the change affects).

## Classify before you report

Most "HTTP violations" in real reviews are actually taste. Label every HTTP finding as exactly one of these, and put the label in the **Problem** line:

1. **Protocol violation** — breaks a requirement of RFC 9110/9111/9112. A client, proxy or cache can legitimately misbehave. Usually High or Critical.
2. **Incorrect semantics** — the status code, method or header does not mean what the code uses it to mean. Interoperability and debuggability suffer. Usually Medium or High.
3. **REST design weakness** — works correctly, but the contract is inconsistent or awkward for consumers. Usually Low or Medium, and only worth reporting when the branch introduces it.
4. **Project convention** — the repo already does it this way. Not a finding unless the branch is inconsistent with the repo itself.

A codebase that deliberately uses a simple convention across all its endpoints (for example, always `200` with an envelope) is a design weakness at worst, not a defect to rewrite — mark it Informational once, not once per endpoint. Flag only the cases where it actually hurts: errors invisible to clients, retries that corrupt data, caches serving private data.

If you are unsure of an RFC section number, cite the RFC and the rule by name rather than guessing a section.

## Methods

- `GET` and `HEAD` are safe: no observable state change. A `GET` that writes, charges, sends, or consumes a one-time token is a protocol violation (RFC 9110 §9.2.1) — it will be triggered by prefetchers, crawlers and link previews.
- `GET`, `HEAD`, `PUT`, `DELETE` are idempotent (RFC 9110 §9.2.2). Check that repeating the request really is harmless: a `DELETE` that returns 404 on the second call is usually acceptable, but a `DELETE` that emits a second domain event or decrements a counter twice is not.
- `POST` is for non-idempotent creation and actions. If clients or a gateway retry it, check for an idempotency key mechanism, and whether the key is actually enforced on the storage layer rather than just checked-then-written.
- `PUT` replaces the whole representation; `PATCH` (RFC 5789) applies a partial modification. A `PUT` that merges only the supplied fields has the wrong semantics; a `PATCH` body format should be documented (merge-patch RFC 7396, JSON Patch RFC 6902, or a documented project format).
- `HEAD` must return the same headers as `GET` with no body. `OPTIONS` must answer with the allowed methods.
- Non-idempotent work hidden behind an idempotent method is a correctness trap under client retries and proxy replays.

## Status codes

Check the actual path, not the happy path:

- `200` vs `201` vs `202` vs `204`: `201` for a created resource, with `Location` pointing at it (RFC 9110 §15.3.2); `202` only when the work is genuinely still pending; `204` means no body — a body with `204` is a protocol violation (§15.3.5).
- Failure returning `200` with `{"error": ...}` makes failures invisible to monitoring, proxies and generic clients. Report it when it is new, and judge its severity by what the client does with it.
- `400` malformed syntax, `422` well-formed but semantically invalid (§15.5.21), `409` conflict with current state, `412` failed precondition (§15.5.13), `410` permanently gone, `413` content too large (§15.5.14), `415` unsupported media type (§15.5.16), `429` rate limited (RFC 6585 §4).
- `401` means unauthenticated and requires a `WWW-Authenticate` challenge (§15.5.2); `403` means authenticated but not permitted. Returning `403` where the user isn't authenticated at all, or `401` for a permission problem, breaks client retry logic.
- `404` vs `403` for a resource that exists but belongs to someone else is a deliberate choice: `404` avoids leaking existence. Either is defensible — what matters is that it is consistent and intentional.
- `405` must include an `Allow` header listing the supported methods (§15.5.6).
- `3xx`: `301`/`308` permanent, `302`/`307` temporary; `307`/`308` preserve the method and body, `301`/`302` may be rewritten to `GET` by clients, and `303` forces a `GET`. Redirecting a `POST` with `302` and expecting the body to survive is a common defect.
- `5xx`: `500` for unexpected failures, `501` unimplemented method, `502`/`504` for upstream failure and upstream timeout, `503` for unavailability — with `Retry-After` where the client should back off (§15.6.4).
- Watch for an upstream error being passed through as the upstream's own status (a dependency's `404` surfacing as the endpoint's `404`) — the caller cannot tell which resource was missing.

## Headers

- `Content-Type` must match the actual body, including charset where relevant, on both requests and responses. A JSON error body returned with `text/html` breaks clients.
- `Accept` / content negotiation: if the endpoint claims to negotiate, check that it responds `406` or falls back deliberately.
- `Location` on `201` and on redirects; `Allow` on `405`; `Retry-After` on `429` and `503`.
- `Cache-Control`: user-specific or authenticated responses need `private` or `no-store` (RFC 9111 §5.2). Shared caches must not reuse responses to requests carrying `Authorization` unless the response explicitly allows it (RFC 9111 §3.5) — check that nothing in a CDN or reverse proxy config overrides this.
- `Vary` must list every request header the response content depends on — commonly `Accept`, `Accept-Language`, `Authorization`, `Origin` (RFC 9110 §12.5.5). Missing `Vary: Origin` with per-origin CORS responses is a real cache-poisoning path.
- `ETag` / `Last-Modified` + `If-None-Match` / `If-Modified-Since` for conditional GET; `If-Match` for conditional writes (RFC 9110 §13). A `304` must not carry a body.
- CORS (WHATWG Fetch, not an RFC): `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` is invalid and will be rejected by browsers; reflecting an arbitrary `Origin` with credentials enabled is an access-control vulnerability. Check the preflight response too (`Allow-Methods`, `Allow-Headers`, `Max-Age`).
- Headers that are set but never honoured (an `ETag` that changes on every request, a `Cache-Control` ignored by the framework) are worse than absent ones.

## Contracts and validation

- Validate path params, query params, headers and body at the boundary — type, range, format, length, enum membership — and reject unknown fields where the API promises a strict contract.
- Error responses should be consistent across the API; RFC 9457 `application/problem+json` is a good target but a consistent in-house format is acceptable. What is not acceptable is several different error shapes introduced by the same branch.
- Error bodies must not leak stack traces, SQL, file paths, library versions or internal hostnames.
- Check serialization edge cases: nulls vs omitted fields, numeric precision (IDs and money as strings vs numbers), date/time format and timezone, empty collection vs null.
- Pagination: a new list endpoint without a limit is an availability risk. Check that limits are enforced server-side with a maximum, and that cursor or offset semantics are stable under concurrent writes.
- Breaking changes to an existing endpoint (removed or renamed field, narrowed type, changed status code, new required parameter) need a versioning or deprecation story — check whether existing clients in this repo or its consumers would break.

## Concurrency, caching and reliability

- Lost updates: a read-modify-write across two requests without `If-Match`/ETag, a version column, or a conditional update means the last writer silently wins. Flag it where the data matters.
- Check-then-act inside a handler (existence check followed by insert) needs a unique constraint or a transaction to be correct under concurrent requests.
- Outbound calls need a timeout, and the timeout needs to be shorter than the caller's. Retries must be limited, backed off, and applied only to idempotent operations or operations guarded by an idempotency key.
- Distinguish transport failures (connection refused, timeout) from application errors (a 4xx from the upstream) — they need different handling, and retrying the second is usually wrong.
- Partial failure: when a handler writes to the database and then publishes an event, check what happens if the second step fails.
