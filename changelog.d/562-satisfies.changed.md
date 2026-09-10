**Adapter policy objects now publish their concrete types** — every `AdapterPolicy` export in
`@debugmcp/shared` was declared with a type annotation (`export const GoAdapterPolicy:
AdapterPolicy = {…}`), which widened the object literal to the interface. Consumers therefore saw
every optional member as possibly-`undefined` even when the policy plainly implements it, and saw
each method's declared arity rather than its real one. The exports now use `satisfies`, so
conformance is still checked but the concrete shape survives into the published declarations.
`getPolicyForLanguage()` still returns the widened `AdapterPolicy`, so code that works against the
interface is unaffected (issue #562).
