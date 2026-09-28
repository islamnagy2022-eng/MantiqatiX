# RC174 — Education Module Activation

## Source basis
The RC40 source contains `SchoolAndTeacherEngine`, `SchoolAndTeacherWorkspaceScreen`, and `education_requests` flows for school enrollment and private lesson requests.

## Web activation
- Existing `school_profiles`, `teacher_profiles`, and `education_requests` surfaces remain the data source.
- Added customer actions to submit a school application or teacher lesson request.
- Requests use the existing `education_requests` transaction model and RLS; no new education schema was introduced.
- Existing request list remains visible according to current RLS.
- No fake schools, teachers, or requests were created.

## Verification
Source-backed implementation completed. Production browser E2E, school/teacher provider isolation, request approval lifecycle, notification delivery, and payment/commission behavior remain OPEN.
