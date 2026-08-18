# Family Atlas — Master Specification

## 1. Project Vision

**Family Atlas** is a private family platform designed to record, celebrate and build memories around travel, adventures, learning and family experiences.

It begins as a simple interactive travel map for:

* Mum
* Dad
* Amelia
* Dylan
* Cian

Each family member has their own map and can mark the countries they have visited.

Over time, Family Atlas can develop into a long-term digital record of the family's travels and adventures, including:

* countries visited
* favourite memories
* photographs
* videos
* family holidays
* favourite places
* restaurants
* activities
* funny memories
* major experiences
* Dylan & Cian Adventures cartoon episodes
* family milestones

The project should remain simple, enjoyable and family-focused.

The objective is not to create complicated software for its own sake.

The objective is to create something the family will enjoy using for many years.

---

# 2. Product Philosophy

All development should follow these principles.

### 2.1 Family first

Every feature should help the family:

* remember experiences
* enjoy travel
* learn about the world
* encourage curiosity
* create conversations
* preserve memories

### 2.2 Simplicity beats complexity

If a feature can be implemented simply, choose the simple version.

Avoid unnecessary:

* accounts
* menus
* configuration
* dashboards
* subscriptions
* infrastructure
* dependencies

### 2.3 Child-friendly design

Dylan and Cian should be able to use Family Atlas easily.

The interface should therefore use:

* large buttons
* clear colours
* simple language
* obvious navigation
* touch-friendly controls
* minimal typing

### 2.4 Build progressively

Do not build future functionality before the current version works properly.

The project will be developed using clear milestones.

### 2.5 Preserve family history

The long-term value of Family Atlas is the record it creates.

A country visited today may contain:

* one memory
* one photograph
* one story

Twenty years later it may contain dozens.

Data should therefore be structured so that it can grow over time without rebuilding the application.

---

# 3. Family Profiles

Initial family members:

* Mum
* Dad
* Amelia
* Dylan
* Cian

Each person has their own independent travel record.

Profile IDs should remain stable even if display names are changed later.

Example:

```json
[
  { "id": "mum", "name": "Mum" },
  { "id": "dad", "name": "Dad" },
  { "id": "amelia", "name": "Amelia" },
  { "id": "dylan", "name": "Dylan" },
  { "id": "cian", "name": "Cian" }
]
```

Important:

**Cian is always spelled C-I-A-N.**

---

# 4. Geographic Scope

The initial map focuses on Europe and nearby destinations relevant to the family.

It includes:

* Iceland
* Ireland
* Northern Ireland
* Scotland
* Wales
* England
* Portugal
* Spain
* France
* Belgium
* Netherlands
* Luxembourg
* Germany
* Switzerland
* Austria
* Liechtenstein
* Italy
* San Marino
* Vatican City
* Monaco
* Andorra
* Denmark
* Norway
* Sweden
* Finland
* Faroe Islands
* Estonia
* Latvia
* Lithuania
* Poland
* Czechia
* Slovakia
* Hungary
* Slovenia
* Croatia
* Bosnia and Herzegovina
* Serbia
* Montenegro
* Kosovo
* Albania
* North Macedonia
* Greece
* Bulgaria
* Romania
* Moldova
* Ukraine
* Belarus
* Russia
* Malta
* Cyprus
* Türkiye
* Morocco
* Algeria
* Tunisia

The architecture should allow the map to expand later to:

**The entire world.**

---

# 5. Stable Country IDs

Countries must use stable identifiers independent of their display names.

Examples:

```text
IE
FR
IT
ES
PT
GB-ENG
GB-SCT
GB-WLS
GB-NIR
FO
MA
```

Do not use display names such as "France" as database identifiers.

This allows names and labels to change without affecting saved travel data.

---

# 6. Milestone 1 — Interactive Family Travel Map

## Goal

Create a simple working application that allows each family member to colour the countries they have visited.

This is the minimum viable version.

## Required functionality

### Home screen

Display:

# Our Family Travel Map

Five large profile buttons:

* Mum
* Dad
* Amelia
* Dylan
* Cian

Selecting a profile opens that person's map.

---

### Interactive map

The map should:

* display countries as individual SVG paths
* use white fill by default
* use black country borders
* allow tapping/clicking countries
* change visited countries to one clear colour
* allow clicking again to return the country to unvisited

The interaction must work on:

* desktop
* mobile phone
* tablet

---

