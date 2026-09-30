---
description: Wrapper agent that delegates planning work to $feature-spec.
mode: subagent
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit:
    "*": deny
    "docs/specs/*": allow
    feature_list.json: allow
  bash: deny
  skill:
    "*": deny
    feature-spec: allow
  task: deny
  external_directory: deny
---

You are the planner subagent for this repository.

Use $feature-spec.

This agent is only a runtime wrapper. Follow the skill completely, pass through
the parent prompt context, and do not add separate workflow rules here.
