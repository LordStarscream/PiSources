#!/bin/bash
# Test script for dev-env skill Session Start discovery logic
# Run from /home/mario/Projects/piEnvironment/test-sessions/
#
# This script simulates what the dev-env skill does in Step 1:
# 1a. Check CWD for .pi/TASK_LIST.md
# 1b. Check subdirectories for .pi/TASK_LIST.md
# 1c. Check parent directories
# 1d. Report no .pi/ found

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

pass() {
    echo "  ✅ PASS: $1"
    PASS=$((PASS + 1))
}

fail() {
    echo "  ❌ FAIL: $1"
    FAIL=$((FAIL + 1))
}

# Helper: simulate Step 1a — check if CWD has .pi/TASK_LIST.md
check_cwd() {
    local cwd="$1"
    if [ -f "$cwd/.pi/TASK_LIST.md" ]; then
        echo "1a"
    else
        echo "not-1a"
    fi
}

# Helper: simulate Step 1b — find .pi/TASK_LIST.md in immediate subdirectories
check_subdirs() {
    local cwd="$1"
    local found
    found=$(find "$cwd" -maxdepth 3 -name "TASK_LIST.md" -path "*/.pi/TASK_LIST.md" 2>/dev/null | head -1)
    if [ -n "$found" ]; then
        echo "1b:$found"
    else
        echo "not-1b"
    fi
}

# Helper: simulate Step 1c — walk up parents looking for .pi/TASK_LIST.md
check_parents() {
    local cwd="$1"
    local max_depth=3
    local current="$cwd"
    for i in $(seq 1 $max_depth); do
        if [ -f "$current/.pi/TASK_LIST.md" ]; then
            echo "1c:$current"
            return
        fi
        current="$(dirname "$current")"
        if [ "$current" = "/" ]; then
            break
        fi
    done
    echo "not-1c"
}

# Helper: find actual project root (bash simulation of Step 1)
find_project_root() {
    local cwd="$1"

    # 1a: Check CWD
    if [ -f "$cwd/.pi/TASK_LIST.md" ]; then
        echo "$cwd"
        return
    fi

    # 1b: Check subdirectories
    local subdir_result
    subdir_result=$(check_subdirs "$cwd")
    if [[ "$subdir_result" == 1b:* ]]; then
        local found="${subdir_result#1b:}"
        # dirname of TASK_LIST.md gives .pi/ dir; dirname of that gives project root
        echo "$(dirname "$(dirname "$found")")"
        return
    fi

    # 1c: Check parents
    local parent_result
    parent_result=$(check_parents "$cwd")
    if [[ "$parent_result" == 1c:* ]]; then
        echo "${parent_result#1c:}"
        return
    fi

    # 1d: Not found
    echo "NOT_FOUND"
}

echo "=========================================="
echo " dev-env Skill Session Discovery Tests"
echo "=========================================="

# ── SCENARIO 1: CWD has .pi/TASK_LIST.md ──────────────────────────
echo ""
echo "SCENARIO 1: .pi/TASK_LIST.md in CWD"
echo "  Running from: $(basename "$SCRIPT_DIR/scenario1-project-with-pi-in-cwd")"
SCENARIO1_DIR="$SCRIPT_DIR/scenario1-project-with-pi-in-cwd"

step=$(check_cwd "$SCENARIO1_DIR")
if [ "$step" = "1a" ]; then
    pass "Step 1a: CWD has .pi/TASK_LIST.md"
else
    fail "Step 1a: CWD should have .pi/TASK_LIST.md but doesn't"
fi

root=$(find_project_root "$SCENARIO1_DIR")
expected="scenario1-project-with-pi-in-cwd"
if [[ "$root" == *"$expected" ]]; then
    pass "Project root is CWD (found at $root)"
else
    fail "Project root should be CWD but got $root"
fi

# Verify it stops at 1a and doesn't check subdirs
memory_file="$SCENARIO1_DIR/.pi/MEMORY.md"
if [ -f "$memory_file" ]; then
    pass ".pi/MEMORY.md also found in CWD"
