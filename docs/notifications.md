# Notifications (FCM push and in-app inbox)

## Purpose
Tell students about new offers (push + a stored inbox row) and tell restaurants when a claim is verified (push only).

## Files
- `backend/app/services/notification_service.py`: Firebase Admin init (`backend/firebase-service-account.json`),
  `send_push_notification`, `notify_students_new_offer(offer_data)`, `notify_restaurant_claim_verified(owner, student_name)`
- Callers: `QRService.create_offer` (once, fix 13) and `QRService.verify_claim_qr` (see `claims.md`, `qr.md`)
- Inbox API (`backend/app/routes/student_routes.py`, fix 19, 2026-09-30), both `@token_required`:
  - `GET /api/notifications`: only `g.user.id`'s rows, `created_at DESC, id DESC`, max 50 →
    `{success, notifications: [{id, title, message, is_read, date}]}` (`Notification.to_dict`)
  - `POST /api/notifications/read`: one conditional UPDATE marks the caller's unread rows read → `{success, updated}`
- Token registration: `POST /api/auth/fcm-token` → `AuthService.update_fcm_token` (raw SQL, own user only)
- Mobile:
  - `src/api/notifications.ts` (`notificationsApi.getMine`, `markAllRead`, `NotificationDTO`)
  - `screens/student/profile/ProfileScreen.tsx` (`fetchNotifications` when the modal opens), `components/NotificationModal.tsx` (list + empty state `no_notifications`)
  - `App.tsx` (foreground `onMessage` → in-app alert), `src/context/AuthContext.tsx` (FCM sync after login)

## Workflow
- New offer: for every user with `role='student'`, send a push if an `fcm_token` exists **and** insert a `notifications` row. Title: "New Offer from <restaurant_name>!". One commit at the end.
- Inbox: opening Profile → NOTIFICATIONS calls `GET /api/notifications`, shows the rows (a dot for unread ones), then calls `POST /read` if any were unread.
  So dots are visible on this opening and cleared on the next.
- Claim verified: push only (no DB row) to the restaurant owner's token.

## Tables
`notifications` (`user_id`, `title`, `message`, `is_read`, `created_at`) · `users.fcm_token`.

## Rules
- The inbox is keyed only on the JWT identity. Query/body `user_id` is ignored (edge test `test_notifications_ignore_client_supplied_user_id`).
- A suspended account gets 403 on both inbox routes (see `auth.md`).

## Known limitations
- Only role `student` gets stored notifications. App-registered students (role `user`) get nothing, and restaurants get push only.
- No per-item read state (everything is marked read on opening), no deletion, no pagination beyond 50, no badge counter.
- The FCM token isn't cleared on logout. Every account that logged in on a device keeps the same token (all emulator accounts share one).
- Sending is synchronous inside the create-offer request. Failures are logged and swallowed.
- `created_at` comes from the DB's `CURRENT_TIMESTAMP` (DB time zone), unlike the UTC `utcnow()` used elsewhere, and is shown as stored.

## Evidence
- Fix 13: 16 → 8 rows for 8 students.
- Fix 19 (2026-09-30), TESTED + DATABASE VERIFIED:
  - own rows only, newest first
  - anonymous 401
  - `user_id` spoofing ignored
  - mark-read touches only the caller
  - push log unchanged ("sent push notifications to 1 students")
- Emulator screenshots `thesis_evidence/2026-09-30/screenshots/n01_inbox_student_A.png` and `n02_inbox_student_B.png`.
  Details in PROJECT_STATE §4; tests: `tests/smoke` (`test_student_can_list_own_notifications`, anonymous 401) and `tests/edge`.

## Thesis
Describe the inbox as implemented and tested (2026-09-30): it lists the user's stored new-offer notifications and marks them read on opening.
Don't claim per-item read tracking, restaurant inbox rows or notifications for role `user`.
