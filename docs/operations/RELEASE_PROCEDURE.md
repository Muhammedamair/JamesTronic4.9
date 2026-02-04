# Release Procedure

> [!IMPORTANT]
> **Security Policy:** All changes to `main` must go through a Pull Request (PR) and pass automated CI checks. Direct pushes to `main` are blocked.

## Workflow

1.  **Create a Feature Branch**
    - `git checkout -b feat/your-feature-name` or `fix/your-bug-fix`

2.  **Develop & Test Locally**
    - Run `npm run build` to ensure no build errors.
    - Run `npm run lint` and `npm run type-check`.
    - Run `npm audit` to check for security vulnerabilities.

3.  **Open a Pull Request (PR)**
    - Target `main` branch.
    - Fill out the PR template/description.
    - **Wait for CI checks**: `build_and_checks` (Build, Lint, Typecheck, Audit) must pass.
    - Request review from a team member.

4.  **Merge**
    - Once approved and checks pass, merge using **Squash and Merge**.
    - Delete the feature branch.

5.  **Production Deployment**
    - Vercel automatically deploys commits merged to `main`.
    - Verify deployment success in Vercel dashboard.

## Hotfixes
Follow the same process. Do not force push to `main` even for hotfixes.
