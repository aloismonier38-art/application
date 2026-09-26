# Database

TeamHub is designed around PostgreSQL with authentication and file storage.

## Recommended stack

- PostgreSQL
- Auth provider
- Object storage for technical documents
- Row-level security / server-side authorization

The SQL schema in `schema.sql` is compatible with Supabase/PostgreSQL.

## Main entities

- `establishments` — restaurants / sites
- `profiles` — users and roles
- `documents` — technical sheets
- `tasks` — to-do list
- `task_completions` — completion history
- `requests` — interventions and material requests
- `reports` — weekly reports
- `notifications` — in-app notifications

## Roles

- admin
- manager
- employee

The next integration step is to connect the frontend to the database and authentication service. No database credentials are stored in GitHub.
