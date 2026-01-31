# PR Comments Viewer - VS Code Extension

View GitHub Pull Request review comments directly in your IDE, so you can address them without leaving your development environment.

## Features

- 📝 Fetch PR review comments from GitHub
- 💡 Display comments inline at the appropriate file/line locations
- 🎨 Visual indicators (highlighting + icon) for lines with comments
- 🔍 Hover over highlighted lines to see comment details
- ⚡ Quick commands to fetch and clear comments

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Open the folder in VS Code
5. Press F5 to launch the extension in a new Extension Development Host window

## Configuration

Before using the extension, you need to configure your GitHub Personal Access Token:

1. Generate a GitHub token at https://github.com/settings/tokens
   - Required scopes: `repo` (for private repos) or `public_repo` (for public repos only)
2. In VS Code, go to Settings (File > Preferences > Settings)
3. Search for "PR Comments"
4. Set `prComments.githubToken` to your token

### Available Settings

- `prComments.githubToken`: Your GitHub Personal Access Token
- `prComments.autoFetch`: Automatically fetch PR comments when workspace opens (default: false)

## Usage

### Fetching PR Comments

1. Open a repository that has an active Pull Request
2. Make sure you're on a branch associated with a PR
3. Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
4. Run: `PR Comments: Fetch PR Comments`
5. If the PR number can't be auto-detected from the branch name, you'll be prompted to enter it

### Viewing Comments

- Lines with PR comments will be highlighted with a light yellow background
- A 💬 icon appears at the end of commented lines
- Hover over a highlighted line to see the comment details (author and message)

### Clearing Comments

To remove all comment decorations:
1. Open the Command Palette
2. Run: `PR Comments: Clear Comments`

## How It Works

1. **Repository Detection**: The extension reads your Git configuration to determine the GitHub repository (owner/repo)
2. **PR Number Detection**: It attempts to extract the PR number from your branch name (e.g., `pr-123`, `feature-456`)
3. **Comment Fetching**: Uses GitHub's API to fetch all review comments for the PR
4. **Display**: Shows comments as decorations on the relevant lines in your files

## Branch Naming Conventions

For automatic PR number detection, use one of these patterns:
- `pr-123` or `PR-123`
- `pull-123` or `pull_123`
- `123-feature-name`

If your branch doesn't follow these patterns, you'll be prompted to enter the PR number manually.

## Development

### Building

```bash
npm run compile
```

### Watching for changes

```bash
npm run watch
```

### Linting

```bash
npm run lint
```

## Requirements

- VS Code 1.80.0 or higher
- Node.js 20.x or higher
- A GitHub repository with Pull Requests

## License

MIT