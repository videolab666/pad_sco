# Clutch 3.5.8 — static APK/XAPK UI/architecture analysis

Source file: `Clutch- AI for Padel_3.5.8_APKPure.xapk`
Package: `com.clutchapp.badminton`
Version: `3.5.8` (`versionCode 3139`)
minSdk: 24, targetSdk: 36

> This report is based on static analysis of the supplied XAPK/base APK and its Hermes bundle. It is intended for product/UI/architecture research, not for reproducing proprietary code or assets.

## 1. Stack

- React Native
- Expo Router
- Hermes bytecode
- NativeWind / Tailwind-like RN styling
- React Navigation
- Reanimated
- Expo Camera / CameraX
- PostHog analytics
- RevenueCat + payment integrations
- AWS/S3/CloudFront-style media delivery references
- Supabase references
- World Padel Rating OAuth integration

The main UI is not a classic XML Android Views application and is not primarily Jetpack Compose. Most product UI is in the React Native Hermes bundle.

## 2. Exact Expo Router screen tree recovered

```text
(public)
├── landing
├── login
├── register
├── verify-email
└── auth/callback

(authenticated)
├── onboarding
├── (home)
│   ├── index
│   ├── start/index
│   └── communities
│       ├── index
│       └── [clubId]
├── camera/[id]
├── match/[id]
├── highlights/[id]
├── stats/[matchId]
├── stream-fullscreen
├── downloads
│   ├── index
│   └── play
├── notifications
├── invite/[id]
├── post/[id]
├── user/[id]
├── support
└── settings
    ├── index
    ├── general
    ├── profile
    ├── password
    ├── notifications
    ├── delete
    ├── automated-recordings
    ├── automate-recordings-form
    └── dev
```

## 3. Important recovered component names

### Recording / court
- `StartScreen`
- `VenueControlPanel`
- `CameraListItem`
- `CameraRecordingOptions`
- `ActiveRecordingsScreen`
- `ActiveRecordingCard`
- `ScheduledRecordingCard`
- `RecordingInProgressModal`
- `RecordingProgressScreen`
- `JoinedRecordingProgress`
- `ScheduledRecordingProgress`
- `JoinRecordingConfirmationDialog`
- `LeaveRecordingConfirmationDialog`
- `QRCodeScannerModal`
- `EndRecordingQRScannerScreen`

### Match / highlights / AI
- `MatchScreen`
- `MatchVideoPlayer`
- `HighlightsTabInterface`
- `HighlightsStep`
- `MatchStats`
- `StatsScreen`
- `StatsRow`
- `KeyStatsDisplay`
- `ShotPositionTab`
- `PositioningTab`
- `CourtMap`
- `ClutchScoreInfoModal`

### Player assignment
- `PlayerSelectionModal`
- `AssignPlayerButton`
- `AssignPlayerModal`
- `TagPlayersModal`
- `TagPlayersContent`
- `TapYourselfModal`
- `UnassignedCropsWarningModal`
- `SelectPlayerImagesStep`
- `ScorePickerStep`
- `PlayerInfoCard`

### Library / social
- `DownloadsScreen`
- `PlayDownload`
- `VideoDownloadButton`
- `NotificationsScreen`
- `HomeClubsSelector`
- `ClubPostList`
- `PublicPostsList`
- `PostScreen`
- `ProfileScreen`
- `PublicProfileScreen`

## 4. Reconstructed primary navigation

Strings and tab icons strongly indicate a main navigation centered around:

```text
Home / Record / Community / Profile
```

with Record functioning as a primary action area rather than only a passive tab.

Deep screens include Match, Highlights, Stats, Downloads, Notifications and Camera.

## 5. Recording flow recovered from strings/components

### Starting

The app supports both QR and camera discovery:

```text
Start / Record
→ detect nearby venue or select venue
→ camera availability
→ tap court OR scan court QR
→ if court already has active recording: join it
→ otherwise configure/start recording
```

Recovered UI text includes:
- `Start recording your match with our AI-powered camera system`
- `Start recording`
- `Tap your court to start or join a recording.`
- `Start recording by scanning your court’s QR code or by finding the camera in the app.`
- `This court already has an active recording that needs to be ended before you can start a new one.`

### Multi-user active recording model

A recording has a host/owner and other players can join it.

Recovered behavior:
- `Join recording`
- `Join {{name}}'s recording?`
- `Only the recording host can stop the recording`
- leaving does not stop the recording for other players
- users can add themselves to an existing recording to receive their AI highlights/stats

