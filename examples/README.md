# Example Usage

This directory contains example files to demonstrate the PR Comments Viewer extension.

## Setup

1. Make sure you have configured your GitHub token in VS Code settings
2. Create a Pull Request in your repository
3. Add review comments to specific lines in the files
4. Open this workspace in VS Code
5. Run `PR Comments: Fetch PR Comments` from the Command Palette

## What to Expect

- Lines with PR comments will be highlighted with a light yellow background
- A 💬 icon appears at the end of commented lines
- Hover over the highlighted line to see the reviewer's comment

## Example Scenario

Imagine you have the following review comment on line 5 of `example.js`:
- **@reviewer:** "Consider using const instead of let here for better immutability"

When you fetch PR comments:
1. Line 5 will be highlighted
2. A 💬 icon will appear at the end of the line
3. Hovering over line 5 will show: **@reviewer:** Consider using const instead of let here for better immutability
