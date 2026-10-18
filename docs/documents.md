# Verification documents and file storage

Admin review UI: `admin.md`. S3 bucket and orphan state: `PROJECT_STATE.md` §6.

## Purpose
Students upload an identity document (student, pensioner or social card); an admin approves or rejects it. The same storage service also
holds public images (offers, restaurant profiles, avatars).

## Files
- `backend/app/services/storage_service.py`: `StorageService.upload_file(file, folder, private)`, `get_document_access_url`,
  `resolve_private_document`, `delete_document`, `_delete_local`; constants `DOC_URL_TTL_SECONDS=300`, `DOCUMENT_FOLDERS`, `LOCAL_PRIVATE_PREFIX`
- `backend/app/routes/upload_routes.py`: `/api/upload/{user-document, student-id, user-avatar}` (token_required, own account),
  `/api/upload/{offer-image, restaurant-profile}` (restaurant_required plus an ownership check)
- `backend/app/routes/admin_routes.py`: `GET /api/admin/pending` (issues the access links), `GET /api/admin/document-file/<token>`, `POST /api/admin/reject`

## Workflow
1. Upload: `upload_file` writes to S3 key `<folder>/<uuid>.<ext>` and stores the S3 URL in `users.id_document_url`. It sets `document_type`
   and changes `verification_status` to `pending`. Without AWS keys it falls back to local storage:
   - documents go to `backend/private_uploads/<folder>/`, referenced as `local-private://…`
   - public images go to `app/static/uploads/`
2. Admin view: `/pending` returns `doc` as a **5-minute** S3 pre-signed URL, or as a signed local link (itsdangerous, salt `document-access`,
   path-traversal check). The stored raw URL is never sent to the admin.
3. Reject: the DB is cleared first (status `unverified`, url and type set to null) and committed; then `delete_document` removes the file.
   It only deletes inside `id_documents/` or `student_ids/` and returns `deleted | missing | skipped | error`.

## Fields
`users.id_document_url`, `users.document_type` (`student|pensioner|social`, validated on `user-document`), `users.verification_status`, `users.avatar_url`,
`offers.image_url`, `restaurant_profiles.profile_image_url`.

## Rules
- Documents are private (`id_documents/`, `student_ids/`). Public prefixes: `offer_images/`, `restaurant_profiles/`, `avatars/` only (bucket policy).
- `/document-file/<token>` has no JWT on purpose: the signed, expiring token is the credential.
- AWS changes and deleting the historical orphans need the user's explicit approval (project rule).

## Known limitations
- Re-uploading leaves the previous file in storage. This is where the 13 orphans in `id_documents/` came from.
- No file type or size validation. The content type is taken from the client, and there's no `MAX_CONTENT_LENGTH`.
- `str(e)` leaks: when `upload_file` fails, its `message` is `str(e)`, and all 5 upload routes return it with status 500. `/user-document`
  also returns `{error: str(e)}` from its own `except`. That route uses `{error}` bodies rather than the standard `{success, error, message}` shape.
- `to_dict()` returns the raw `id_document_url` to the owner (not usable anonymously because S3 returns 403).
- Mobile image-picker upload screens: NOT TESTED.

## Evidence
- Fixes 7, 14, 15 and 18.
- Tampered, expired and traversal links → 403.
- A rejected object is deleted (S3 404).
- AWS VERIFIED on 2026-09-30: 15 objects in `id_documents/`, all 403 anonymously; the test orphan was deleted.

## Thesis
Chapters 7–10: document access (private prefix, 5-min pre-signed links, deletion on reject, orphan limitation).