This is a strong architecture pattern for a 4-player padel match: one physical recording session, multiple user participations/permissions.

### Ending

There is a dedicated `EndRecordingQRScannerScreen`.

Recovered text:
- `Point your camera at the QR code on the court display to end the active recording`
- `Scan QR code to end recording`
- `This QR code doesn't match the current court`

So QR acts as a physical-presence confirmation for stopping the court recording, not just for starting it.

### Recording states

Recovered state keys show a lifecycle close to:

```text
scheduled
→ recording
→ uploading
→ video processing
→ AI processing
→ full match / AI highlights
```

with failure/cancel states:
- uploadFailed
- failed
- cancelled
- unknownStatus

## 6. Automated recording / booking integration

This is a fully represented feature, not a placeholder.

Routes:
- `settings/automated-recordings`
- `settings/automate-recordings-form`

Components/steps include:
- `EnterBookingEmailStep`
- `ConfirmBookingAccountStep`
- `BookingProfileSelectStep`
- `OTPEnterStep`
- `YourBookingsTab`
- `AutomateRecordingsCard`

Recovered flow:

```text
Settings
→ Automated Recordings
→ link third-party booking account
→ enter booking email
→ OTP email verification
→ select booking profile
→ future bookings become visible
→ camera can start automatically at booking time
```

Relevant strings:
- `Link your booking account to record future matches automatically at this club.`
- `Your camera will start recording automatically at the scheduled time.`
- `You can still start a manual recording anytime.`
- `Only record your own court booking.`
- `Your bookings`
- `No upcoming bookings at this venue`

## 7. Match screen / highlight model

Recovered concepts clearly distinguish:
- full match
- standard recording
- AI highlight
- AI highlights tab
- video processing
- AI processing

The app also has explicit download and playback screens.

Likely product hierarchy from recovered routes/components:

```text
Match
├── Video / Full match
├── Highlights
├── Stats
├── Players / assignments
├── Share
└── Download
```

## 8. Player identification / tagging flow

Player identity is a first-class workflow rather than a simple text field.

Available actions include:
- `This is me`
- search Clutch users
- assign/tag an existing Clutch user
- invite by email
- enter player name manually
- select player images/crops
- warn about unassigned crops
- specify/derive player position

This suggests computer-vision player crops are presented for verification/assignment.

Recovered analytics events also include concepts such as:
- player tagged as self
- player tagged as user
- player tagged by email invite
- player tagged name-only
- annotation player 1..4
- re-identify players

## 9. Stats / computer-vision UI

Recovered components and labels support at least:
- court coverage / positioning
- shot position
- shot placement
- shot trajectories
- drive
- serve
- overhead
- smash
- bandeja
- vibora
- bajada
- chiquita
- distance run
- winners/errors-related analysis
- player comparison / progress

The app has a `CourtMap` visualization and separate `ShotPositionTab` and `PositioningTab`.

## 10. Social / community layer

Clutch is not only a private video locker.

Recovered functionality includes:
- Communities by club
- club/public posts
- public user profile
- share highlights to community
- leaderboard
- promoted highlights
- public recording visibility
- sharing a match directly with another player

A recording can be public and count toward leaderboards, so recording visibility is a domain property (`recordingVisibility`).

## 11. Downloads / offline video

There is a dedicated downloads subsystem:

```text
Downloads
├── Active
├── Completed
├── Paused
├── Failed
└── Play downloaded video
```

Recovered labels:
- `downloads.active`
- `downloads.completed`
- `downloads.downloading`
- `downloads.paused`
- `downloads.failed`
- `downloads.tapToPlay`
- `downloads.clearAll`

## 12. UI design tokens recovered

Clutch uses NativeWind utility classes.

### Brand / surfaces
High-confidence app colors found repeatedly:

```text
Primary dark green: #004723
Soft green surface: #EBF0EE
Dark text: #121317
White: #FFFFFF
Error/red examples: #FF3B30 / error-500
```

Other colors exist for charts, status states, libraries and system UI; they should not all be treated as brand tokens.

### Shape
Common recovered styles:

```text
rounded-[41px]     // pill buttons/chips
rounded-[10px]     // media/card thumbnails
```

### Spacing examples

```text
h-8 px-4 py-2
h-12 px-5 py-2
px-6 py-4 gap-5
px-2 py-2.5
gap-6
px-5
```

