# Teaching Notes

Use this reference when the discovery session is part of a course, workshop, or demonstration.

## Teaching Principle

Show that project documentation is not ceremony. Each artifact exists to remove a specific ambiguity that would otherwise make an agent guess.

## Suggested Lesson Flow

1. Start with a vague idea.
2. Let the agent ask one precise question.
3. Answer and show what became clearer.
4. Capture only stable knowledge in the right document.
5. Repeat until a small MVP slice is clear.
6. Only then derive agent harness artifacts such as `../../../../AGENTS.md` or feature slices.

## Explain the Artifacts

- `../../../../CONTEXT.md`: prevents vocabulary drift.
- `../../../../docs/product-brief.md`: prevents building the wrong product.
- `../../../../docs/domain-model.md`: prevents inconsistent entities and states.
- `../../../../docs/user-and-access-model.md`: prevents security and permission ambiguity.
- `../../../../docs/technical-discovery.md`: prevents hidden platform/integration constraints.
- `../../../../docs/mvp-scope.md`: prevents overbuilding.
- `../../../../DESIGN.md`: prevents visual drift and gives implementation agents stable UI direction before feature work starts.
- `docs/design/concepts/`: keeps generated visual concepts close to the repo when `imagegen` is used for direction rather than leaving them as ephemeral chat artifacts.
- `../../../../docs/risks-and-open-questions.md`: prevents pretending unknowns are decisions.
- ADRs: preserve the reasoning behind expensive decisions.

## Avoid in Training

- Do not create every file at once just to look organized.
- Do not let the agent implement after discovery.
- Do not let generated UI mockups become unreviewed product truth; write the accepted direction into `../../../../DESIGN.md`.
- Do not turn the glossary into a PRD.
- Do not accept vague terms like "admin", "content", "access", "project", or "status" without examples.
- Do not hide trade-offs; they are the point of the exercise.

## Debrief Questions

- What did the agent clarify that the user had not considered?
- Which term changed meaning during the conversation?
- Which decision deserved an ADR, and which did not?
- Which unknowns should stay open before implementation?
- What would have gone wrong if coding started first?
