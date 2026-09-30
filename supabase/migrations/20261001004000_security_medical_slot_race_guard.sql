-- Prevent concurrent booking races for the same active doctor/time slot.
create unique index if not exists uq_medical_appointment_active_doctor_slot
on public.medical_appointments (doctor_id, date_time)
where status not in ('CANCELLED','COMPLETED');
