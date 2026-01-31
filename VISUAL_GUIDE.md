# Visual Guide

## What the Extension Looks Like

This guide describes the visual appearance of the PR Comments Viewer extension.

### 1. Lines with Comments

When you fetch PR comments, any line that has a review comment will be visually marked:

**Visual Indicators:**
- 🎨 **Background Highlighting**: Light yellow/amber background color (`rgba(255, 200, 0, 0.2)`)
- 💬 **Icon Marker**: A comment emoji (💬) appears at the end of the line
- 📊 **Overview Ruler**: An orange marker appears in the scrollbar overview ruler on the right side

### 2. Hover Tooltip

When you hover your mouse over a highlighted line, you'll see a tooltip showing:

```
**@username:**

Comment text goes here. This might be multiple
lines explaining what the reviewer wants changed.
```

The tooltip uses Markdown formatting with:
- Bold username prefixed with @
- Comment body text below

### 3. Command Palette

Access the extension through VS Code's Command Palette (Ctrl+Shift+P or Cmd+Shift+P):

```
> PR Comments: Fetch PR Comments
> PR Comments: Clear Comments
```

### 4. Settings

In VS Code Settings (search for "PR Comments"):

```
PR Comments: Github Token
  Configure your GitHub Personal Access Token
  [empty text box]

PR Comments: Auto Fetch
  Automatically fetch PR comments on workspace open
  [ ] (checkbox - unchecked by default)
```

### 5. Status Messages

**When fetching comments:**
- Info message: "Fetching PR #123 comments..."
- Success message: "Loaded 15 PR comments"

**When prompted for PR number:**
- Input box: "Enter PR number"
- Placeholder: "123"

**Errors:**
- "Please configure your GitHub token in settings (prComments.githubToken)"
- "Could not determine repository information. Make sure you are in a Git repository."
- "Could not determine PR number. Make sure you are on a PR branch."
- "Error fetching PR comments: [error details]"

### Example Scenario

#### Before Fetching Comments
```javascript
function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    return total;
}
```

#### After Fetching Comments (Line 2 has a review comment)
```javascript
function calculateTotal(items) {
    let total = 0;                          💬  ← icon appears
    ^^^^^^^^^^^^^ (highlighted in light yellow)
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    return total;
}
```

**Hover tooltip appears when mouse is over line 2:**
```
┌─────────────────────────────────────────────┐
│ **@reviewer123:**                           │
│                                             │
│ Consider using const instead of let here   │
│ for better immutability since the value    │
│ is reassigned in the loop.                 │
└─────────────────────────────────────────────┘
```

### Color Scheme

The extension uses colors that work with most VS Code themes:

- **Highlight color**: `rgba(255, 200, 0, 0.2)` - Semi-transparent amber
- **Overview ruler**: `orange` - Solid orange
- **Icon color**: `orange` - Matches the overview ruler

These colors are intentionally mild to avoid being too distracting while still being clearly visible.

## User Workflow

1. **Open a repository** with an active Pull Request
2. **Configure GitHub token** in VS Code settings (one-time setup)
3. **Checkout a PR branch** (e.g., `pr-123` or `feature-456`)
4. **Open Command Palette** (Ctrl+Shift+P / Cmd+Shift+P)
5. **Run**: "PR Comments: Fetch PR Comments"
6. **View highlighted lines** in your files
7. **Hover over lines** to read comments
8. **Address the feedback** by editing the code
9. **Clear comments** when done (optional)

## Notes

- Comments are only displayed for files that are currently tracked in the PR
- Line numbers are synchronized between GitHub and VS Code (accounting for 0-based vs 1-based indexing)
- If you edit the file, the decorations remain on the original line numbers
- Decorations are client-side only and don't modify your files
- Comments persist until you clear them or restart VS Code
