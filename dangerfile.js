import { danger, warn, fail, message } from 'danger'

export default async function () {
  // GitHub metadata
  const pr = danger.github.pr
  const commits = danger.github.commits
  const reviews = danger.github.reviews

  // Check if PR has a description
  if (pr.body.length < 10) {
    fail('Please provide a meaningful description for this PR.')
  }

  // Check for any changes to sensitive files
  const sensitiveFiles = [
    '.env*',
    '*.key',
    '*.pem',
    'config/*',
    'src/lib/supabase.ts',
    'src/lib/supabase-service.ts',
    'middleware.ts',
    'next.config.ts'
  ]

  const modifiedSensitiveFiles = danger.git.modified_files.filter(file =>
    sensitiveFiles.some(pattern => new RegExp(pattern.replace('*', '.*')).test(file))
  )

  if (modifiedSensitiveFiles.length > 0) {
    warn(`This PR modifies sensitive files: ${modifiedSensitiveFiles.join(', ')}`)
  }

  // Check for package.json changes to ensure proper review
  const hasPackageChanges = danger.git.modified_files.includes('package.json')
  if (hasPackageChanges) {
    warn('package.json has changed, please ensure dependencies are properly reviewed')
  }

  // Check for new dependencies
  if (commits.some(commit => commit.message.includes('Add') && commit.message.toLowerCase().includes('dependency'))) {
    message('New dependencies were added, please verify their security and licensing')
  }

  // Check for changes to core files that require special review
  const coreFiles = [
    'src/components/supabase-provider.tsx',
    'src/lib/technician-store.ts',
    'src/app/layout.tsx',
    'middleware.ts'
  ]

  const modifiedCoreFiles = danger.git.modified_files.filter(file => coreFiles.includes(file))
  if (modifiedCoreFiles.length > 0) {
    warn(`This PR modifies core functionality: ${modifiedCoreFiles.join(', ')}. Please ensure thorough testing.`)
  }

  // Check if PR touches PWA files
  const pwaFiles = danger.git.modified_files.filter(file =>
    file.includes('sw.js') ||
    file.includes('manifest.json') ||
    file.includes('service-worker') ||
    file.includes('pwa')
  )

  if (pwaFiles.length > 0) {
    message(`🔧 This PR modifies PWA functionality. Please ensure offline capabilities work correctly.`)
  }

  // Check for environment variable changes
  const envVarChanges = danger.git.modified_files.filter(file =>
    file.includes('.env') || file.includes('env.')
  )

  if (envVarChanges.length > 0) {
    fail(`Environment variable files have been modified. These should never be committed with actual values.`)
  }

  // Check for potential secret leaks
  const allModifiedFiles = [...danger.git.modified_files, ...danger.git.added_files]
  const fileContents = await Promise.all(
    allModifiedFiles.map(file => danger.github.utils.fileContents(file))
  )

  fileContents.forEach((content, index) => {
    if (content) {
      // Check for potential API keys, secrets, etc.
      const possibleSecrets = [
        /(?:^|\s)password(?:\s*[:=]|:)/gi,
        /(?:^|\s)secret(?:\s*[:=]|:)/gi,
        /(?:^|\s)token(?:\s*[:=]|:)/gi,
        /(?:^|\s)key(?:\s*[:=]|:)/gi,
        /^[a-zA-Z0-9+/]{86}==$/gm, // Base64-like strings that might be JWTs
        /^ey[a-zA-Z0-9._-]+\.ey[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$/gm // JWT pattern
      ]

      possibleSecrets.forEach((pattern, patternIndex) => {
        if (pattern.test(content)) {
          fail(`Possible secret detected in ${allModifiedFiles[index]} at line matching: ${pattern}`)
        }
      })
    }
  })

  // Check for test files
  const testFiles = danger.git.modified_files.filter(file =>
    file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')
  )

  if (danger.git.modified_files.length > 5 && testFiles.length === 0) {
    warn('This PR has many changes but no test modifications. Consider adding tests.')
  }

  // Check that the PR title follows conventional commits
  const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:\s.+/
  if (!conventionalCommitRegex.test(pr.title)) {
    warn('Please follow conventional commit format for PR title: type(scope): description')
  }

  // Check if any files were deleted
  if (danger.git.deleted_files.length > 0) {
    message(`🗑️ This PR deletes ${danger.git.deleted_files.length} file(s): ${danger.git.deleted_files.slice(0, 5).join(', ')}${danger.git.deleted_files.length > 5 ? '...' : ''}`)
  }

  // Check for changes to the supabase folder
  const supabaseChanges = danger.git.modified_files.filter(file => file.includes('supabase/'))
  if (supabaseChanges.length > 0) {
    warn(`This PR includes changes to Supabase configuration. Please ensure migration compatibility: ${supabaseChanges.join(', ')}`)
  }
}