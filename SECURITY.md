# Security Policy — MantiqaTiX

## Reporting a vulnerability

Please do not publish exploitable details, credentials, personal data, production URLs containing secrets, or payment/webhook payloads in public issues.

Use GitHub's **Report a vulnerability** action in the repository's Security tab when private vulnerability reporting is available. If that option is unavailable, contact the repository maintainers privately through GitHub before disclosing technical details publicly.

Include:
- affected component, commit or deployed version, and impact;
- minimal reproduction steps using synthetic/test data;
- relevant logs with tokens, keys, customer identifiers, and payment data removed;
- any safe mitigation you have confirmed.

## Handling and response

- Do not test against production accounts, customer data, payment instruments, or third-party provider systems without explicit authorization.
- Do not commit secrets. Rotate any credential that may have been exposed and report the exposure privately.
- Reports are triaged by severity and reproducibility. Acknowledgement and remediation timelines depend on the impact and the evidence provided.
- Security fixes must preserve tenant isolation, least privilege, row-level security, financial idempotency, auditability, and fail-closed release gates.

## Release assurance

A passing source test or disposable-database test is not proof of production deployment. Production changes require reviewed migrations, exact-head CI, relevant runtime verification, rollback planning, and documented release approval.