### Typography examples

```text
12 / 12 normal or medium
13 / 13 normal
14 / 14 normal or medium
16 / 16 normal or medium
17 semibold
18 / 18 medium
20 / 20 medium
26 / 26 medium
36 / 36 medium
```

Recovered examples:

```text
text-[17px] font-semibold text-greys-900
text-base text-[#004723]
text-[26px] leading-[26px] font-medium
text-[36px] leading-[36px] font-medium
```

Font-family evidence is less definitive than colors/spacing; do not assume every `Inter`/`Sora` string in the bundle is necessarily the global product font without runtime verification.

## 13. Useful domain/model identifiers visible in bundle

Examples useful for reconstructing product architecture:

```text
recording
recordings
recording_type
recordingVisibility
recording_participation
isHost
match
matches
match_id
match_players
player
players
venue
venue_id
court
highlight
videos
booking_platform
scheduledMatches
nextBooking
assignedPlayers
annotatedPlayers
shots
shotsByPlayer
shotsByZone
playerShots
```

This supports separating the domain into at least:

```text
Venue
Court / Camera
Booking
RecordingSession
RecordingParticipation
Match
MatchPlayer
Highlight
VideoAsset
Stats / Shots
User
Community/Post
```

## 14. Product lessons worth borrowing (without copying code/assets)

1. **One court recording, multiple participants** — do not create a separate video session for each player.
2. **Host vs participant roles** — only the host stops the recording; others can leave without disrupting it.
3. **Join active recording** — essential for doubles when one player already started the camera.
4. **QR as physical court confirmation** — especially useful for destructive actions such as Stop.
5. **Booking-based auto-recording** — can remove QR friction for regular users.
6. **Processing state is visible** — a match should exist in the library before processing finishes.
7. **Player identification is a workflow** — support self-tag, registered users, invitations, manual names, and CV crop assignment.
8. **Video / Highlight / Stats are children of one Match** — cleaner mental model than separate storage silos.
9. **Downloads deserve their own lifecycle** if full matches are large.
10. **Private core + optional community layer** — social features can remain secondary to recording/highlight UX.

## 15. Suggested architecture for our product based on this research

```text
HOME
├── Current / upcoming booking
├── Active recording
├── Start / Scan court
├── Last match
└── Recent highlights

RECORD
├── QR scan
├── Nearby club / court discovery
├── Join active recording
├── Full match / Highlights-only
└── Recording progress + physical-button events

MATCHES
├── My
├── Shared / Joined
├── Processing
└── Claim missing recording

MATCH
├── Full video
├── Manual highlights
├── AI highlights
├── Players
├── Stats
├── Share
└── Download

HIGHLIGHTS
├── Manual physical-button moments
├── AI moments
├── Grid
└── Reel viewer / export

PROFILE
├── Clubs
├── Booking integrations
├── Recording defaults
├── Downloads/storage
├── Privacy
└── Subscription
```

## 16. What still requires runtime inspection

Static APK analysis cannot fully prove:
- exact visual arrangement of every screen at runtime
- animation timing and transitions
- server-side logic
- all conditional screens hidden behind feature flags/account tiers
- exact API response schemas where types were compiled away/minified
- camera hardware sensor/model

The next high-value step would be runtime screen capture or emulator/device instrumentation while walking through the UI, then matching each screen to the recovered route/component/token map.

## 17. Conflict handling: what happens if a court already has an active recording?

This section answers the practical no-CRM scenario: one player starts recording, leaves without stopping it, and the next player arrives for the same court; or players move to another court mid-match.

### 17.1 What Clutch 3.5.8 clearly does for manual recordings

Static analysis of the supplied Hermes bundle contains the following user-facing strings and component/action names:

```text
Join one of the active recordings or start a new recording.
Join {{name}}'s recording?
Already joined this recording
Failed to join recording. Please try again.

This court already has an active recording that needs to be ended before you can start a new one.

Only the recording host can stop the recording.
You can leave the recording, but it will continue for other players.

Scan QR code to end recording
Point your camera at the QR code on the court ...
This QR code doesn't match the current court

Are you sure you want to stop the recording? Your match will be saved.
Failed to stop recording
```

Recovered names around this flow include:

