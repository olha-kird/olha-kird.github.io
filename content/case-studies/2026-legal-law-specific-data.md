---
title: "AI-Extracted Law-Specific Data"
summary: Improving presentation of AI-extracted legal data to build user trust and increase AI features adoption.
tags: [B2B, AI, Startup, Legal Tech, UI]
year: 2026
cover: images/legal-data-new.png
gradient: 1
sticky_goal: "Make law-specific data more reliable for document generation and calculations"
sticky_challenge: "No clear understanding of user workflow and expectations"
sticky_role: "Internal discovery, UI design, validation, handoff, documentation"
testimonial: "Thanks for your work, Olha! And I looove giving feedback, let's do things like this more often!"
testimonial_by: "Legal engineer, quote from the comment after completing the internal survey"
---

## Context
### Designing AI data transparency for legal teams

This is one of my most recent AI-related projects at the legal tech startup. The goal of the initiative was to increase usage of the document generator feature (also initially designed by me). The document generator uses pre-made templates that are filled out with AI-extracted data from uploaded legal documents. Which means that output quality depends on the validation of the AI-extracted data.

![[legal-doc-generator.png]]

The core design challenge was building enough trust in AI-extracted data that lawyers would actually review it — rather than skip it and generate inaccurate documents.

## Process
### Internal validation on a tight schedule

The initiative involved a lot of stakeholder alignment and product validation. I did not conduct research for this initiative myself, but analyzed insights from the user interviews run by the product manager. The main user feedback was that law-specific data was not structured meaningfully and difficult to understand. As a result, users were not reviewing it and if they wanted to generate a document or perform calculations, they jumped straight into it, and often got inaccurate results. Below is the previous design of the page.

![[legal-data-before.png]]

When iterating on the design, I realized I need additional input for decision-making. Since user research with lawyers requires a lot of time for preparation and we had a tight schedule, I decided to run an internal unmoderated usability testing and ask some UI questions in a survey. The first results revealed significant confusion, so I continued iterating until the layout addressed the main issues and was validated with the team

## Solution
### Structure that builds trust
The redesign focused on three topics that were blocking user trust:
- All law-specific data fields are grouped by the law field and law area for better context.
- Some fields have additional features, such as relations to other entities and historical values.
- AI reasoning is hidden behind the KI badge to make the layout cleaner. Users can still preview the source to validate the data.

![[legal-data-after.png]]

One of the specific features added in the redesign was an option to add historical values to some fields. It was mostly straightforward in terms of UI, but introduced lots of small interactions and edge cases. The most challenging part of the initiative was to define all interactions and document them for the engineers. Below is the visual flow that explains how the historical values should be assigned.

![[legal-data-handoff.png]]

## Outcome
### Validated and ready for release

The feature is not released yet since it requires a lot of backend work to function properly, but it already received positive feedback from the legal engineering team.
