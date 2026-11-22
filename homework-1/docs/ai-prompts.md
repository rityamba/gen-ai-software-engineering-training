# AI Prompts

Examples of the prompts I used while building the Banking Transactions API, in the order of the work. Most of them were sent to Claude Code in VS Code; some were first drafted with ChatGPT. How the prompts fit into the overall workflow is described in the [README](../README.md#-how-ai-was-used).

<!-- Add each prompt as its own section: a heading, one line on what it was for, then the prompt in a ```text block. -->

## Splitting the plan into product and technical plans

Turns the first implementation plan into two documents: what to build and in what order, and how to build it. Claude Code first acts as a product and business analyst and asks me the open questions one at a time.

```text
I have an initial project plan that contains development stages, feature descriptions, and some technical considerations.

I want to turn it into two separate documents:
1. A Product & Execution Plan — WHAT we are building and in WHAT order.
2. A Technical Implementation Plan — HOW we are going to build it.

For now, act as a Senior Product Analyst and Business Analyst.

Analyze my existing plan and:

1. Identify all product requirements and functional features.
2. Identify project stages, milestones, and dependencies.
3. Separate business and product decisions from technical implementation details.
4. Identify assumptions, ambiguities, contradictions, and missing information.
5. Highlight requirements that are too vague to be implemented.
6. Identify questions that need my input.

Important:
- Do not write or modify any project files yet.
- Do not invent requirements or make product decisions on my behalf.
- Do not discard technical details; classify them separately.
- Distinguish confirmed information from assumptions and suggestions.

First, show me your analysis and ask clarification questions one at a time.
```

## Product & Execution Plan

After the analysis and my answers to its questions, creates [product-execution-plan.md](product-execution-plan.md): what we build and in what order, with no technical details.

```text
Based on the reviewed and approved requirements, create a Product & Execution Plan.

Save it as docs/product-execution-plan.md.

The document must describe WHAT we are building and in WHAT order, without specifying HOW it will be technically implemented.

Include:
- Product overview and goals
- Non-goals and scope boundaries
- Target users
- Functional requirements
- Main user flows
- Project phases and milestones
- Dependencies between features
- Acceptance criteria for each phase
- Open questions and unresolved decisions

Organize the plan into logical, independently understandable stages.

Each stage must have:
- Objective
- Features and expected outcomes
- Dependencies
- Acceptance criteria
- Definition of Done

Do not introduce new functionality that I have not approved.

Keep technical implementation details out of this document. Preserve references to technical decisions that still need to be made, but do not resolve them here.

After creating the document, summarize its structure and highlight any remaining gaps.
```

## Technical Implementation Plan

Creates [technical-implementation-plan.md](technical-implementation-plan.md) from the approved product plan and my technical notes: how to build it, with the reasons, alternatives, trade-offs and risks of each decision.

```text
Act as a Senior Software Architect.

Using the approved Product & Execution Plan and my original technical notes, create a Technical Implementation Plan.

Save it as docs/technical-implementation-plan.md.

Your task is to define HOW the approved product requirements will be implemented.

Include:

1. Recommended technology stack with justification.
2. High-level system architecture.
3. Frontend and backend architecture, if applicable.
4. Project structure and module responsibilities.
5. Database design and data relationships.
6. API contracts and communication patterns.
7. Third-party integrations.
8. Authentication and authorization.
9. Security considerations.
10. Error handling and logging.
11. Testing and quality strategy.
12. Infrastructure and environments.
13. CI/CD and deployment strategy.
14. Technical implementation tasks and dependencies.

For every major technical decision:
- Explain why it is needed.
- Describe alternatives.
- Explain trade-offs.
- Identify potential risks.

Map technical tasks to the corresponding product requirements and project phases.

Do not silently make assumptions. Mark decisions as:
- Confirmed
- Proposed
- Requires approval
- Open question

Do not write application code or implement anything yet.

First present the proposed architecture and critical technical decisions for my review. Ask questions one at a time.
```

## Independent plan review

Run in a new session, so the reviewer has no stake in the plans. The result is [plan-review.md](plan-review.md): 13 findings and the verdict "not approved" until the Critical and High ones were fixed.

```text
Act as an independent Senior Software Architect and Product Reviewer.

Review these two documents:
- docs/product-execution-plan.md
- docs/technical-implementation-plan.md

Do not modify either document.

Check:

1. Does the technical plan cover all approved product requirements?
2. Are there product requirements without an implementation approach?
3. Does the technical plan introduce functionality outside the approved product scope?
4. Are there contradictions between the documents?
5. Are dependencies and implementation order logical?
6. Are there missing technical decisions?
7. Are there architectural risks or unnecessary complexity?
8. Are acceptance criteria technically achievable and verifiable?

Create a review report with:
- Finding
- Severity
- Affected document and section
- Explanation
- Recommended action

Do not approve the plans until critical issues are resolved.
```

## Phase 0: service skeleton

Starts the first implementation phase, limits it to the plans and asks for a plan before any code.

```text
Follow homework-1/docs/technical-implementation-plan.md (§4 structure, §6.7 errors,
§10 logging, §15 tasks) and the Phase 0 acceptance criteria in product-execution-plan.md.
If something is unclear or the docs conflict — ask, don't assume.

Only Phase 0: no transaction/account logic, demo files, or CI.

First show me a short plan of files to create and wait for my "go".
When done, run lint, tests, coverage, and curl /health, and show me the results.
Don't commit.
```

## Postman collection

Generates the Postman collection and environment from the implemented code, with documentation and test scenarios for every endpoint.

```text
Analyze the existing codebase and generate a Postman Collection covering all API endpoints implemented in the project.

**Requirements:**

1. Identify all available endpoints, HTTP methods, parameters, headers, authentication requirements, and request/response formats directly from the implementation.
2. Organize requests into logical folders by feature or resource.
3. Add minimal but useful documentation for each request:
   - Short description of its purpose.
   - Required and optional parameters.
   - Example request body where applicable.
   - Expected response structure and relevant status codes.
4. Consider different scenarios and variations:
   - Required vs. optional parameters.
   - Valid and invalid input.
   - Missing or empty fields.
   - Different supported values and boundary cases.
   - Relevant error responses.
5. Add reusable collection variables for base URL, tokens, IDs, and other shared values where appropriate.
6. Use realistic example data based on the actual project implementation.

**Important:**
- Do not invent endpoints, parameters, validation rules, or response formats.
- Verify all details against the source code.
- Avoid redundant requests and unnecessary documentation.
- Keep the collection easy to navigate and maintain.
- Do not modify the application code.

**Deliverables:**
- A valid Postman Collection v2.1 JSON file.
- An environment JSON file with the necessary configurable variables, if applicable.
- A brief summary of API coverage and any endpoints or behaviors that could not be confidently documented.
```