```text
ActiveRecordingsScreen
ActiveRecordingCard
JoinRecordingConfirmationDialog
LeaveRecordingConfirmationDialog
EndRecordingQRScannerScreen
handleConfirmJoin
handleLeaveRecording
leaveRecording
handleCancelRecording
stopSession
RECORDING_PARTICIPATION
isHost
```

The most defensible interpretation is:

1. A court/camera can have one active recording session.
2. Other users may join that same recording session.
3. A second independent manual recording cannot be started on the same court while the first is active.
4. A participant who is not the host may leave without stopping the camera/session for the others.
5. Normal Stop is host-controlled.
6. Stopping the active recording requires scanning the QR for the same/current court, giving Clutch a physical-presence check.
7. The client explicitly rejects a QR that belongs to another court.

Therefore, for the exact case "the previous player forgot to stop and left", Clutch 3.5.8 does **not** expose an obvious ordinary manual `Take over this court` action in the recovered UI strings. The new player is expected either to join the existing recording or wait for/end the existing recording through the permitted flow.

### 17.2 Minimum recording time / delayed finish

The bundle also contains:

```text
Can be finished in {{time}}
Please wait until 1 minute has passed
```

This strongly suggests that a newly started recording cannot be ended immediately and that the UI enforces at least a short minimum duration. Static analysis does not prove the exact server-side rule beyond the visible one-minute wording.

### 17.3 A separate scheduling conflict path exists

The bundle contains a more powerful scheduling path with strings such as:

```text
Ending recording and scheduling new one...
Ending this recording will stop it immediately and it will be processed. The owner of the recording will be notified.
The previous recording was stopped. Please try scheduling manually.
Scheduling your new recording...
Schedule recording (DEBUG)
```

This is important: the Clutch client contains logic for a situation where a new scheduled recording conflicts with a previous active recording and the previous recording can be stopped, processed, and its owner notified.

However, static APK analysis alone cannot prove whether this path is:

- used by the normal automated-booking feature,
- club/operator tooling,
- an internal/dev screen,
- or some combination of these.

Because `Schedule recording (DEBUG)` is also present in the same bundle, this should **not** be treated as proof that every ordinary user can force-stop another user's active manual recording.

### 17.4 Court switching is not visible as a first-class Clutch flow

Searches across the recovered bundle did not reveal a clear user-facing `Move match`, `Switch court`, `Change court`, or equivalent route/component for moving one active match between cameras while retaining one Match identity.

Therefore, Clutch 3.5.8 does not give us strong static evidence for the desired model:

```text
one Match
  -> segment on Court 3
  -> segment on Court 5
```

It may be handled server-side or through separate recordings, but that is not recoverable confidently from this APK.

## 18. Advanced no-CRM conflict model for our product

> **Status:** architectural target / future hardening. For the simpler MVP with only a static QR, see **Section 23**, which supersedes this section as the recommended first implementation.

For our product, the camera should **not** be conceptually owned or locked by a user's phone. Separate the physical camera stream from the user's logical match/session.

### 18.1 Camera recording and Match should be different layers

Recommended model:

```text
COURT
  -> CAMERA
       -> continuous / rolling segmented video

MATCH
  -> players
  -> one or more RecordingSegments
  -> highlights
  -> stats
```

The camera can continuously create short encoded chunks, for example:

```text
18:20:00 -> 18:21:00
18:21:00 -> 18:22:00
18:22:00 -> 18:23:00
...
```

A user pressing `Start recording` does not need to physically start the encoder. It primarily creates a logical time range:

```json
{
  "match_id": 91842,
  "court_id": 3,
  "start_time": "18:22:17",
  "end_time": null
}
```

Stopping closes the range:

```text
end_time = 19:47:31
```

This greatly simplifies crash recovery, forgotten Stop, highlights, court changes, and overlapping user actions.

### 18.2 Add a soft CourtLease, not a hard camera lock

Use a short-lived coordination entity:

```text
CourtLease
- court_id
- match_id / recording_session_id
- host_user_id
- started_at
- expected_end
- hard_end
- status
```

The lease exists to resolve **user conflicts**, not to control whether the physical camera encoder is running.

Example:

```text
Alex / Court 3
start:        17:00
expected_end: 18:30
hard_end:     18:45
```

If Alex disappears, the logical session can auto-close at `hard_end` while the underlying rolling camera buffer remains healthy.

### 18.3 Forgotten Stop: next-player takeover flow

If a new player scans Court 3 after the previous expected end:

