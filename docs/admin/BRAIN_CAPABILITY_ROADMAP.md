# Brain Capability Roadmap

## What Brain Can Realistically Do Now

- explain current admin and system state
- help triage flags and Stripe issues
- suggest likely fixes from explicit rules
- draft onboarding, follow-up, and ops messages
- summarize risks, blockers, and workflow gaps
- support Finn and Tom with planning around current known data

## What Brain Can Start Doing Soon

- classify issues automatically into action buckets
- prepare daily or weekly ops summaries
- suggest next actions for each student or payment issue
- detect stale setup states
- draft WhatsApp or email messages for approval
- monitor workflow freshness:
  - FC regeneration
  - config regeneration
  - review flags
  - Stripe scans
- help with short-term planning:
  - onboarding backlog
  - payment risk review
  - tutor assignment friction
  - incomplete setup cleanup

## What Brain Needs Before It Becomes A True Admin Assistant

- persistent issue state and ownership
- clearer action taxonomy:
  - read-only
  - suggest
  - safe auto-action
  - approval required
- normalized finance summaries
- communication history or communication state
- explicit school policies written down
- goal tracking:
  - short-term
  - mid-term
  - long-term

## What Brain Needs Before It Becomes A Thought Partner

- monthly revenue and lesson model
- paused revenue and resumed revenue tracking
- tutor capacity and utilization summaries
- churn, retention, and waiting-list movement summaries
- explicit strategic priorities
- a small planning memory layer for:
  - current goals
  - constraints
  - active projects
  - recent decisions

## Good Cheap-Agent Or Deterministic Tasks

- issue classification
- payment mismatch detection
- stale-state detection
- workflow health summaries
- template-based message drafting
- flag explanation
- checklists and follow-up reminders
- basic reporting from normalized data

## Better Left To Stronger Models

- ambiguous exception handling
- policy design
- financial forecasting
- scenario planning
- strategic prioritization
- cross-system root-cause analysis

## Best Next Build Steps

1. Finish issue handling so `/admin/flags` becomes a true operational queue.
2. Add persistent issue state and ownership.
3. Define communication policies and safe message categories.
4. Create a normalized finance summary layer.
5. Add a simple goals and planning layer for Finn and Tom.

## Core Principle

Brain should act on:
- normalized state
- explicit rules
- bounded actions

Brain should not depend on:
- raw vendor APIs directly
- tribal knowledge
- implicit assumptions
