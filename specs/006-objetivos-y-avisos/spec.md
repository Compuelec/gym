# Feature Specification: Objetivos con el coach y avisos de la PWA

**Feature Branch**: `006-objetivos-y-avisos`
**Created**: 2026-11-23
**Status**: Implemented (pending review by Carlos)
**Input**: «que el usuario pueda poner sus datos como peso, edad, estatura, peso objetivo, la IA pueda
darle rutinas para lograr ese objetivo y también crear un plan de seguimiento, análisis de su progreso…
enviar las notificaciones de recordatorio de entrenamiento y mensajes para cuando esté en una rutina,
así sepa cuándo termina el tiempo de descanso y cuándo empieza».
Clarified answers: all body data (weight, height, age, target weight + date, sex, daily activity,
injuries); follow-up weekly and on demand; every notification type.

## User Scenarios

### US1 — My goal (P1)
A person enters weight, height, age, sex, daily activity, injuries, target weight and target date
(Perfil → Mi objetivo, or the home card). The app shows BMI and the weekly change needed, telling
whether that pace is healthy, demanding or too fast — **without AI**. A changed current weight is
also stored as a progress entry.

**Acceptance**: 80 kg → 74 kg in 12 weeks shows «bajar unos 0,5 kg por semana… ritmo saludable»;
3 weeks shows «demasiado rápido»; impossible values (height 17 cm) are not saved; data reaches the
server only for its owner.

### US2 — Coach toward the goal (P2, only with the AI enabled)
The coach receives the goal, body data, injuries and the 12-week weight trend. Shortcuts «Plan para
lograr mi objetivo» and «Analizar mi progreso». Programs respect injuries and put cardio last; reviews
say whether the person is on track. No diets or calorie numbers; health topics carry the referral note.

### US3 — Rest alerts (P1)
During a workout: 10 s before the rest ends («Quedan 10 s de descanso — Prepárate: Serie 2 de 3 ·
Remo») and at the end, naming the next set or the next exercise. In the app (vibration/sound) and, with
push enabled, with the screen locked (server push; the end replaces the warning).

### US4 — Training reminder (P2)
Days of the week and a time; sent within 90 min after that local time, once a day, **not** if the
person already trained (or is training) that local day.

### US5 — Weekly summary (P3)
Sunday from 19:00 local time: «Entrenaste N de M días», weight change; when the AI is on, it also
queues the automatic progress review (counts toward the daily limit).

## Requirements
- FR-001 Profile fields: heightCm 100–250, targetWeightKg 25–400, targetDate (ISO date), activityLevel
  (sedentary|light|moderate|high), injuries ≤ 300 chars, reminderDays (0–6), reminderTime HH:MM,
  timeZone (valid IANA), weeklySummary. Validated on the server (sync schema).
- FR-002 Goal maths are local and explainable (`@gym/engine` goals.ts): losing ≤ 0.75 %/week ok,
  ≤ 1 % demanding; gaining ≤ 0.25 kg/week ok, ≤ 0.5 demanding.
- FR-003 Health data is sent only to the AI provider for the owner's own request and never logged.
- FR-004 Notifications are idempotent per (person, kind, local day) (`notification_log`).
- FR-005 All queries filter by the owner.

## Success criteria
- SC-001 Unit, end-to-end (4 browsers) and live browser tests cover US1, US3 (server rows), US4, US5.
