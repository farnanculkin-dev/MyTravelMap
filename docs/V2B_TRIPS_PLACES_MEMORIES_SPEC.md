# Family Atlas V2B — Trips, Places and Memories

## Status

Architectural specification for the first post-V2A product increment.

This document extends the Family Atlas Master Specification without replacing it. The existing principles remain controlling: family first, simplicity over complexity, child-friendly interaction, progressive delivery, and preservation of family history.

## 1. Product decision

Family Atlas records a person's whole travel life, not only trips taken with their current household.

A Trip is therefore primarily associated with people who participated in it. The current Atlas acts as the trusted sharing context and default audience, but it is not the semantic owner of every trip.

This allows all of the following without changing the model:

- a whole-family holiday
- Dad travelling alone
- Dad and one child travelling together
- a childhood trip involving Dad and his parents
- a trip with friends
- an extended-family trip involving people outside the current household Atlas
- a historic trip involving people who do not yet have Family Atlas accounts

## 2. Core concepts

### Person

A Person is the durable identity of a human being in Family Atlas.

Person identity must be independent of membership of any one Atlas so that the same person can participate in trips across different family/social contexts over many years.

A Person may be:

- linked to a real authenticated Family Atlas user
- represented by an existing Atlas profile
- an unregistered guest/historic person created only so a trip can be recorded

### Atlas

An Atlas is a private trusted sharing circle.

For Customer Zero this is currently the Culkin Family Atlas.

Atlas membership determines who normally sees content created within that trusted circle. It does not mean every Atlas member participated in every trip.

### Trip

A Trip is an independent travel experience created by a Person.

A Trip has participants. Participants do not all need to belong to the creator's Atlas.

For V2B, a trip is created in the context of one Atlas so that the existing Atlas can provide the default private audience and RLS boundary.

### Participant

A Participant is someone who actually went on the trip.

Participant and Viewer are deliberately different concepts.

Example:

- Dad, Grandmother and Grandad may be participants in a childhood trip.
- Mum, Dylan and Cian may be allowed to view that trip because they are in Dad's trusted Atlas, even though they were not participants.

### Place

A Place is somewhere associated with a Trip.

Examples:

- town
- hotel
- beach
- restaurant
- attraction
- activity venue
- landmark

### Memory

A Memory is a short recollection connected to a Trip and optionally to a Place.

A Memory may be contributed by one Person while referring to an experience shared by several participants.

## 3. Identity architecture

The current V2A `profiles` table is Atlas-scoped. Before meaningful cross-family trip data is created, V2B should introduce a durable Person layer rather than allowing Trip participants to depend permanently on Atlas-scoped profile IDs.

### New `people` concept

Proposed fields:

```text
people
- id uuid primary key
- linked_user_id uuid null
- display_name text
- created_by_user_id uuid null
- person_type text               -- registered | guest
- created_at timestamptz
- updated_at timestamptz
```

Rules:

- stable UUID for life
- a registered authenticated user should resolve to one durable Person identity
- guest people do not require email addresses or accounts
- guest people may later be connected to a real Family Atlas user/profile through a deliberate claim/link process
- no automatic linking based only on a matching name

### Existing profiles

Add:

```text
profiles.person_id uuid -> people.id
```

Backfill the five existing Customer Zero profiles one-to-one into `people` without changing their existing profile UUIDs, linked user IDs, travel data, photos or Atlas membership.

`profiles` continues to represent a person's presentation/member profile inside a particular Atlas.

`people` represents the durable human identity used by Trips and future Connections.

## 4. Trip model

Proposed V2B `trips` fields:

```text
trips
- id uuid primary key
- created_in_atlas_id uuid not null
- owner_person_id uuid not null
- created_by_user_id uuid not null
- title text not null
- start_date date null
- end_date date null
- description text null
- cover_photo_path text null
- visibility text not null default 'atlas'
- created_at timestamptz
- updated_at timestamptz
```

V2B visibility values:

```text
atlas
private
```

Default: `atlas`.

Meaning:

- `atlas`: visible to members of `created_in_atlas_id`
- `private`: visible only to the owner/creator for now

Do not build public sharing in V2B.

Do not imply that `created_in_atlas_id` means the Atlas participated in or owns the historical experience. It provides the trusted creation/sharing context and RLS boundary.

## 5. Trip participants

Proposed:

```text
trip_participants
- id uuid primary key
- trip_id uuid not null
- person_id uuid not null
- participant_role text null
- created_at timestamptz
unique(trip_id, person_id)
```

Participants may include:

- one or more of the five current family People
- guest People created using `+ Add someone else`
- later, connected People belonging to another Atlas

A Trip must have at least one participant.

The Trip owner should normally be included automatically as a participant but the data model should not assume all future trips are necessarily created by a participant on behalf of themselves.

## 6. Countries

Countries remain stable-ID based.

Use a join table rather than free-text country names:

```text
trip_countries
- trip_id uuid
- country_id text
primary key(trip_id, country_id)
```

`country_id` must use the same stable identifiers already used by the travel map, for example `IE`, `FR`, `ES`.

A Trip may contain multiple countries.

## 7. Places

Proposed:

