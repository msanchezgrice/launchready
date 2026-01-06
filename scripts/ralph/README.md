# Ralph - Autonomous AI Coding Loop

Ralph is an autonomous AI agent that ships features while you focus on other work. It runs Claude Code repeatedly until all tasks are complete, with memory persisting via git history and text files.

## Quick Start

1. **Edit your user stories** in `prd.json`
2. **Run Ralph:** `./scripts/ralph/ralph.sh 25`
3. **Monitor progress:** Check `progress.txt` or git log

## How It Works

Ralph runs in iterations:
1. Reads `prd.json` for next uncompleted story
2. Implements that ONE story
3. Runs typecheck + tests
4. Commits if passing
5. Marks story complete
6. Logs learnings to `progress.txt`
7. Repeats until all stories pass

## File Structure

```
scripts/ralph/
├── ralph.sh          # The bash loop
├── prompt.md         # Instructions for each iteration
├── prd.json          # Your user stories/tasks
├── progress.txt      # Learnings log
└── README.md         # This file
```

## Setting Up Your PRD

Edit `prd.json` to define your feature:

```json
{
  "branchName": "ralph/your-feature",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add login form",
      "acceptanceCriteria": [
        "Email and password fields",
        "Validates email format",
        "npm run typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

### Story Guidelines

**✓ Good stories (right size):**
- "Add login form with email/password fields"
- "Add email validation to login form"
- "Add error handling for failed login"

**✗ Too big:**
- "Build entire authentication system"
- "Add user management with roles and permissions"

**Key principles:**
- Must fit in one context window
- Clear, measurable acceptance criteria
- Can be implemented and tested in one iteration
- Priority 1 = highest (do first)

## Running Ralph

### Basic usage:
```bash
./scripts/ralph/ralph.sh 25
```

This runs up to 25 iterations. Ralph stops early if all stories pass.

### Monitor progress:
```bash
# Watch story status
cat scripts/ralph/prd.json | jq '.userStories[] | {id, title, passes}'

# View learnings
cat scripts/ralph/progress.txt

# Check commits
git log --oneline -10
```

## Success Factors

### 1. Small, Focused Stories
Each story should be completable in one iteration. Break large features into small steps.

### 2. Explicit Acceptance Criteria
Be specific about what "done" means:

```json
"acceptanceCriteria": [
  "Email field validates format with regex",
  "Shows 'Invalid email' error message",
  "Error disappears when valid email entered",
  "npm run typecheck passes",
  "npm test passes"
]
```

### 3. Fast Feedback Loops
Ralph needs quick validation:
- Typecheck must pass
- Tests must pass
- Build must succeed

Without these, broken code compounds across iterations.

### 4. Learnings Compound
By story 10, Ralph knows patterns from stories 1-9.

Ralph updates two places:
- **progress.txt** - Session memory (patterns, gotchas)
- **AGENTS.md** - Permanent docs (when patterns are discovered)

## Monitoring Ralph

Ralph is autonomous, but you can check in:

```bash
# Terminal 1: Run Ralph
./scripts/ralph/ralph.sh 25

# Terminal 2: Watch git
watch -n 5 'git log --oneline -5'

# Terminal 3: Watch stories
watch -n 5 'cat scripts/ralph/prd.json | jq ".userStories[] | {id, passes}"'
```

## Stopping Ralph

Ralph stops automatically when:
- All stories have `passes: true`
- Maximum iterations reached
- Tests/typecheck fail repeatedly

You can also Ctrl+C to stop manually.

## Troubleshooting

### Ralph keeps failing tests
- Check if tests are flaky
- Verify test setup in package.json
- Add test patterns to progress.txt

### Ralph isn't following patterns
- Add clearer patterns to top of progress.txt:
```markdown
## Codebase Patterns
- API routes: Use Next.js route handlers in app/api/
- Types: Export from types/ directory
- Validation: Use zod schemas
```

### Story too complex
Break it into smaller stories in prd.json:
```json
// Instead of:
{"id": "US-001", "title": "Build auth system"}

// Do:
{"id": "US-001", "title": "Add login form UI"}
{"id": "US-002", "title": "Add form validation"}
{"id": "US-003", "title": "Add auth API endpoint"}
{"id": "US-004", "title": "Connect form to API"}
```

### Ralph creates wrong implementation
- Add more specific acceptance criteria
- Add relevant patterns to progress.txt
- Include example code in story description

## When NOT to Use Ralph

- Exploratory work (researching solutions)
- Major refactors without clear criteria
- Security-critical code needing human review
- Work requiring architectural decisions

Ralph excels at:
- Well-defined features with clear criteria
- Repetitive implementation work
- Building from clear specifications
- CRUD operations and forms

## Best Practices

1. **Start with detailed progress.txt**
   - Document existing patterns
   - List key files and their purposes
   - Note conventions and gotchas

2. **Write atomic stories**
   - One clear purpose per story
   - Independent of other stories when possible
   - Can be tested and committed separately

3. **Include verification steps**
   ```json
   "acceptanceCriteria": [
     "Feature works in dev: npm run dev",
     "Verify at http://localhost:3000/your-page",
     "npm run build succeeds",
     "npm test passes"
   ]
   ```

4. **Update patterns as you learn**
   - Add to progress.txt immediately
   - Keep patterns at the top for visibility
   - Be specific and actionable

5. **Review before pushing**
   - Check git log after Ralph finishes
   - Review commits: `git log --stat`
   - Test manually before merging

## Example Session

```bash
# 1. Setup your stories in prd.json
vim scripts/ralph/prd.json

# 2. Run Ralph (go grab coffee)
./scripts/ralph/ralph.sh 25

# 3. Review results
git log --oneline -10
cat scripts/ralph/progress.txt

# 4. Test manually
npm run dev
# Visit http://localhost:3000 and verify

# 5. Push to GitHub
git push origin ralph/your-feature

# 6. Create PR
gh pr create --fill
```

## Tips

- **First run:** Keep it simple (3-5 stories max) to verify setup
- **Complex features:** Break into multiple Ralph sessions
- **Dependencies:** Order stories by dependency (login before dashboard)
- **Blocked stories:** Mark priority very high (0) to force next
- **Learning curve:** Ralph gets better as progress.txt grows

## Support

If Ralph gets stuck:
1. Check the last commit message
2. Read the error in terminal output
3. Review acceptance criteria for clarity
4. Check if tests/typecheck are passing locally
5. Simplify the current story and try again

Happy autonomous shipping! 🚀
