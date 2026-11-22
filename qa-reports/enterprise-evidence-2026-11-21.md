# Enterprise capability evidence, November 21, 2026

Server-side GETs returned the production [Enterprise](https://ai.spaincos.com/modules/enterprise-admin.js), [Team](https://ai.spaincos.com/modules/settings-org.js), [Security](https://ai.spaincos.com/modules/settings-security.js), and [Billing](https://ai.spaincos.com/modules/settings-billing.js) modules. Their SHA-256 digests matched `origin/master` at `cc622f9`. This verifies deployed assets, not an authenticated browser flow, backend state, or permissions. No authenticated owner browser was available under the server-only constraint.

| Capability | Result | Evidence and remaining check |
| --- | --- | --- |
| Enterprise frontend delivery | PASS | [Enterprise module](https://ai.spaincos.com/modules/enterprise-admin.js) served from production and matched the repo byte for byte. |
| Admin access | PARTIAL | The [Enterprise module](https://ai.spaincos.com/modules/enterprise-admin.js) checks `whoami` before data requests. Admin access, non-admin rejection and backend enforcement still need separate live accounts to verify. |
| Roster, invites and roles | PARTIAL | The [Team module](https://ai.spaincos.com/modules/settings-org.js) implements roster, invite, remove and role controls. No live roster or invite acceptance was observed. |
| Seats and organization billing | PARTIAL | The [Enterprise module](https://ai.spaincos.com/modules/enterprise-admin.js) counts roster entries and pending invitations. It does not expose purchased seats or usage against an entitlement; [billing](https://ai.spaincos.com/modules/settings-billing.js) is account-scoped. |
| SSO setup in app | FAIL | The [Enterprise module](https://ai.spaincos.com/modules/enterprise-admin.js) only renders a “Not configurable here” card. This does not establish whether any identity-provider configuration exists outside the app. |
| SCIM setup in app | FAIL | The [Enterprise module](https://ai.spaincos.com/modules/enterprise-admin.js) only renders a status card and points to manual Team management. |
| Audit logs and CSV | PARTIAL | The [Enterprise module](https://ai.spaincos.com/modules/enterprise-admin.js) requests the latest 20 account audit entries and exports the visible rows. It is neither an organization-wide security feed nor a complete historical export. No authenticated download was observed. |

## Owner and backend dependencies

- SSO: The owner must choose the IdP, domain, protocol and environment. For OIDC, register the app in the IdP tenant, approve redirect URIs, and configure the issuer, client ID and secret in the authentication service. For SAML, exchange IdP metadata and signing certificates with the service provider and register the service provider entity ID and ACS URL in the IdP. Verify the organization domain, map identities to membership, retain a break-glass owner login and test both permitted and rejected accounts. A deployed status card is not evidence that any registration is complete.
- SCIM: Requires a tenant-scoped SCIM service and provisioning credential, IdP provisioning configuration, mappings, and a test of creation, updates and deactivation. Manual invites are not directory sync.
- Seats and billing: Require authoritative organization entitlements and invoice data with admin-scoped read permissions. Roster size must not be reported as purchased or billable seats.
- Organization audit and full export: Require an organization-scoped event source, verified tenant isolation, and an explicit cursor and retention contract. Browser export of the current account snapshot cannot supply this.

Do not raise the category score from static evidence alone. Resume with read-only checks in a signed-in owner/admin browser, a separate member account to verify denial, and an approved scratch workspace for invite or role mutations.

## Follow-up: bounded account audit export

The Enterprise UI retains its 20-event preview and adds an explicit export of the latest 250 account-visible audit events, using the same signed-in request and no elevated credential. The extra response row detects truncation when the API returns it. The export is not a guarantee of complete history, tenant-wide access, or configurable retention; those capabilities remain unverified. The pane now labels fleet activity as records visible to the current account, not a whole-organization audit trail. A client role check governs UI visibility only; backend permission enforcement must be verified independently.