### Independent profiles

Each family member must have their own travel data.

Example:

Dad may have:

* France
* Spain
* Italy

Dylan may have:

* France
* Italy

Cian may only have:

* France

Changing Cian's map must not affect Dylan's map.

---

### Visited counter

Display:

**Countries visited: X**

The counter updates immediately when a country is selected or deselected.

---

### Version 1 persistence

Use browser `localStorage`.

Data remains available when the browser closes and reopens.

The persistence system must sit behind a repository/interface layer.

Example:

```text
TravelRepository

LocalStorageTravelRepository
```

The UI must not directly depend on localStorage.

This allows later replacement with:

```text
FirestoreTravelRepository
```

without rewriting the application.

---

# 7. Milestone 2 — Shared Family Atlas

Milestone 2 transforms the colouring map into a real family travel record.

## Primary goal

Move data from individual browser storage to a shared online family database.

Everyone should see the same information regardless of which device they use.

---

## Cloud persistence

Use Firebase / Firestore or an equivalent simple hosted database.

Potential architecture:

```text
TravelRepository
      │
      ├── LocalStorageTravelRepository
      │
      └── FirestoreTravelRepository
```

The rest of the application should not care which storage system is being used.

---

# 8. Country Memory Pages

When a visited country is selected, a country page or panel should open.

Example:

# 🇫🇷 France

**Visited:** Yes

**Years visited:**
2025
2026

**Favourite memory:**

Swimming in the Mediterranean.

**Favourite activity:**

Rock diving.

**Favourite food:**

Crêpes.

---

## Possible fields

Each family member may eventually record:

* visited status
* dates visited
* years visited
* favourite memory
* favourite activity
* favourite food
* favourite place
* favourite restaurant
* rating
* would you visit again?
* notes

Not every field needs to be completed.

The experience should remain optional and fun.

---

# 9. Photo Memories

Each country should support photographs.

Example:

# France

📸 Photos

* Beach in Nice
* Kayaking
* Cannes
* Family dinner
* Waterfall

Users should be able to:

* upload photographs
* view thumbnails
* open photographs
* optionally add captions

Photo storage may use Firebase Cloud Storage or another appropriate service.

---

# 10. Video Memories

Family Atlas should eventually support linking videos to countries and trips.

Video may come from:

* family phone videos
* YouTube
* Dylan & Cian Adventures
* future family video projects

Prefer links to hosted video where practical instead of storing large video files directly.

---

# 11. Dylan & Cian Adventures Integration

Family Atlas should ultimately integrate with the family's **Dylan & Cian Adventures** project.

When the family visits a destination and creates a cartoon episode based on that trip, that episode can be linked to the relevant country.

Example:

# 🇫🇷 France

### Dylan & Cian Adventure

🎬 **The Boys Explore the French Riviera**

[Watch episode]

This connects:

**real family experience → memory → story → cartoon**

This is a core long-term opportunity for the platform.

---

# 12. Trips

Future versions should introduce the concept of a **Trip**.

Example:

# French Riviera 2026

Travellers:

* Mum
* Dad
* Amelia
* Dylan
* Cian

Countries:

* France

Activities:

* swimming
* beach
* kayaking
* waterfalls
* go-karting
* restaurants
* rock diving

Photos:

24

Videos:

3

Cartoon episode:

1

---

Trips can connect multiple family members to the same experience without duplicating all the information.

---

# 13. Family Memories

Not every important memory belongs to a country.

Family Atlas may eventually include broader family experiences such as:

* skiing trips
* birthdays
* Christmas
* Sligo farm adventures
* school milestones
* Leo the dog
* sports days
* family projects
* building the garden room
* football matches
* special days out

These should only be introduced after the travel functionality is working well.

---

# 14. Family Timeline

A later version may provide a chronological family timeline.

Example:

### 2026

🎿 Italy — First family skiing trip

🇫🇷 France — French Riviera holiday

🇪🇪 Estonia — Family wedding

🇸🇪 Sweden — Stockholm stopover

🐶 Leo joins the family

---

Over many years this could become an important record of family history.

---

# 15. Personal Travel Statistics

Each family member may eventually have their own statistics.

Example:

# Dylan

🌍 Countries visited: 18

🇪🇺 European countries: 16

🌍 Continents visited: 2

📸 Photos: 143

✈️ Trips: 29

🎬 Adventures: 11

---

These statistics should remain light-hearted rather than overly competitive.

