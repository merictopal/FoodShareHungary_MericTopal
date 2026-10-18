"""Constants shared by several routes/services."""

# Student accounts: every new student is stored as 'student' (app registration and Google sign-in alike);
# 'user' is the legacy alias still held by accounts registered in the app before 2026-10-08.
STUDENT_ROLES = ('student', 'user')
