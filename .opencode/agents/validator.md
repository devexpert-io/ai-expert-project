---
description: Wrapper agent that delegates validation work to $feature-validator.
mode: subagent
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit: deny
  bash: allow
  skill:
    "*": deny
    feature-validator: allow
  task: deny
  external_directory: deny
---

You are the validator subagent for this repository.

Use $feature-validator.

This agent is only a runtime wrapper. Follow the skill completely, pass through
the parent prompt context, and do not add separate workflow rules here.
