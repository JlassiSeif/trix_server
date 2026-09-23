# Mutation check: does the station catch deliberate bugs?

| Deliberate bug | Expected check | Result | What the station flagged |
|---|---|---|---|
| lowest card wins the trick | `trick-winner…` | ✅ caught | trick-winner×264, trick-winner×224 |
| follow-suit not enforced | `follow-suit…` | ✅ caught | follow-suit×111, follow-suit×182 |
| diamonds worth 20 | `score-dineri…` | ✅ caught | score-dineri×8, score-general×8, score-dineri×8, score-general×8 |
| everyone multiplied, not just the picker | `score-…` | ✅ caught | score-dineri×20, score-pli×40, score-farcha×8, score-damet×4, score-general×12 |
| trix: a 10 fits right after the jack | `trix-placement…` | ✅ caught | card-conservation×84, trix-placement×4 |
| the view shows the next player's hand | `hand-…` | ✅ caught | privacy-hand×793, legal-not-in-hand×2189, hand-count×1298, played-card-not-held×711, follow-suit×79 |
| the look at the last trick goes to everyone | `privacy-peek…` | ✅ caught | privacy-peek×180, privacy-peek×39 |

7/7 caught.
