# V2B Google Photos Picker and media workflow

Family Atlas should treat Google Photos as a source for curated travel memories, not as a library to mirror wholesale.

## Product requirements

- Users can keep uploading photos from their device.
- Users can also choose photos directly from Google Photos.
- Google Photos selection must support multiple photos in one picking session so a user can scroll once and hand-pick a meaningful set (for example 10–15 photos from a larger trip library).
- Imported selections initially join the Trip gallery and can then be used for cover photos, Places or Memories.
- Family Atlas must not attempt a full-library Google Photos import.
- Existing device-upload behaviour remains available.

## Google Photos Picker API constraints

The Picker API creates a user selection session and returns a `pickerUri`. The app polls the session until the user finishes selecting media, then lists the picked media items and downloads the selected bytes into Family Atlas storage. The Picker API supports a configurable `maxItemCount`; Family Atlas should allow a practical batch size while keeping imports curated.

The Picker requires Google OAuth with scope `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` and a Google Cloud project with the Google Photos Picker API enabled. No Google client secret should ever be shipped to browser code.

## V2B implementation sequence

1. Add Trip entry point from each person profile/map with that person pre-selected.
2. Add remove/delete controls for Trip gallery photos, cover photos, Memory photos, Places and Memories.
3. Add Google Photos Picker client integration behind configuration so the app remains deployable before Google Cloud credentials are supplied.
4. Configure Google OAuth/Photos Picker credentials for the integration environment.
5. Validate multi-select import end to end on mobile and desktop.

## Acceptance

A user can open one trip, choose Google Photos, select multiple photos in one session, return to Family Atlas, and see all selected images in the trip gallery without manually downloading them first.