```text
Court 3 is currently recording
Started 17:00
Expected to finish 18:30

[ Join recording ]
[ Start my session ]
```

`Start my session` should require a **fresh scan of the QR on that court**.

After confirmed takeover:

```text
old_session.end_time = takeover_time
old_session.end_reason = "taken_over"

new_session.start_time = takeover_time
new_session.court_id = 3
```

No physical video has to be lost or restarted at the boundary.

### 18.4 Takeover safety rules

Recommended checks, without requiring club CRM:

1. Fresh court QR scan for takeover.
2. If the current session is still well inside its expected duration, show `Join` as the primary action and put takeover behind an explicit secondary flow.
3. Notify the previous host: `Someone is trying to start a new session on Court 3`.
4. Give the previous host a short `I'm still playing` action when online.
5. Optionally use a brief takeover countdown.
6. If the court has a physical button/display, allow `QR + court button` as stronger local confirmation.
7. Never let a remote user stop/take over a court purely from a saved court identifier.

The system should be safe enough to prevent casual disruption but should not allow an abandoned session to block the next paying player indefinitely.

### 18.5 Dynamic QR is preferable where a court display exists

If a court has an Android/OnePlus display or another controllable screen, use a rotating QR token:

```text
court_id = 3
token = ef912...
expires_at = now + 60 s
```

This is stronger than a permanently printed QR because an old photo of the code cannot later be used remotely to Start/Stop/Takeover the court.

A printed static QR remains acceptable for the first version if the physical-security risk is low.

## 19. Mid-match court switching without CRM

Court changes should not force the user to create a second Match.

### 19.1 One Match can contain multiple RecordingSegments

Recommended schema:

```text
MATCH #8421
Alex / Ivan vs Max / Oleg

RecordingSegment #1
- Court 3
- 17:02 -> 17:48

RecordingSegment #2
- Court 5
- 17:50 -> 18:34
```

User UX:

```text
You have an active match on Court 3

[ Move match to Court 5 ]
[ Start a new match ]
```

`Move match to Court 5` requires scanning Court 5's QR and performs approximately:

```text
segment_1.end_time = switch_time
segment_2.start_time = switch_time
segment_2.court_id = 5
match_id stays unchanged
```

The final Match is presented as one continuous logical object even though the video comes from multiple physical cameras/files.

### 19.2 Timeline representation

Example:

```text
Match • 1h 30m

---- Court 3 ----|---- Court 5 ----
                 ^
             court changed
```

The player does not need to understand file boundaries.

### 19.3 Highlights survive court switching naturally

Highlights should reference Match + source RecordingSegment/time range rather than a copied standalone file:

```text
HighlightMarker
- id
- match_id
- recording_segment_id
- created_by
- source = physical_button | app_button | ai
- timestamp
- before_seconds
- after_seconds
```

Example:

```text
MATCH #8421

Court 3
17:00-17:45
  * 17:12 button
  * 17:38 button

Court 5
17:48-18:30
  * 17:57 button
  * 18:21 AI
```

In the app these can still appear as one simple relative timeline:

```text
12:14
38:23
54:51
1:18:12
```

## 20. Participants and host continuity

A phone should not be a single point of failure.

Recommended relationship:

```text
RecordingSession
- host
- participants[]
- optional co_hosts[]
```

If the host's phone dies, the server still knows the court/session and the camera continues writing segments. When the user returns, the app can restore:

```text
Active match
REJO • Court 3
Started 48 min ago
[ Continue ]
```

If the original host leaves early, a participant can optionally be promoted to host/co-host. Suggested permissions:

```text
Participant:
- create highlight
- view active session
- leave session

Host / Co-host:
- create highlight
- switch court
- finish match
- manage participants

Nobody during play:
- destructive deletion of source media
```

This improves on a strict single-host model for doubles and protects the session from a dead/lost phone.

## 21. Recommended conflict state machine

```text
IDLE COURT
   |
   | fresh QR / automatic start
   v
ACTIVE LEASE
   |\
   | \ participant scans
   |  -> JOIN SAME SESSION
   |
   | expected end exceeded + next player scans
   |  -> TAKEOVER
   |       old segment closes
   |       new session/segment opens
   |
   | same players scan another court
   |  -> MOVE MATCH
   |       old segment closes
   |       new segment on new court opens
   |
   | host/co-host Stop
   |  -> CLOSE MATCH
   |
   | hard_end timeout
   v
AUTO-CLOSED
```

