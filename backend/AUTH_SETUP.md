# Authentication setup

The backend serves a shared JWT authentication API under `/api/auth`:

- `POST /register` creates customer accounts only.
- `GET /admin/setup-status` reports whether the one-time first-admin setup is open.
- `POST /admin/bootstrap` creates the first admin only when a private `ADMIN_SETUP_KEY` is configured and no admin account exists.
- `POST /login` accepts email and password and returns a 30-minute JWT plus the account role.
- `GET /me` validates the token and returns the current account.
- `POST /logout` revokes the token session.
- `POST /session/claim` binds the existing storefront `x-session-id` cart to the signed-in customer.

Apply `database/migrations/2026-11-04-authentication.sql` to the configured PostgreSQL database before starting the server. The auth tables are also included in `database/schema.sql` for new installations. Set `JWT_SECRET` to a private random value of at least 32 bytes. Set `FRONTEND_ORIGINS` to the exact comma-separated storefront/admin origins; local defaults are ports 5173 and 5174.

Customer registration never accepts a role field, and the backend checks the current database role on each authenticated request. The first admin can use the guarded `/setup` flow in the admin portal. For additional admins, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the process environment and run `npm run provision-admin`; clear the password environment variable afterward. Use a unique password of at least 12 characters and do not put credentials in source control.

For first-time setup through the admin portal, `ADMIN_SETUP_KEY` is configured in the ignored `backend/.env.local` with a random value of at least 24 bytes. Restart the backend after changing this file. The admin sign-in page links to `/setup`; that page is enabled only while the key is configured and no admin exists. It requires the setup key and an administrator password of at least 12 characters. Creation is serialized in PostgreSQL and the endpoint closes after the first admin is created. The local setup key is in `backend/.env.local`; do not share or commit it. Use the provisioning command above for any additional admins.

Cart, price-lock, and checkout routes require a customer JWT and a valid `x-session-id`. Checkout continues to validate the cart and inventory in its existing database transaction. Admin APIs must use `authenticateToken` and `authorizeRoles("admin")`; the current `/api/admin/access` route demonstrates that protection. Other admin CRUD endpoints are not implemented yet, so the admin dashboard's CRUD screens remain demo-backed.

Both Vite portals use `VITE_API_BASE_URL=http://localhost:5000/api`. The storefront runs at `http://localhost:5173` and the admin portal at `http://localhost:5174`.
