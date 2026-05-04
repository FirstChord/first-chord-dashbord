# V3 Architecture

## Purpose

This document defines the intended direction of V3.

V3 is not a rewrite for its own sake.
It is the next architectural layer after V2, built from real operational use.

The goal is to move from:

- a strong internal admin dashboard
- plus generated reconciliation/config workflows

toward:

- a true school operating system
- with explicit issue state
- communication workflows
- finance/planning support
- and Brain as a bounded operator and thought partner

---

## Why V3 Exists

V2 has already proven real value:

- onboarding works
- tutor/student dashboard config updates automatically
- FC regeneration is automated
- Stripe setup and live billing issues are visible
- the system can surface real operational problems

The next bottlenecks are no longer basic CRUD or deployment.

They are:

- issue state and resolution workflow
- communication workflow
- finance visibility
- policy enforcement
- bounded AI assistance

V3 exists to solve those well.

---

## V3 Goals

### 1. Persistent issue state

Move from generated flags plus ad hoc review into a real issue system with:

- ownership
- state
- notes
- clearability
- auditability

### 2. Communication workflow

Support message drafting, review, and eventually sending across channels such as WhatsApp.

This should include:

- message categories
- approval rules
- communication history or state
- safe drafting boundaries

### 3. Finance and payment operations

Move from payment checks into a more complete finance layer:

- setup timing
- failed payment follow-up
- manual payment exceptions
- paused billing visibility
- recurring revenue understanding

### 4. Planning and operating support

Support Finn and Tom with:

- queue visibility
- priorities
- weekly planning
- short/mid/long-term goals

### 5. Brain as bounded assistant

Brain should become useful across:

- issue classification
- recommended next actions
- message drafting
- progress summaries
- planning support

without becoming an unbounded auto-agent.

---

## V3 Non-Goals

V3 should not begin by:

- rewriting all storage into a new database
- replacing MMS
- replacing Google Sheets everywhere immediately
- making Brain autonomous across high-risk actions
- moving all logic into one giant service

Those may become future evolutions, but they are not the starting point.

---

## Current V2 Baseline

V2 already provides:

- hosted admin dashboard on Railway
- admin auth
- onboarding with preflight and idempotent behavior
- recurring lesson dedupe
- Stripe setup and live Stripe scan workflow
- payment policy fields
- pause-state visibility
- generated config automation
- FC regeneration automation
- review-flag freshness visibility

This is the base V3 should build on, not discard.

---

## Core Architectural Principle

Agents and workflows should operate on:

- normalized state
- explicit policy
- bounded actions

not on:

- raw vendor APIs directly
- tribal knowledge
- scattered conditional logic

This principle should guide all V3 work.

---

## Target V3 Layers

### Layer 1: Canonical operational state

Current main sources remain:

- Sheets for operational/admin state
- Registry for portal config
- MMS for lessons/billing-operational state
- Stripe for payment provider state

V3 should tighten ownership, not blur it.

### Layer 2: Normalized snapshots

V3 should add more normalized derived summaries, such as:

- Stripe snapshot
- payment expectation status
- pause status
- workflow freshness
- issue status summary
- tutor load/capacity summary
- finance summary

These are cheaper and safer for agents and UI than raw system calls.

### Layer 3: Persistent issue state

This is the most important missing V3 layer.

Likely responsibilities:

- issue queue state
- owner
- status
- notes
- clear/reopen behavior
- upstream-resolved state

### Layer 4: Communication layer

V3 should add a message workflow layer with:

- templates
- draft generation
- approval requirements
- sent/pending state
- communication context

### Layer 5: Planning layer

This should support:

- weekly priorities
- backlog summaries
- school goals
- operational targets
- financial planning context

### Layer 6: Brain assistance layer

Brain should sit on top of the normalized layers and policy docs, not replace them.

---

## Recommended Data Direction

### Keep in Sheets for now

Still appropriate in V3 early phase:

- operational student records
- payment mode / expectation
- some issue-state support if needed
- planning tables

### Keep registry narrow

Registry should stay focused on:

- portal config
- friendly URLs
- Soundslice
- Theta
- tutor-facing config identity

### Avoid overloading generated outputs

Generated tabs/files should stay:

- derived
- refreshable
- not manually authoritative

---

## Brain Role In V3

### What Brain should do

- summarize operational state
- explain issues
- suggest next actions
- draft messages
- support planning
- help Finn and Tom track goals

### What Brain should not do by default

- message parents automatically
- change payment state automatically
- change tutor assignment automatically
- delete records automatically
- resolve high-risk issues without approval

This keeps Brain useful but bounded.

---

## Best V3 Build Order

### 1. Persistent issue queue

Before broad AI or messaging expansion, fix issue workflow properly.

### 2. Clearable resolution actions

Add safe ways to clear or resolve issues from the dashboard.

### 3. Communication policy + message layer

Design before wiring WhatsApp.

### 4. Finance summary layer

Move from issue-only payment visibility to recurring planning visibility.

### 5. Brain-assisted workflows

Start with:

- summaries
- drafting
- recommendations

Then only later:

- bounded execution

---

## What Stays In V2

The following should be treated as V2 operational finishing work, not V3 architecture:

- small Stripe rule refinements
- edge-case onboarding fixes
- registry repair work
- light dashboard polish
- minor admin UX improvements

---

## Signals That V3 Is Ready To Start Building

V3 implementation should become active when:

- Tom and Finn have used the issue/Stripe workflows enough to reveal stable patterns
- the policy layer is documented enough to support bounded automation
- the most common issue actions are known

That makes V3 a response to real usage, not a speculative abstraction exercise.

---

## Near-Term Recommendation

Start V3 as an architecture and policy track now.

Do not start it as a large-scale rewrite yet.

Use the current period to:

- refine issue actions
- tighten policy docs
- observe real usage
- lightly improve UX

Then begin V3 implementation from the issue/communication/planning layers upward.