This entire model works without CRM integration. CRM/booking integration can later improve expected start/end times and auto-start, but it should not be a prerequisite for correct court conflict handling.

## 22. Clutch vs advanced conflict model for this edge case

| Scenario | Clutch 3.5.8 evidence | Recommended for our product |
|---|---|---|
| Another user joins active court recording | Yes, explicit Join flow | Yes |
| Second independent manual recording on same active court | Explicitly blocked | Allow only after verified takeover |
| Non-host stops current manual recording | Explicitly blocked | Host/co-host or verified takeover policy |
| Stop verifies physical court | Yes, QR/current-court check | Yes; preferably dynamic QR |
| Forgotten Stop automatically stops blocking next user | Not proven from APK | Yes, expected_end + hard_end |
| Force-stop conflicting previous recording | A scheduling code path exists; normal-user availability not proven | Yes, but only via physically verified takeover |
| Switch same Match to another court | No clear first-class flow found | Yes, Match = N RecordingSegments |
| Host phone disappears | Server session likely survives, but exact policy not proven | Explicitly supported |
| CRM required | No for manual recording | No |

### Product conclusion

Clutch's conservative rule is understandable: **one active recording per court and join it rather than create another one**. The weakness for a club without booking/CRM integration is the abandoned-session edge case.

The `CourtLease + verified takeover` model above remains a useful **future hardening option**, especially after dynamic QR, booking integration, or a court display is available. For the first release with only a printed static QR, however, it is more complexity than we need. The revised MVP recommendation is in Section 23.

## 23. Revised MVP recommendation: static QR + overlapping logical sessions

For the first commercial version **without club CRM integration and with only a static printed QR**, do **not** make the camera exclusive to one user and do **not** block a court because another user forgot to press Stop.

The physical camera stream and the user's logical recording session should remain separate.

### 23.1 Core principle

```text
COURT CAMERA
    -> continuous / rolling segmented video

USER SESSION A: 17:00-18:30
USER SESSION B: 18:02-19:32
USER SESSION C: 19:25-20:55
```

Several logical user sessions may reference the same underlying camera stream at the same time. Starting a user session does **not** start or reserve the encoder.

This means there is no technical reason for a second player to receive `Court busy` simply because someone else still has an open logical session.

### 23.2 Default recording duration

Recommended first version:

```text
Default: 90 min
Options: 60 / 90 / 120 min
```

When the user scans a court QR and presses Start:

```text
session.start = now
session.planned_end = now + selected_duration
```

The user may still press `Finish match` earlier. If they never do, the session closes automatically at `planned_end`.

A small media margin can be retained around the logical range, for example:

```text
video_start = session.start - 30 sec
video_end   = session.end   + 15 sec
```

This protects against slightly late Start/Stop actions without exposing a large amount of unrelated court footage.

### 23.3 What happens when another user starts on the same court

Do **not** automatically reject the second user.

Use a simple age-based rule for the already active logical session. A reasonable initial threshold is about **60 minutes** for a 90-minute default session. This value should later be tuned from real club usage data.

```text
Existing session age < 60 min
    -> keep it active
    -> create the new session in parallel

Existing session age >= 60 min
    -> close the old logical session at the new user's start time
    -> create the new session immediately
```

Example 1 — probably the same match / another participant:

```text
Alex starts: 17:00
Ivan scans:  17:20

Alex: 17:00 -------------------- planned end
Ivan:        17:20 -------------------- planned end
```

Both sessions remain valid because the second scan happened only 20 minutes later. They may simply be two participants in the same match who both want access.

Example 2 — probably the next booking:

```text
Alex starts: 17:00
Ivan scans:  18:12

Alex session age = 72 min
```

At Ivan's Start:

```text
Alex.end_time   = 18:12
Alex.end_reason = "superseded_by_new_session"

Ivan.start_time = 18:12
```

The camera itself never stops or restarts. Only the logical ownership/time ranges change.

### 23.4 Why overlapping sessions are preferable to a hard lock

A hard one-recording-per-court rule creates avoidable failures:

```text
previous player forgot Stop
    -> next paying player cannot start

host's phone died
    -> court may remain blocked

players both want the match in their own account
    -> artificial conflict
```

With overlapping logical sessions:

```text
one camera stream
    -> many cheap timestamp/range references
```

The extra cost is mostly metadata until the user requests playback/export.

### 23.5 Known downside: the old user may receive footage of the next group

