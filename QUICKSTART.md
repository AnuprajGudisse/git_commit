# Quick Start Guide

Get up and running with PR Comments Viewer in 5 minutes!

## Prerequisites

✅ Node.js 20.x or higher  
✅ VS Code 1.80.0 or higher  
✅ A GitHub repository with Pull Requests  
✅ GitHub Personal Access Token

## Installation Steps

### 1. Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/AnuprajGudisse/git_commit.git
cd git_commit

# Install dependencies
npm install

# Compile the extension
npm run compile
```

### 2. Get Your GitHub Token (1 minute)

**Option A: Fine-grained token (Recommended)**
1. Go to https://github.com/settings/personal-access-tokens/new
2. Give it a name: "PR Comments Viewer"
3. Select specific repository access
4. Grant "Pull requests" read permission
5. Click "Generate token" and copy it

**Option B: Classic token**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Check the `public_repo` or `repo` scope
4. Click "Generate token" and copy it

### 3. Launch Extension (30 seconds)

```bash
# Open in VS Code
code .

# Press F5 to launch Extension Development Host
# A new VS Code window will open with the extension loaded
```

### 4. Configure Token (30 seconds)

In the new VS Code window:

1. Open Settings: `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)
2. Search for: `pr comments`
3. Find `prComments.githubToken`
4. Paste your token
5. Close settings

### 5. Test It Out (1 minute)

1. Open a repository with an active PR
2. Checkout a PR branch (e.g., `git checkout pr-123`)
3. Open Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P`
4. Type: `PR Comments: Fetch PR Comments`
5. Press Enter
6. If prompted, enter the PR number

**You should see:**
- Lines with comments highlighted in yellow
- 💬 icons at the end of commented lines
- Hover over lines to see comment details

## Troubleshooting

### "Please configure your GitHub token"
→ Make sure you saved the token in settings (see Step 4)

### "Could not determine repository information"
→ Make sure you're in a Git repository with a GitHub remote

### "Could not determine PR number"
→ Either name your branch with the PR number (e.g., `pr-123`) or enter it manually when prompted

### No comments appear
→ Check that the PR actually has review comments (not issue comments)

### Extension doesn't load
→ Check the Debug Console in VS Code for errors

## What's Next?

### Try These Features:

1. **Multiple Files**: Open different files from the PR to see their comments
2. **Clear Comments**: Run `PR Comments: Clear Comments` to remove decorations
3. **Auto-fetch**: Enable `prComments.autoFetch` in settings for automatic loading

### Development Workflow:

1. Make changes to `src/extension.ts`
2. Save the file (TypeScript will auto-compile if watch mode is running)
3. Press `Ctrl+R` / `Cmd+R` in Extension Development Host to reload
4. Test your changes

### Run in Watch Mode:

```bash
npm run watch
```

This automatically recompiles when you save changes.

## Common Use Cases

### Case 1: Address PR Feedback
1. Fetch PR comments
2. See all comments in context
3. Fix issues directly in IDE
4. Commit and push changes
5. Clear comments when done

### Case 2: Review Your Own PR
1. Create a PR on GitHub
2. Add review comments to your own code
3. Fetch comments in IDE
4. Use as a checklist while refactoring

### Case 3: Team Code Review
1. Teammate adds comments to your PR
2. You pull latest changes
3. Fetch comments
4. Address feedback without switching to browser
5. Respond on GitHub when done

## Tips & Tricks

💡 **Branch Naming**: Name branches `pr-123-feature-name` for auto-detection  
💡 **Keyboard Shortcut**: Assign a custom keybinding to fetch comments  
💡 **Multiple PRs**: Switch branches and fetch different PR comments  
💡 **Token Security**: Use fine-grained tokens with minimal permissions  
💡 **Workspace Settings**: Store token in user settings, not workspace

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check [VISUAL_GUIDE.md](VISUAL_GUIDE.md) for UI screenshots
- Review [IMPLEMENTATION.md](IMPLEMENTATION.md) for technical details
- See [CHANGELOG.md](CHANGELOG.md) for version history

## Get Help

- Check existing GitHub issues
- Review the documentation files
- Enable VS Code's Developer Tools for debugging

---

**🎉 Congratulations!** You're now ready to use PR Comments Viewer to streamline your code review workflow.
