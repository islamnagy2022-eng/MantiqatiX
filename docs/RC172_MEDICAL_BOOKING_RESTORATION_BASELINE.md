# RC172 — Medical Booking Contract Restoration

## Source basis
The RC40 archive contains the Medical/Clinics production contract for `medical_appointments`, including customer booking, clinic appointment/queue handling, cloud persistence through `SupabaseMedicalEngine`, and owner appointment management. The source explicitly protects legacy EMR/encounter/lab concepts from the primary owner workspace.

## Production restoration
- Restored `public.medical_appointments` as the cloud appointment transaction boundary.
- Added RLS for patient self-read and active provider/owner same-tenant business read.
- Direct client insert/update/delete is revoked.
- Added authenticated backend functions for appointment creation and status updates.
- Appointment creation validates the active provider profile, tenant membership, duplicate appointment ID, and doctor-slot collision.
- Status mutation is server-authoritative.

## Web runtime
- Medical module now uses the existing `marketing_provider_profiles` discovery surface plus `medical_appointments`.
- Customer can request an appointment from an active provider profile.
- Provider/owner roles can confirm/complete appointments.
- Customer/provider can cancel within the backend authorization boundary.
- No EMR, diagnosis AI, encounter notes, prescription records, or lab-result UI was exposed.

## Verification
- Migration applied successfully in production.
- Anonymous EXECUTE on booking/update functions is false.
- Authenticated booking EXECUTE is true by design.
- Current production has no active provider profiles, so no fake medical provider or appointment data was created.
- Browser E2E, two-user booking isolation, notification flow, payment/commission settlement, and mobile Room/cloud sync remain OPEN.
