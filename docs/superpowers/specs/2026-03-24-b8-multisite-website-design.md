# B8 Multisite Website Rebuild Design

**Date:** 2026-03-24

**Goal:** Rebuild `dma.b8water.com` and `www.chinabigfoot.com` as a self-hosted multisite website platform in a single repository, with one Chinese admin backend that manages both sites' content and media.

## Project Summary

The current public sites are hosted by a third-party site builder. The replacement system should:

- Recreate both public websites in one codebase.
- Preserve the existing information architecture as much as practical, including major page hierarchy and URL habits.
- Migrate media assets into the new system instead of depending on the existing third-party-hosted files.
- Provide a Chinese admin backend suited to mainland China business users.
- Allow administrators to manage company profile, products, solutions, news, cases, navigation, banners, contact information, SEO fields, and media assets.
- Be prepared for later deployment on Alibaba Cloud ECS.

## Confirmed Product Decisions

- Delivery shape: one multisite platform with a shared backend.
- Admin UX: Chinese-first, aligned with mainland China management conventions.
- Migration strategy: preserve current page structure and main URLs where practical.
- Asset strategy: migrate images and related media into the new platform.
- Visual direction: refine the current sites into a cleaner, more professional, technology-forward blue style without a radical redesign.

## Repository Starting Point

Implementation should start from a fresh repository at `/Users/mac/project/b8-multisite-web`.

This project should not depend on or extend any pre-existing draft repository in the current directory. Planning and implementation should assume a clean, self-contained codebase created specifically for this delivery.

## Recommended Solution

Build a unified Node.js-based website platform with:

- One public frontend layer capable of rendering multiple branded sites.
- One shared admin backend for content management.
- One shared content model with per-site ownership.
- A local media library managed by the application.
- A deployment shape suitable for single-machine hosting first, with room to migrate the data layer later if needed.

This balances cost, maintainability, brand consistency, and speed of taking ownership away from the third-party host.

## Site Scope

### Site 1: `dma.b8water.com`

Primary public structure identified from the current site:

- Home
- Product / solution section
  - DMA Lite
  - Large meter remote monitoring
  - AI meter-reading robot
- News / information center
- About us

Home page content also includes capability highlights, cases, news, company introduction, and contact details.

### Site 2: `www.chinabigfoot.com`

Primary public structure identified from the current site:

- Home
- Products and solutions
  - Company products
  - Solutions
  - Product brochure
- Smart water solution
- Customer cases
- Industry news
- About us
  - Company profile
  - Development history
  - Contact us

## Migration Boundary

The first version should migrate the public-facing content that is reachable from the current primary navigation, homepage modules, and their key detail pages.

Included in scope:

- homepage modules for both sites
- about/company pages
- products and solutions index pages
- product/solution detail pages
- news index and detail pages
- customer-case or case-study pages that are currently surfaced publicly
- contact information and related QR/contact assets
- brochures or downloadable files only if they are currently linked from the public sites and needed for continuity

Out of scope unless discovered to be critical during planning:

- builder-specific internal URLs that exist only because of the old third-party platform
- abandoned or hidden pages with no clear navigation entry point
- non-website business system functions unrelated to public-site content management

Implementation planning must begin with a concrete migration inventory that lists the pages, assets, and downloads to be carried into the new repository. That inventory is part of execution planning, not an unresolved product decision.

## Architecture

### High-Level Shape

One repository contains:

- Public site application
- Admin application
- Shared database layer
- Shared content/media services

The system selects the correct site configuration by domain or explicit site identifier.

### Multisite Model

Every managed entity belongs to one site, except for truly shared records such as admin users or reusable taxonomy when appropriate.

Core site-level configuration includes:

- Site name
- Domain
- Logo
- Theme tokens
- Navigation
- Footer/contact info
- SEO defaults

### Admin Model

The first version targets a simple administrator-led workflow:

- Admin login
- Site switcher in the backend
- Chinese navigation and form labels
- List pages with filtering and sorting
- Create/edit forms
- Draft/published states
- Soft delete where useful

The first version does not require complex multi-role approval logic. That can be added later if the business needs editorial separation.

## Content Model

The backend should support at least these content types:

- Site settings
- Navigation items
- Homepage sections / banners
- Company profile pages
- Products
- Solutions
- News articles
- Customer cases
- Contact information
- Media assets
- SEO metadata

Each content item should support the fields needed for business website management, such as:

- Owning site
- Title
- Slug / URL key where needed
- Summary
- Rich content body
- Cover image
- Gallery / attachments where relevant
- Sort order
- Publish status
- Publish time
- SEO title / description / keywords

## Frontend Experience

### Design Direction

The selected visual direction is:

- clean
- professional
- technology-forward
- blue-toned
- suitable for mainland China B2B and utility-sector audiences

The redesign should improve readability, hierarchy, trust, and conversion signals, but still feel recognizably connected to the current sites.

### Migration Principle

The rebuild should avoid a jarring structural change. The preferred behavior is:

- keep main navigation logic familiar
- keep main URL habits where practical
- modernize layout, spacing, typography, and visual polish
- convert homepage sections into CMS-driven modules

### URL Preservation Rule

The goal is continuity, not literal duplication of every third-party builder path.

Required behavior:

- preserve recognizable section structure for major public pages
- use stable, human-readable routes in the new system
- keep primary page entry points aligned with the old sites' navigation logic
- create an explicit redirect map for important legacy entry URLs when exact path preservation is not practical

Not required:

- reproducing every `col.jsp`, `nd.jsp`, `qrCode.jsp`, or similar builder-generated URL exactly
- preserving low-value system-generated query parameters from the old host

## Asset Migration

The new platform should no longer depend on the third-party site builder for essential assets.

Migration requirements:

- download and store current images/assets locally within the new system
- rebind content records to internally managed assets
- keep room for future upload/replacement from the admin backend

## Technical Direction

The first implementation should favor operational simplicity:

- one repository that delivers a single website system, even if it includes a public frontend and a CMS/admin process as separate runtime processes
- suitable for local development and single-server deployment
- deployable to Alibaba Cloud ECS
- data layer implemented in a lightweight way first, with a future migration path to a managed relational database if needed

The exact library choices should be made during implementation planning, but the plan should preserve:

- a single-repo multisite architecture
- Chinese admin UX
- CMS-style content modeling
- local media management

## Testing and Verification Expectations

Implementation planning must include verification for:

- both public sites render correctly
- major content categories are editable in the admin
- media upload and replacement works
- content publishing updates the public site correctly
- preserved URL patterns resolve correctly for core pages
- local startup flow works end-to-end

For acceptance, “core pages” means at minimum:

- each site homepage
- each site about/company page
- each site products/solutions index
- at least one product detail page per site
- each site news index
- at least one news detail page per site
- any case-study or customer-case page exposed in the first version

## Acceptance Standard

The work is acceptable when all of the following are true:

1. Both public sites are available from the new codebase.
2. Their main content and assets have been migrated into the new system.
3. The shared Chinese admin backend can perform CRUD for the main website content domains.
4. Frontend and backend run locally with verified behavior.
5. The repository includes enough setup/deployment guidance to support later Alibaba Cloud deployment.

## Non-Goals for First Version

To keep the project implementable in one pass, the first version should avoid unnecessary scope such as:

- complex approval workflows
- multilingual support
- advanced analytics dashboards
- customer-facing self-service portals unrelated to the current websites
- replacing business systems beyond website content management

## Open Implementation Notes

These are planning notes, not unresolved product questions:

- Prefer a structure that can add a third site later without architectural churn.
- Preserve room for later database migration if scale or hosting standards change.
- Model homepage sections carefully so that the front page is editable without hardcoding every block.