---

# 16. Family Comparison

A future family dashboard may show:

| Family member | Countries visited |
| ------------- | ----------------: |
| Dad           |                32 |
| Mum           |                27 |
| Amelia        |                22 |
| Dylan         |                18 |
| Cian          |                15 |

This is intended to encourage curiosity and travel.

It should never create pressure or turn travel into a competition.

---

# 17. Wish List Countries

Users may later mark countries they would like to visit.

Possible states:

* White = not visited
* Green = visited
* Gold = want to visit

Example:

Japan — ⭐ Want to visit
Canada — ⭐ Want to visit
Iceland — ✅ Visited

---

# 18. Geography Learning

Family Atlas may eventually contain optional child-friendly geography information.

Clicking a country could display:

🇮🇹 Italy

Capital: Rome
Population: approximately 59 million
Currency: Euro
Language: Italian
Flag: 🇮🇹

Fun fact:
Italy looks like a boot.

This turns travel memories into geography learning.

---

# 19. Family Quiz Mode

A future game mode may include questions based on:

* capitals
* flags
* countries
* geography
* places the family has visited

Example:

**Which country did we visit in July 2026?**

A. Spain
B. France
C. Portugal

Or:

**What is the capital of Sweden?**

This could provide an educational element for Dylan and Cian.

---

# 20. Memory Prompts

Family Atlas should occasionally encourage memories without demanding them.

Example prompts:

* What was your favourite part of this trip?
* What made you laugh the most?
* What food did you enjoy?
* Where would you go back to?
* What surprised you?
* Who did you meet?
* What adventure should become a cartoon episode?

This should feel playful rather than like homework.

---

# 21. Milestone 3 — Family Atlas

Milestone 3 turns the application from a travel map into a broader family memory platform.

Potential features include:

* world map
* trip management
* photographs
* videos
* cartoons
* personal profiles
* family timeline
* geography learning
* quizzes
* travel wish lists
* statistics
* favourite destinations
* search

This milestone should only begin after Milestones 1 and 2 are stable.

---

# 22. Future World Map

The long-term map should support all countries globally.

The architecture should not assume the project will permanently remain Europe-only.

Possible navigation:

```text
World
│
├── Europe
├── Africa
├── Asia
├── North America
├── South America
├── Oceania
└── Antarctica
```

---

# 23. Future Mobile Experience

Family Atlas should remain a web application initially.

A Progressive Web App may later allow users to:

* add Family Atlas to their phone home screen
* use an app-style icon
* open full-screen
* receive updates automatically

A native iPhone or Android application is not required unless there is a compelling reason later.

---

# 24. Hosting

Initial hosting:

**Vercel**

Advantages:

* simple deployment
* GitHub integration
* HTTPS
* custom domains
* minimal server management

The project should avoid traditional hosting infrastructure unless necessary.

---

# 25. Source Control

Repository:

`MyTravelMap`

Potential future repository/product name:

**FamilyAtlas**

Branch strategy:

```text
main
```

Stable production version.

```text
init-v1
```

Initial development work.

Future development should normally occur in feature branches and merge into `main` after review.

---

# 26. Development Roles

### Product Owner

Family / Dad

Determines:

* family goals
* desired features
* priorities
* final product decisions

### Architect

ChatGPT

Responsible for:

* system architecture
* feature planning
* specifications
* development roadmap
* reviewing implementation choices
* preparing clear developer instructions
* keeping the project simple

### Developer

GitHub Copilot

Responsible for:

* writing code
* creating files
* fixing bugs
* implementing specifications
* running tests/builds where possible
* reporting technical issues

Copilot should not independently expand project scope.

---

# 27. Copilot Development Rule

Before implementing a significant feature, Copilot should be instructed:

> Read MASTER_SPECIFICATION.md before making changes. Follow the existing architecture and do not introduce new features outside the requested milestone.

For individual tasks:

> Read MASTER_SPECIFICATION.md. Implement only [specific task]. Do not change unrelated functionality.

---

# 28. Technical Principles

The codebase should favour:

* React
* TypeScript
* simple components
* minimal dependencies
* clean interfaces
* responsive CSS
* accessibility
* touch-friendly interaction

Avoid unnecessary:

* state-management frameworks
* server infrastructure
* microservices
* complicated build systems
* premature optimisation

---

# 29. Data Architecture

Core concepts should eventually include:

```text
Family
│
├── Profiles
├── Countries
├── Trips
├── Memories
├── Photos
├── Videos
└── Adventures
```

Example relationships:

```text
Trip
 ├── France
 ├── Mum
 ├── Dad
 ├── Dylan
 ├── Cian
 ├── Photos
 ├── Memories
 └── Cartoon Episode
```

---

# 30. Privacy

Family Atlas is intended primarily as a **private family application**.

Privacy must therefore be considered whenever new features are introduced.

Avoid exposing:

* children's school information
* home address
* private family information
* precise real-time location
* private photos

Public sharing should be deliberate and optional.

---

# 31. Backups

Once the application begins holding meaningful memories and photographs, backups become essential.

Future architecture should support:

* database backups
* photograph backups
* export functionality

The family should never be dependent on one proprietary service for irreplaceable memories.

---

# 32. Data Export

A future version should allow the family to export their data.

Possible formats:

* JSON
* CSV
* downloadable photo archive

This helps ensure Family Atlas remains a permanent family record.

---

# 33. Design Direction

Visual design should feel:

* warm
* modern
* simple
* adventurous
* family-friendly

The map should remain the main visual element.

Avoid turning the application into a corporate dashboard.

---

# 34. Colour System

Initial map:

* unvisited country = white
* borders = black
* visited country = one bright colour

Future possibility:

Different profile colours.

Example:

* Mum — purple
* Dad — blue
* Amelia — coral
* Dylan — green
* Cian — orange

Do not introduce this until it improves usability.

---

# 35. Current Development Status

Current branch:

`init-v1`

Already implemented or underway:

* Vite + React + TypeScript
* five family profiles
* TravelRepository abstraction
* LocalStorageTravelRepository
* countries.json
* interactive TopoJSON rendering structure
* visited-country toggling
* visited counter
* GitHub build/generation workflow under development

Current primary task:

**Complete and verify Milestone 1 interactive map.**

Do not begin Milestone 2 until Milestone 1 is running correctly in a browser and deployed.

---

# 36. Immediate Development Roadmap

## Phase A — Complete Milestone 1

1. Complete geographic map generation.
2. Verify every requested country is represented.
3. Verify UK constituent countries are individually clickable.
4. Verify Faroe Islands.
5. Test all five profiles.
6. Verify localStorage persistence.
7. Verify mobile layout.
8. Run production build.
9. Deploy to Vercel.
10. Test with the family.

---

## Phase B — Improve Milestone 1

After real family testing:

* fix confusing interactions
* improve map scaling
* improve mobile usability
* improve country labels if necessary
* improve visited colour
* add reset safeguards if needed

---

## Phase C — Milestone 2

Introduce:

* Firestore
* shared cross-device data
* country memory pages
* visit dates
* favourite memories
* photos

---

# 37. Future Ideas Backlog

Do not implement these yet.

Potential future ideas:

* family world map
* trip diary
* family photo albums
* YouTube integration
* Dylan & Cian Adventures integration
* country flags
* geography facts
* family quiz
* achievements/badges
* travel wish list
* passport-style stamps
* travel statistics
* printable maps
* yearly family travel report
* map animation showing countries unlocked over time
* grandparents' travel maps
* family tree integration
* Leo's adventures
* favourite holiday voting
* travel journal
* AI-generated trip summaries
* AI-generated children's stories from real trips
* automatically generate Dylan & Cian cartoon story ideas from travel memories

---

# 38. Long-Term Vision

Imagine opening Family Atlas when Dylan and Cian are adults.

They could see:

* every country they visited
* their first skiing holiday
* childhood holidays
* photographs with Mum and Dad
* videos
* favourite memories
* cartoon adventures they created as children
* places they want to revisit
* memories written in their own words

What begins as colouring countries on a map can gradually become a record of a family's life together.

That is the long-term purpose of Family Atlas.

---

# 39. Core Rule

When deciding whether to add a feature, ask:

> **Will this make it easier or more enjoyable for the family to remember, explore or share their experiences?**

If the answer is no, the feature probably does not belong in Family Atlas.

---

# 40. Current Priority

**Finish Milestone 1.**

Do not build ahead.

The next successful outcome should be:

> Mum, Dad, Amelia, Dylan and Cian can open Family Atlas, select their profile, tap countries they have visited, see them change colour, close the browser, return later and see their map exactly as they left it.

Once that works reliably, Family Atlas has officially begun.