If a player leaves early and nobody presses Finish, their 90-minute logical window can temporarily include the next players.

The threshold rule limits this. For example:

```text
Alex starts 17:00
Alex actually leaves 17:55
Ivan starts 18:00
```

Because Alex's session age is only 60 minutes at the boundary, the exact policy determines whether we close it immediately or allow overlap. This is why the threshold should be configurable rather than deeply hard-coded.

Recommended MVP starting point:

```text
DEFAULT_DURATION = 90 min
SUPERSEDE_AFTER  = 60 min
```

After real usage data is available, `SUPERSEDE_AFTER` can move to 65, 70, 75 minutes or become venue-configurable.

### 23.6 Privacy mitigation for the MVP

Because the static QR does not prove current physical presence and because logical windows may overlap, keep the first implementation conservative:

1. Matches are **private by default**.
2. A user gets access only to the specific logical time range assigned to their session, not to the full day's camera archive.
3. Keep only a small pre-roll/post-roll margin.
4. Do not expose a UI for reopening arbitrary historical court time ranges.
5. Limit one active court session per user account unless the product later has a clear multi-court use case.
6. Rate-limit repeated Start actions on the same account/device.
7. Do not treat a previously scanned static QR as permanent remote control of that court; require an actual QR scan for each new Start flow in the UI.

A photographed static QR can still be reused remotely, so this is not strong proof of presence. Dynamic QR/BLE/local-network validation can be added later if abuse appears in practice.

### 23.7 Physical-button highlights remain independent

Highlights should remain simple timestamp markers:

```text
HighlightMarker
- court_id
- session_id / match_id
- timestamp
- source = physical_button | app | AI
- before_seconds
- after_seconds
```

No separate video file needs to be created at button press time.

If several logical sessions overlap the timestamp, the backend can associate the highlight with the correct session/user based on button identity, current app session, account pairing, or later product rules.

### 23.8 Mid-match court change remains future-compatible

Even with this simplified MVP, keep the underlying data model capable of:

```text
Match
  -> RecordingSegment[0] Court 3
  -> RecordingSegment[1] Court 5
```

The first UI does not need sophisticated `Move match` conflict handling. Later, scanning a second court while the user has an active match can simply close the current segment and open a new segment under the same `match_id`.

Therefore do **not** model the database as:

```text
1 Match = 1 Camera = 1 Physical File
```

Prefer:

```text
1 Match = N logical RecordingSegments
RecordingSegment -> court/camera + start/end timestamps
```

### 23.9 Recommended MVP state flow

```text
SCAN STATIC COURT QR
        |
        v
COURT IDENTIFIED
        |
        v
[ START 90 MIN ]
        |
        v
CREATE LOGICAL USER SESSION
        |
        +--> existing session < threshold
        |       -> overlap allowed
        |
        +--> existing session >= threshold
                -> close stale/old logical session
                -> start new session

CAMERA ENCODER CONTINUES INDEPENDENTLY
        |
        +--> user presses Finish
        |       -> close session early
        |
        +--> planned_end reached
                -> auto-close session
```

### 23.10 MVP vs Clutch

| Scenario | Clutch 3.5.8 | Recommended MVP |
|---|---|---|
| Existing active court recording | Blocks a new independent recording | Does not hard-block the court |
| Second player during same match | Join existing Clutch recording | May create an overlapping logical session |
| Previous host forgot Stop | Potentially problematic for manual flow; exact auto-cleanup not proven | Auto-close at planned duration; newer session may supersede after threshold |
| Camera encoder ownership | Coupled more strongly to active recording concept | Independent continuous/rolling stream |
| Static QR only | Supported | Supported |
| CRM required | No | No |
| Court switch | No clear first-class flow recovered | Data model remains ready for `Match = N segments` |
| Implementation complexity | Higher coordination / permissions | Low |

### Final recommendation for v1

For a first deployment with **static QR codes and no CRM**, use the simple session model:

```text
continuous segmented camera stream
+ 90-minute default logical user sessions
+ early Finish button
+ automatic planned_end
+ overlapping sessions allowed early in a session
+ supersede/close an older session after a configurable age threshold
+ timestamp-based highlights
+ private-by-default access
```

Do **not** introduce a hard `Court busy` lock, host takeover protocol, or mandatory Stop QR in v1. Those can be added later if real-world club usage shows that the simpler model produces abuse or ambiguous session ownership.
