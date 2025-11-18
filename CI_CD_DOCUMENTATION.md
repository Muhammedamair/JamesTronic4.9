# JamesTronic CI/CD Pipeline Documentation

## Overview

This document details the enterprise-grade CI/CD pipeline implemented for the JamesTronic PWA application. The pipeline includes automated testing, validation, preview deployments, production deployments with rollback capabilities, and comprehensive security scans.

## GitHub Actions Workflows

### 1. CI Core Checks (`ci-core.yml`)

This workflow runs on every push and pull request to main, develop, and staging branches. It includes:

- Dependency installation with caching
- Lint checking using ESLint
- TypeScript type checking
- Next.js build validation
- Service worker validation
- PWA manifest validation
- Unused import checks
- Environment variable completeness verification
- Artifact generation for downstream jobs

### 2. Supabase Validation (`supabase-validate.yml`)

Validates Supabase-related components:

- Migration syntax validation
- RLS policy validation
- Edge Functions compilation
- Database schema validation
- Local Supabase instance testing

### 3. Preview Deployment (`preview-deploy.yml`)

Automatically creates preview deployments for pull requests:

- Triggers on pull request open/synchronize
- Deploys to Vercel preview environment
- Posts deployment URL as PR comment
- Validates preview accessibility
- Reports status back to GitHub

### 4. Production Deployment (`deploy-production.yml`)

Handles production deployments from the main branch:

- Runs only on pushes to main branch
- Performs production build and deployment
- Executes smoke tests post-deployment
- Implements automatic rollback on failure
- Sends notifications to Slack/Telegram

### 5. Security Scan (`security-scan.yml`)

Performs comprehensive security checks:

- Secret scanning with TruffleHog
- Dependency vulnerability scanning
- CodeQL analysis
- Pattern-based secret detection
- SBOM generation

## PR Protection Rules (Danger.js)

The following PR protection rules are enforced:

- PR must have a meaningful description (>10 characters)
- Changes to sensitive files trigger warnings
- Environment variable file changes are blocked
- Changes to core functionality require special review
- Potential secrets are detected and blocked
- Conventional commit format enforcement
- Test coverage recommendations

## Branch Protection Rules

The following branch protection rules should be configured in GitHub:

### Main Branch:
- Require pull request reviews before merging
- Require status checks to pass before merging (all CI workflows)
- Require branches to be up to date before merging
- Restrict who can push to matching branches

### Develop/Staging Branches:
- Require pull request reviews before merging
- Require status checks to pass before merging
- Restrict who can push to matching branches

## Vercel Configuration

### Production Environment:
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `out` (for Next.js)
- Install command: `npm ci`

### Preview Environment:
- Preview deployments enabled for all PRs
- Build cache optimized
- Environment variables configured per environment

## Environment Variables Setup

### GitHub Secrets Required:
- `VERCEL_TOKEN` - Vercel account token
- `VERCEL_ORG_ID` - Vercel organization ID  
- `VERCEL_PROJECT_ID` - Vercel project ID
- `SLACK_WEBHOOK_URL` - Slack notification webhook
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Telegram chat ID

### Vercel Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VAPID_PUBLIC_KEY` - VAPID public key for web push
- `VAPID_PRIVATE_KEY` - VAPID private key for web push
- `VAPID_SUBJECT` - VAPID subject for web push

## Deployment Process

### Preview Deployments:
1. Developer opens pull request to main branch
2. `preview-deploy.yml` workflow triggers
3. Vercel creates preview deployment
4. Deployment URL posted as PR comment
5. Automated validation confirms deployment health
6. PR can be reviewed with live preview

### Production Deployments:
1. PR to main branch is merged
2. `deploy-production.yml` workflow triggers
3. Code is built and deployed to production
4. Smoke tests verify deployment health
5. Notifications sent to Slack/Telegram
6. If smoke tests fail, manual rollback process initiated

## Rollback Process

In case of production deployment failure:

1. The `rollback` job in `deploy-production.yml` is triggered automatically
2. Notifications are sent to Slack/Telegram about the failure
3. Manual intervention required to either:
   - Fix the issue and redeploy
   - Roll back to previous known good version using Vercel UI

## Security Measures

### Secret Detection:
- TruffleHog scans all commits for exposed secrets
- Pattern-based detection for API keys, tokens, passwords
- Base64/JWT pattern detection
- Blocking of commits with potential secrets

### Dependency Security:
- Automatic dependency vulnerability scanning
- npm audit integration
- SBOM generation for supply chain tracking

### Access Control:
- Environment-specific secrets management
- No hardcoded credentials in codebase
- Proper key rotation procedures

## Development Workflow

1. Create feature branch from develop
2. Make changes and commit with conventional commit format
3. Open pull request to main branch
4. CI workflows execute and validate changes
5. Preview deployment created automatically
6. PR reviewed and tested against preview
7. PR merged to main triggers production deployment
8. Post-deployment notifications sent

## Monitoring and Notifications

- Slack notifications for successful deployments
- Telegram notifications for deployment status
- GitHub commit status updates
- PR comments with preview URLs
- Failure notifications with rollback instructions

## Maintenance and Updates

### Regular Maintenance:
- Dependency updates and security patches
- Workflow updates to use latest action versions
- Secret rotation as per security policy
- Vercel build cache optimization

### Emergency Procedures:
- Hotfix branch for critical issues
- Manual rollback process
- Notification system verification
- Security incident response

## Performance Optimization

The CI/CD pipeline includes several performance optimizations:

- Dependency caching across workflow runs
- Parallel job execution where possible
- Concurrency controls to prevent resource conflicts
- Efficient artifact management
- Optimized build steps with early failure detection

## Troubleshooting

### Common Issues:

1. **Build failures**: Check dependency cache and environment variables
2. **Preview deployment failures**: Verify Vercel project configuration
3. **Security scan failures**: Review and remove any exposed secrets
4. **Notification failures**: Verify webhook URLs and tokens

### Debugging Steps:

1. Check GitHub Actions logs for detailed error messages
2. Verify environment variable configurations
3. Confirm Vercel project settings
4. Review notification service configurations

## Best Practices

- Always use feature branches for development
- Write meaningful commit messages following conventional format
- Ensure proper test coverage before merging
- Review all changes in preview deployments
- Monitor production deployment notifications
- Maintain updated documentation for changes
- Regular security audits of the pipeline

## Contact and Support

For CI/CD related issues, contact the DevOps team or refer to the GitHub Actions documentation.