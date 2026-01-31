# Changelog

All notable changes to the "PR Comments Viewer" extension will be documented in this file.

## [0.1.0] - 2026-01-31

### Added
- Initial release of PR Comments Viewer extension
- Fetch GitHub PR review comments via GitHub API
- Display comments as inline decorations with visual indicators
- Hover tooltips showing comment author and message
- Automatic PR number detection from branch names
- Manual PR number input fallback
- Configuration options for GitHub token and auto-fetch
- Support for both classic and fine-grained GitHub tokens
- Commands:
  - `PR Comments: Fetch PR Comments` - Retrieve and display PR comments
  - `PR Comments: Clear Comments` - Remove all comment decorations
- Documentation:
  - Comprehensive README with setup and usage instructions
  - Implementation details document
  - Example files demonstrating the extension
- Development tools:
  - TypeScript configuration
  - ESLint for code quality
  - VS Code launch and task configurations

### Security
- CodeQL analysis: No vulnerabilities detected
- Token stored in user settings (not in workspace)
- Read-only API access to pull requests
- Recommendation to use fine-grained tokens

### Technical
- Built with TypeScript 5.0
- Uses Octokit REST API for GitHub integration
- VS Code API 1.80.0 compatibility
- Full type safety with strict mode enabled