```text
places
- id uuid primary key
- trip_id uuid not null
- name text not null
- category text null
- country_id text null
- notes text null
- photo_path text null
- created_by_user_id uuid not null
- created_at timestamptz
- updated_at timestamptz
```

V2B place categories can be free-choice from a small UI list:

- town/city
- accommodation
- restaurant/food
- beach
- attraction
- activity
- landmark
- other

No Google Places integration, geocoding, map pins, external ratings or real-time location in V2B.

## 8. Memories

Proposed:

```text
memories
- id uuid primary key
- trip_id uuid not null
- place_id uuid null
- contributor_person_id uuid not null
- title text null
- body text not null
- memory_date date null
- photo_path text null
- created_by_user_id uuid not null
- created_at timestamptz
- updated_at timestamptz
```

Rules:

- every Memory belongs to a Trip
- a Memory may optionally belong to one Place
- contributor identifies whose memory/story it is
- fields remain optional where possible so memory capture does not feel like form filling

## 9. V2B user experience

### Home

Preserve the existing Family Atlas country-map experience.

Add one clear entry point:

`Trips`

Do not replace the existing profile/map navigation.

### Trips screen

Show simple cards:

- cover photo if present
- title
- dates/year if present
- countries
- participant names

Primary action:

`+ Add trip`

### Create Trip

Keep the first form short:

- Trip name
- Dates (optional)
- Countries
- Who went?
- Description (optional)
- Cover photo (optional)

Participant picker initially shows existing family People and:

`+ Add someone else`

### Add someone else

Minimum V2B guest-person flow:

- Name
- Relationship/label optional

No email address is required.
No invitation is sent.
No Family Atlas account is required.

### Trip detail

Display:

- title / dates / cover photo
- countries
- participants
- description
- Places section
- Memories section

Actions:

- Edit trip
- Add place
- Add memory

The UI should favour photos, names and short text over administrative-looking forms.

## 10. Access and permissions

V2B must preserve the V2A security model.

For an `atlas` visibility Trip:

- members of `created_in_atlas_id` may read the Trip, its participants, Places and Memories
- the owner/creator may edit the Trip
- Atlas admin may retain recovery/moderation capability consistent with existing Customer Zero administration
- guest participants have no access simply because their name is attached
- being a Participant and having application access are separate facts

For a `private` Trip:

- only the owner/creator should read or edit it in V2B

Do not grant access to another Atlas in V2B.

## 11. Future V2C — Connections

Do not implement this in V2B, but V2B must not block it.

Future Connections should allow:

- Person-to-Person connection requests
- optional trusted Atlas-to-Atlas relationships
- selecting connected People as Trip participants
- sharing a Trip with selected connected People or another trusted Atlas
- converting/claiming a guest Person into a real registered Person after deliberate confirmation

Potential future tables:

```text
person_connections
atlas_connections
trip_access
person_claims
```

The future social model should remain private and family-centred rather than becoming an open public social network.

## 12. Explicit non-goals for V2B

Do not build:

- public profiles
- feeds
- likes
- comments
- followers
- direct messaging
- Google/Apple map integrations
- live location
- AI summaries
- videos
- cartoon integration
- wish lists
- timeline
- statistics
- quizzes
- full world-map expansion
- complex trip-level role systems
- automatic social discovery

## 13. Delivery sequence

Use the established Family Atlas integration workflow.

### V2B-0 — Person identity foundation

- add `people`
- add `profiles.person_id`
- safely backfill current five profiles
- add RLS and indexes
- prove no V2A behaviour changes

Acceptance: the existing deployed application remains visually/functionally unchanged and all five profiles resolve to durable People.

### V2B-1 — Trips core

- add `trips`
- add `trip_participants`
- add `trip_countries`
- RLS / write rules
- repository/runtime functions
- basic Trips list + create/view flow

Acceptance: Dad can create and reopen one cloud-persisted trip with any subset of existing family People.

### V2B-2 — Guest People

- add `+ Add someone else`
- create a guest Person
- attach guest Person to Trip
- do not require account/invite/email

Acceptance: create a childhood trip containing Dad plus two people outside the current Atlas.

### V2B-3 — Places and Memories

- add Places
- add Memories
- basic image support using private Atlas media storage
- preserve optional/low-friction entry

Acceptance: one real trip can contain several places, several memories and photos.

### V2B-4 — Deployed acceptance

Against persistent `develop`:

- CI typecheck/build passes
- migrations apply cleanly
- deployed Vercel environment passes smoke/E2E
- Trip survives refresh and new session
- Atlas members can view normal Atlas-visible trips
- private Trip access is restricted
- existing map/profile functionality remains intact

## 14. Customer Zero acceptance example

Use one real Family Atlas trip as the end-to-end V2B acceptance record.

Example structure:

```text
Trip: French Riviera 2026
Countries: France
Participants: selected family members
Places: 2–4 real places
Memories: 2–4 short memories
Photos: several
```

Also validate the non-household scenario with a simple historic/test trip containing Dad and guest People representing wider family/friends.

## 15. Product principle carried forward

Family Atlas should feel like remembering a life, not maintaining a database.

A minimal Trip with only a title, approximate date/year, participants and one photo is valid. Users can enrich it years later.

The model must preserve enough structure for the family record to grow for decades without requiring today's user to fill in tomorrow's fields.
