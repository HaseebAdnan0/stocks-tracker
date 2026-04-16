param(
    [Parameter(Position = 0)]
    [string]$PRDFile = "PRD.md",

    [Parameter(Position = 1)]
    [string]$ProgressFile = "progress.txt",

    [Parameter(Position = 2)]
    [int]$MaxIterations = 10,

    [int]$SleepSeconds = 2,
    [int]$TimeoutMinutes = 30,
    [string]$Model = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Safety check: Ensure the PRD file exists before starting
if (-not (Test-Path $PRDFile)) {
    Write-Error "The PRD file '${PRDFile}' was not found. Please create it or specify a valid path."
    exit 1
}

Write-Host "Starting Ralph - Max $MaxIterations iterations"
Write-Host "Target PRD: $PRDFile"
Write-Host "Target Progress: $ProgressFile"
Write-Host ""

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host "==========================================="
    Write-Host "  Iteration $i of $MaxIterations"
    Write-Host "==========================================="

    # Using ${VarName} syntax to prevent colons (:) from breaking the parser
    $prompt = @"
You are Ralph, an autonomous coding agent. Complete ONE User Story per iteration.

## Steps

1. Read ${PRDFile} and find the first User Story (US-xxx) that has ANY incomplete acceptance criteria (marked [ ]).
2. Read ${ProgressFile} - check the Learnings section first for patterns from previous iterations.
3. Complete ALL acceptance criteria within that User Story before ending this iteration.
4. Verify your changes work using: ruff check on changed files, python -c "import ..." for import checks, or pytest if a test DB is available.

## Throwaway Scripts

You MAY create temporary scripts (validate_*.py, verify_*.py, etc.) if needed for verification. However, you MUST delete them before committing. Never commit throwaway scripts.

## Critical: Cleanup and Commit Rules

- You MUST only commit YOUR OWN work from this iteration. Do not stage or commit unrelated files.
- Before committing, delete any throwaway scripts you created.
- Run: git diff --name-only --cached to verify you are only committing your own changes.

- If verification PASSES:
  - Delete any throwaway scripts you created
  - Update ${PRDFile} to mark ALL completed acceptance criteria with [x]
  - Stage ONLY your changed/new files with git add <specific files> (not git add . or git add -A)
  - Commit your changes with message: feat(US-xxx): [user story description]
  - Append what worked to ${ProgressFile}

- If verification FAILS:
  - Delete any throwaway scripts you created
  - Do NOT mark any acceptance criteria complete
  - Do NOT commit broken code
  - Append what went wrong to ${ProgressFile} (so next iteration can learn)

## Progress Notes Format

Append to ${ProgressFile} using this format:

## Iteration [N] - US-xxx: [User Story Title]
- Acceptance criteria completed:
  - [list each criterion]
- Files changed
- Learnings for future iterations:
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---

## Update AGENTS.md (If Applicable)

If you discover a reusable pattern that future work should know about:
- Check if AGENTS.md exists in the project root
- Add patterns like: 'This codebase uses X for Y' or 'Always do Z when changing W'
- Only add genuinely reusable knowledge, not task-specific details

## MANDATORY FINAL STEP - COMMIT YOUR WORK

After verification passes for ALL acceptance criteria in the User Story, you MUST commit before ending:

1. Delete any throwaway scripts (validate_*.py, verify_*.py, etc.)
2. git add <your specific changed files> (NOT git add . or git add -A)
3. git commit -m "feat(US-xxx): [user story description]"

DO NOT SKIP THIS STEP. If you do not commit, your work is lost and the next iteration will redo it.
Verification passing without a commit = FAILED iteration.

## End Condition

After committing your User Story, check ${PRDFile}:
- If ALL User Stories have ALL acceptance criteria marked [x], output exactly: <promise>COMPLETE</promise>
- If any User Story has remaining [ ] criteria, just end your response (next iteration will continue)
"@

    $workDir = (Get-Location).Path
    $timeoutSec = $TimeoutMinutes * 60

    $job = Start-Job -ScriptBlock {
        param($promptText, $dir, $modelArg)
        Remove-Item Env:CLAUDECODE -ErrorAction SilentlyContinue
        Set-Location $dir
        if ($modelArg) {
            & claude --dangerously-skip-permissions --model $modelArg -p $promptText 2>&1 | Out-String
        } else {
            & claude --dangerously-skip-permissions --model claude-sonnet-4-5-20250929 -p $promptText 2>&1 | Out-String
        }
    } -ArgumentList $prompt, $workDir, $Model

    $null = $job | Wait-Job -Timeout $timeoutSec

    if ($job.State -eq 'Running') {
        Write-Warning "Iteration $i TIMED OUT after $TimeoutMinutes minutes - killing process"
        $job | Stop-Job
        $job | Remove-Job -Force

        # Log timeout to progress file
        $timeoutNote = "`n## Iteration $i - TIMEOUT`n- Task timed out after $TimeoutMinutes minutes`n- Process was killed`n---`n"
        Add-Content -Path $ProgressFile -Value $timeoutNote -ErrorAction SilentlyContinue

        Write-Host "Waiting $SleepSeconds seconds before retrying..." -ForegroundColor Yellow
        continue
    }

    try {
        $result = $job | Receive-Job 2>&1 | Out-String
        $job | Remove-Job -ErrorAction SilentlyContinue
    }
    catch {
        Write-Warning "Iteration $i failed with an error:"
        Write-Warning $_.Exception.Message
        $job | Remove-Job -Force -ErrorAction SilentlyContinue
        Write-Host "Waiting $SleepSeconds seconds before retrying..." -ForegroundColor Yellow
        continue
    }

    if (-not $result) {
        Write-Warning "Iteration $i returned empty output"
        Write-Host "Waiting $SleepSeconds seconds before retrying..." -ForegroundColor Yellow
        continue
    }

    Write-Host $result
    Write-Host ""

    if ($result -match "<promise>COMPLETE</promise>") {
        Write-Host "==========================================="
        Write-Host "  All tasks complete after $i iterations!"
        Write-Host "==========================================="
        exit 0
    }

    Start-Sleep -Seconds $SleepSeconds
}

Write-Host "==========================================="
Write-Host "  Reached max iterations ($MaxIterations)"
Write-Host "==========================================="
exit 1