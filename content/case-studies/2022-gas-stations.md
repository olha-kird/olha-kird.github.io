---
title: B2B Gas Station Maintenance
summary: "Simplifying workflows and improving usability of a 20-year-old gas station maintenance system."
tags: [B2B, SaaS, Operations, Research]
year: 2022
gradient: 4
cover: images/reports-cover.png
sticky_goal: "Improve usability and simplify workflows for different user types"
sticky_challenge: "Designing for conservative power users with fully customizable workflows"
sticky_role: "Research, user interviews, IA, user flow, UX design, prototyping"
testimonial: "...extremely proficient in using Figma for the web components and ... able to integrate feedback in real-time updating the individual elements in our meetings and provided great insights into how we might improve the user experience while still including our feedback."
testimonial_by: "Head of Product Innovation, quote from the agency review"
---

## Context
### Maintenance of equipment and the UI

This project was a redesign of a B2B ticket management system used primarily by gas stations to keep track of their equipment. The previous design was outdated and hard to navigate, so my goal was to reduce complexity.

## Process
### Meeting the different types of users

My first step was an in-depth stakeholder interview. I talked to the CEO, product managers, and the lead developer to gather initial requirements and understand business goals.

Then, I reviewed the existing system and had additional calls with the team to discuss the current implementation details. This helped me clarify the relationships between different entities and, as a result, build an object-oriented diagram of information architecture.

![[reports-ia.png]]

The next step was to conduct user interviews and understand the relevant workflows. After talking to users, I identified insights from conversations and used thematic analysis to group them into categories. This helped me define priorities for the redesign and build a user flow to reflect the actions of users in the system.

![[reports-flow.png]]

## Solution
### Why the Kanban didn't work

While analyzing the information architecture, I realized it contained a very similar entity to a support ticket. This gave me the idea to reuse a pattern from task management systems and introduce a Kanban board. This layout would improve usability for users who process lots of tickets and update their statuses.

![[reports-kanban.png]]

Although the client liked the Kanban view at first, it was eventually rejected. The reason was that all statuses were fully customizable, and every customer would have a different set depending on their workflow. And most importantly, not all workflows were linear, so it didn’t make sense to visualize them this way. As a result, we decided to stick with the table view.

![[reports-table.png]]

Even though we decided to keep the original layout, I introduced some UX changes to improve usability:

- **Batch selection.** Clicking the first checkbox opens a ribbon menu with batch actions to simplify the workflow for users who process large numbers of reports.
- **Chips with pop-up previews.** Clicking the *Object/Equipment/Assignee* chip in each row opens a pop-up with details. This helps users get a quick preview of data.
- **Quick status change.** Clicking the *Status* chip opens a pop-over that allows users to update the report status without opening a separate page.
- **Customizable filters.** At the top of the page, there is a ribbon with a set of filters. This set can be edited through the *All Filters* menu by clicking the eye icon next to a filter. Also, users can save a preset of values as a template and load them whenever needed.

### Simplifying a complex form

The most challenging part of the system was the report creation flow. Previously, it was a long and unpredictable form where new questions appeared out of nowhere.

To reduce the cognitive load, I split the form into two pages and added a stepper at the top to ensure users understand there is more than one page.

![[reports-new-1.png]]
![[reports-new-2.png]]

## Outcome
### Modernized the 20-year-old UX

As a result of the project, I redesigned an outdated system, improved usability and pattern consistency, and simplified workflows for power users through reducing the number of repeated actions. Unfortunately, I didn't have an opportunity to see the implementation, but the client was satisfied with the results.