else
    fail ".pi/MEMORY.md should exist in CWD"
fi

# ── SCENARIO 2: .pi/TASK_LIST.md in subdirectory ───────────────────
echo ""
echo "SCENARIO 2: .pi/TASK_LIST.md in subdirectory"
echo "  Running from: $(basename "$SCRIPT_DIR/scenario2-project-with-pi-in-subdir")"
SCENARIO2_DIR="$SCRIPT_DIR/scenario2-project-with-pi-in-subdir"

step=$(check_cwd "$SCENARIO2_DIR")
if [ "$step" = "not-1a" ]; then
    pass "Step 1a: CWD correctly does NOT have .pi/TASK_LIST.md"
else
    fail "Step 1a: CWD should NOT have .pi/TASK_LIST.md"
fi

subdir_result=$(check_subdirs "$SCENARIO2_DIR")
if [[ "$subdir_result" == 1b:* ]]; then
    pass "Step 1b: Found .pi/TASK_LIST.md in subdirectory ($subdir_result)"
else
    fail "Step 1b: Should find .pi/TASK_LIST.md in subdirectory"
fi

root=$(find_project_root "$SCENARIO2_DIR")
expected="scenario2-project-with-pi-in-subdir/app"
if [[ "$root" == *"$expected" ]]; then
    pass "Project root is subdirectory 'app/' (found at $root)"
else
    fail "Project root should be app/ but got $root"
fi

# ── SCENARIO 3: No .pi/ directory ──────────────────────────────────
echo ""
echo "SCENARIO 3: No .pi/TASK_LIST.md anywhere"
echo "  Running from: $(basename "$SCRIPT_DIR/scenario3-no-pi-dir")"
SCENARIO3_DIR="$SCRIPT_DIR/scenario3-no-pi-dir"

step=$(check_cwd "$SCENARIO3_DIR")
if [ "$step" = "not-1a" ]; then
    pass "Step 1a: CWD correctly does NOT have .pi/TASK_LIST.md"
else
    fail "Step 1a: CWD should NOT have .pi/TASK_LIST.md"
fi

subdir_result=$(check_subdirs "$SCENARIO3_DIR")
if [ "$subdir_result" = "not-1b" ]; then
    pass "Step 1b: No .pi/TASK_LIST.md in subdirectories"
else
    fail "Step 1b: Should not find .pi/TASK_LIST.md in subdirectories"
fi

root=$(find_project_root "$SCENARIO3_DIR")
if [ "$root" = "NOT_FOUND" ]; then
    pass "Step 1d: Correctly reports NO .pi/ found (NOT_FOUND)"
else
    fail "Step 1d: Should report NOT_FOUND but got $root"
fi

# ── SCENARIO 4: Real-world test — GSpend app ───────────────────────
echo ""
echo "SCENARIO 4: Real-world — GSpend app at /home/mario/Projects/GSpend/gspend-app"
GSPEND_DIR="/home/mario/Projects/GSpend/gspend-app"

if [ -d "$GSPEND_DIR" ]; then
    step=$(check_cwd "$GSPEND_DIR")
    if [ "$step" = "1a" ]; then
        pass "Step 1a: CWD has .pi/TASK_LIST.md (GSpend)"
    else
        fail "Step 1a: GSpend CWD should have .pi/TASK_LIST.md"
    fi

    root=$(find_project_root "$GSPEND_DIR")
    if [[ "$root" == *"$GSPEND_DIR"* ]]; then
        pass "Project root is CWD (GSpend at $root)"
    else
        fail "Project root should be CWD but got $root"
    fi

    # Check in-progress status
    status=$(grep -o 'Status:.*' "$GSPEND_DIR/.pi/TASK_LIST.md" 2>/dev/null || echo "not found")
    if [[ "$status" == *"in-progress"* ]]; then
        pass "Task status is 'in-progress' — agent should resume, not ask 'what to do next'"
    else
        fail "Task status should be 'in-progress' but got: $status"
    fi
else
    echo "  ⚠️  GSpend directory not found, skipping real-world test"
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
echo "All tests passed! ✅"
