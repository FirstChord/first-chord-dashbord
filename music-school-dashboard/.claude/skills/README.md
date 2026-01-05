# Claude Skills - Quick Reference Guide

Lightweight, focused guides for recurring dashboard tasks.

## Available Skills

### 🎓 [Add Student](add-student.md)
Complete workflow for onboarding a new student to the dashboard.

**When to use**: Adding new students to teacher rosters

**Quick command**: `npm run generate-configs` after updating CSV

---

### 🚀 [Deploy](deploy.md)
Safe deployment procedures for pushing updates to production.

**When to use**: After making changes, before going live

**Quick command**: `git push origin main` (auto-deploys to Railway)

---

### 🔧 [Troubleshoot](troubleshoot.md)
Fast diagnostics for common dashboard issues.

**When to use**: Portal not loading, API failures, build errors

**Quick command**: `npm run validate` (first step for most issues)

---

## Skill Philosophy

These skills are intentionally:
- ✅ **Concise** - One page or less
- ✅ **Action-focused** - Commands and checklists
- ✅ **Quick reference** - Not comprehensive docs
- ✅ **Recurring tasks** - Things done frequently

## For Detailed Documentation

See the main [Documentation Index](../docs/INDEX.md) for:
- Complete guides
- Architecture explanations
- Edge case protocols
- Full API references

## Creating New Skills

Keep skills under 100 lines. If longer, it belongs in `/docs` instead.

Structure:
1. Purpose (1-2 sentences)
2. Quick commands
3. Step-by-step process
4. Common issues
5. Link to full docs
