# Internet Archive (archive.org) as 2nd archival source — research report
Date 2026-10-13. Probes: ~150 polite requests (UA with contact, >=2s gap). IA search backend was DOWN (HTTP 502 / 200+`BACKEND_ERROR`) for ~15 min during probing, recovered after; metadata API stayed mostly up. Mirrors `src/stock/wikimedia.ts` shape (search -> candidates JSON -> pick -> frame 1920x1080 -> `visual.source`).

## 0. TL;DR (ranked recommendation)
1. Use **advancedsearch.php** for search (not Scrape), **/metadata/<id>** for files, **/download/<id>/<file>** for fetch. Node fetch only, no deps.
2. **Never trust `licenseurl` alone.** Verified: `apollo-11-mission` (user upload, collection `culturalandacademicfilms`) carries Public Domain Mark but `rights` = "Fair Use Notice"; `apollo-11-4-k-48fps` is NASA footage re-uploaded as **CC BY-NC-ND**. Rule = **collection whitelist AND licenseurl allowlist** (NASA exception below).
3. **Drop the >=720p rule for IA film.** Of 80 sampled whitelisted items: only 1 had an mp4 >=720p (NASA 4K), 6 had any >=720p file (all huge .mov/.mxf originals). Realistic: Prelinger/newsreels/FedFlix = 640x480 (4:3), NASA Apollo onboard = 852x480. Recommend min height 480 (accept 360 for 16:9 NASA/WWII-archive), pillarbox/blur-fill, flag "SD archival" in candidate JSON.
4. Images: IA is **weak** for archival stills (Commons stays primary). Only NASA images (188k, PD by US gov, no licenseurl) and a few `mediatype:image`+PD-mark user collections. File metadata has **no width/height for images** -> must ffprobe after download.
5. IA best for **moving footage** of 1920s-1960s: newsreels, US gov films, ad/educational ephemera, NASA.

## 1. API endpoints + exact queries
### 1a. advancedsearch.php (RECOMMENDED)
`GET https://archive.org/advancedsearch.php?q=<lucene>&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=date&fl[]=licenseurl&fl[]=rights&fl[]=downloads&fl[]=collection&fl[]=possible-copyright-status&sort[]=downloads desc&rows=20&page=1&output=json`
- Verified working fields: identifier,title,creator,year,licenseurl,downloads,collection (+`rights`,`possible-copyright-status`,`description`,`date` accepted; absent keys are simply omitted per doc — check `undefined`).
- Response: `{responseHeader:{params:{query:<rewritten>}}, response:{numFound,start,docs:[…]}}`. Sample: `numFound 1086` for prelinger+movies+war.
- **Free-text term is rewritten** to `(text:war OR text:war OR text__reviews:war)` — matches full-text/reviews, noisy. Prefer `title:(war) OR subject:(war) OR description:(war)`.
- Deep paging cap: page*rows > 10,000 -> `{"error":"[DEEP_PAGING] … 10000 results"}` (HTTP 200!). Irrelevant for us (rows<=50).
- **Errors come as HTTP 200 + `{"error":"[BACKEND_ERROR] Invalid or no response from Elasticsearch"}`** or HTTP 502 HTML. Check `json.error` and content-type; retry w/ backoff.
- URL-encode properly (`URLSearchParams`); `AND/OR`, parentheses, ranges `year:[1940 TO 1945]`, wildcard `licenseurl:*` all verified.
- Collection ids are **case-sensitive for filtering**: `collection:FedFlix` -> 1509 hits, `collection:fedflix` -> 0.

Ready-to-use queries (all executed OK):
```
# footage, whitelisted + licensed, WWII-ish
(collection:universal_newsreels OR collection:prelinger OR collection:FedFlix) AND mediatype:movies AND licenseurl:* AND (title:(war) OR subject:(war) OR description:(war)) AND year:[1939 TO 1945]
# NASA footage (no licenseurl on most)
collection:nasa AND mediatype:movies AND (title:(apollo) OR subject:(apollo))
# NASA stills
collection:nasa AND mediatype:image AND title:(apollo)
# 1950s ads
collection:prelinger AND mediatype:movies AND licenseurl:* AND year:[1950 TO 1959] AND (advertising OR commercial)
```
Sizes (numFound, 2026-10-13): prelinger movies 10,461 (only **1,914 = 18% have licenseurl**); universal_newsreels 611 (595 licensed); nasa movies 13,774 (**719 = 5% licensed**); nasa images 188,765; FedFlix 1,509 (all sampled had licenseurl); `mediatype:image AND licenseurl:*publicdomain*` 288,446 (mostly user uploads).

### 1b. Scrape API (not recommended here)
`GET https://archive.org/services/search/v1/scrape?q=…&fields=identifier,title,licenseurl,downloads&count=100&sorts=downloads desc[&cursor=…]`
- Verified: 200, `{items,count,cursor,total}`; `count` **min 100** (`count '10' is too small (min count=100)` HTTP 400); `sorts` works; cursor = base64; no cursor = end. Needed only to walk >10k results.
- Without `sorts` order is by identifier. Heavier payload (>=100 rows) for no gain. Use only if ever bulk-indexing a collection.
- Docs (mirror): https://doc-tools.readthedocs.io/en/ia-test-gsod/item-search-apis.html ; Swagger: https://archive.org/services/search/v1 (404 for swagger.json guess; page is the spec).
- Quirk seen in scrape error echo: query adds `must_not: collection:geo_restricted AND geo_restricted:VN` -> **search silently hides geo-restricted items for the caller's country** (user is in VN). Results may differ from browser abroad; rare.

## 2. Metadata API + file selection
`GET https://archive.org/metadata/<id>` -> `{metadata:{identifier,title,creator,date,year,licenseurl,rights,collection[|str],mediatype,possible-copyright-status…}, files:[{name,format,source,width,height,length,size}], server, dir, item_size}`
- Unknown id -> `{}` HTTP 200 (check `files`). `metadata.collection` and `creator` are **string OR array**. `width/height/length/size` are **strings**; `length` sometimes "10:58" (mm:ss, e.g. mp3 derivatives) vs seconds. `width/height` absent on audio/images.
- `source`: `original` (uploaded) vs `derivative` (IA-made). Formats seen: `h.264` (640x480 derivative, the usual best), `h.264 HD`, `h.264 IA`, `MPEG4`, `512Kb MPEG4` (320x240), `HiRes MPEG4`, `Ogg Video`, `Animated GIF`, `Thumbnail`, `QuickTime` (.mov original, may be 1280x720–2048x1536, 0.3–13 GB), `MPEG2` (.mpeg original, 640x480, 0.2–4 GB; **only 320x240 mp4 exists for FedFlix**), `MXF`.
- Download URL: `https://archive.org/download/<id>/<name>` (percent-encode name; names contain spaces/brackets). 302 -> `dnNNNNNN.*.archive.org/...`; fetch follows redirects.
- **Range supported**: `accept-ranges: bytes`; `-r 0-65535` -> 206 (verified). **ffmpeg seeks on URL fine**: `ffmpeg -user_agent UA -ss 300 -i https://archive.org/download/American1958_3/American1958_3.mp4 -t 5 …` produced exact 4.97s clip in 8s (68 MB file; moov up front -> reads only needed ranges). Another test (5.7 MB 320x240 mp4) took 51s during outage — server-latency bound. Pass `-user_agent`. Prefer: ffmpeg `-ss` on URL for clip (small egress) rather than downloading whole file; fallback download whole file if file < ~150 MB.
- Item-size reality: derivative mp4 = 40–120 MB for 10–40 min; .mov/.mxf originals = GBs, not worth it unless 720p is truly needed.

Pseudo-code:
```
pickVideoFile(files):
  cands = files.filter(f => /\.(mp4|m4v)$/i.test(f.name)            // seekable, ffmpeg-friendly
             && /^(h\.264( HD| IA)?|MPEG4|HiRes MPEG4|512Kb MPEG4)$/.test(f.format)
             && +f.width>0 && +f.height>0 && !/\.thumbs\//.test(f.name))
  // prefer: height desc, then source=derivative (smaller, web-optimised) unless original is h264 HD, then size asc
  best = sort(cands, [-height, derivativeFirst, size])[0]
  // fallback (e.g. FedFlix has only 320x240 mp4; MPEG2 640x480 .mpeg orig is better but large & seek is slower):
  if (!best || best.height < MIN_H(480)) {
     alt = files.filter(f => /^(MPEG2|QuickTime|MPEG4|h\.264)$/.test(f.format) && +f.height>=MIN_H && +f.size < 3GB)
     best = pick tallest; mark candidate.heavy=true  // ffmpeg -ss on URL works but slower
  }
  return best && {name, format, width, height, length: parseLen(f.length), size}
parseLen(v) = /:/.test(v) ? mm*60+ss : +v
slotOK: file.length >= slot+1s (same as Pexels rule); pick start in middle or user `--start`
```
Images: `files.filter(format in ["JPEG","PNG","TIFF"] && source=original && !name.endsWith("_thumb.jpg"))`; **no width/height** in metadata -> use `size` as heuristic (NASA jpg 200–300 KB ≈ ~1000–1500px) and ffprobe after download. Also `https://archive.org/download/<id>/__ia_thumb.jpg` / `https://archive.org/services/img/<id>` give a small tile for preview (no auth). Book scans/zips (24 Soviet posters: 16–90 MB JPEGs) can be huge -> cap size (e.g. <=40 MB) and downscale with ffmpeg.

## 3. Licensing
### 3a. Fields
- `licenseurl` observed (all verified on live items):
  - `http://creativecommons.org/licenses/publicdomain/` (legacy PD dedication; Prelinger, Universal Newsreels, FedFlix)
  - `http(s)://creativecommons.org/publicdomain/zero/1.0/` and `…/licenses/publicdomain/zero/1.0/` (CC0; NARA FedFlix)
  - `http(s)://creativecommons.org/publicdomain/mark/1.0/` (PD Mark — **a label, not a dedication**; uploader-asserted outside curated collections)
  - `https://creativecommons.org/licenses/by-nc-nd/4.0/` (seen on NASA re-upload — must reject)
- `rights` is free text/HTML (e.g. "Public Domain", "Fair Use Notice", link to NASA terms). `possible-copyright-status` exists but was **absent on every item sampled** -> ignore as primary signal (if present containing NOT_IN_COPYRIGHT/"Public domain" can only add confidence).
- Regexes (apply on lowercased, trimmed; strip trailing slash):
```
PD_OK  = /^https?:\/\/creativecommons\.org\/(licenses\/publicdomain\/?$|(licenses\/)?publicdomain\/(zero|mark)\/1\.0\/?$)/
CC_OK  = /^https?:\/\/creativecommons\.org\/licenses\/by(-sa)?\/[1-4]\.\d\/?$/    // needs credit; BY-SA = copyleft flag
REJECT = /-(nc|nd)[\/-]|\/licenses\/(nc|nd|sampling)|by-nc|by-nd/   // run first
```
- Rights text red flags (reject if `rights`/`description` matches): `/fair use|copyright(ed)? (by|©)|all rights reserved|licensed from|getty/i`.

### 3b. Collection WHITELIST (all identifiers verified via /metadata & search)
| Collection id | Verdict | Why / evidence | Require licenseurl? |
|---|---|---|---|
| `universal_newsreels` (611) | **ACCEPT** | Collection desc: Universal "gifted Universal Newsreel to the American people, put … into the public domain, gave film materials to National Archives in 1976". NARA: deeded "without copyright restrictions" (1974), but "some stories may carry other underlying IP" -> https://unwritten-record.blogs.archives.gov/2013/12/30/universal-newsreels-national-archives/ . 595/611 carry PD licenseurl. | yes |
| `FedFlix` (1,509; parent `usgovfilms`) | **ACCEPT** | US gov films via NTIS + Public.Resource.Org (https://en.wikipedia.org/wiki/Public.Resource.Org); items carry PD / CC0 licenseurl. Risk: embedded licensed music/stock; mp4 only 320x240 | yes |
| `prelinger` (10,461) | **ACCEPT ONLY IF licenseurl present** | Prelinger FAQ (https://www.panix.com/~footage/prelarch.html): "While some Prelinger films are in the public domain, many are not"; films with CC PD dedication OK, others need clearance; PD films "may incorporate copyrighted elements"; IA gives no written license. Verified items without licenseurl: `Goodbye_Mrs_Ant`, `0878_Town_and_the_Telephone…`, home movies. Only 18% licensed. | **yes (hard)** |
| `nasa` (movies 13.7k, images 188k) | **ACCEPT with caveats** | NASA media guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/): generally not copyrighted; credit "NASA"; exceptions = third-party-labelled images, NASA logos (meatball/worm), commercial use of identifiable people (publicity rights), no implied endorsement. IA collection `rights` -> nasaimages Terms. ~95% of items have **no licenseurl** (so licenseurl cannot gate). Must also exclude items whose `collection` includes `opensource_movies`/`community` (user re-uploads like the CC BY-NC-ND 4K Apollo). Tag candidate `needsReview: people/logo`. | no |
| `wwIIarchive` | ACCEPT only with PD licenseurl | Librarian-curated PD WWII films; `ARC-38987` (United News/OWI Tarawa, NARA source) has PDM, 1280x720 .mov original. Underlying = US OWI, PD. Curator is a user, so keep licenseurl gate. | yes |
| `usgovfilms` siblings (`metavid`, congressional) | optional | Congress footage; not researched | yes |

### 3c. BLACKLIST / do not auto-accept
- `opensource_movies`, `community`, `ourmedia`, `folkscanomy*`, `culturalandacademicfilms`, `lost-telecourses`, `feature_films`, `classic_tv*`, `moviesandfilms` w/o whitelist member: user uploads, license field user-set. 208,464 of 443,648 "PD-licensed" movies sit in `opensource_movies`. Evidence: `Duck_and_Cover` (ourmedia, no license), `apollo-11-mission` (PDM + "Fair Use Notice"), `apollo-11-4-k-48fps` (CC BY-NC-ND). Rule: item must be member of a whitelist collection **by `metadata.collection` array**, not by search text.
- `flickrcommons` (+ `nationallibrarynzflickr`, etc.): label is "no known copyright restrictions" = institution's belief, **not a legal guarantee**, no warranty (https://www.flickr.com/commons/usage/); no licenseurl. **Exclude by default**; Commons covers the same ground with explicit license data.
- `brooklynmuseum`, `library_of_congress`: no machine-readable rights on item; per-item research -> exclude from v1.
- Any item with NC/ND, `rights` red flags, `geo_restricted`, or title/desc mentioning "Getty", "licensed from".
- Commercial TV ads (`classic_tv_commercials`, `commercials-from-50s`): copyright unclear -> exclude. Prelinger "Television Commercials (1950s-1960s)" (`Televisi1960`) has PD licenseurl but ads embed trademarks/music; treat OK-with-warning (not blocked).
- Video must not show recognisable modern persons (NASA astronauts, current employees) in commercial contexts; matches the repo rule already for Pexels.

## 4. Rate limits / etiquette
- **No documented numeric limits** found (official dev docs 404/unavailable via fetch; readthedocs mirror says nothing). Third-party/anecdotal only: Wayback endpoints return 429; blocks can persist. So: be conservative.
- Observed: no `Retry-After`/`X-RateLimit-*` headers on advancedsearch/metadata/download in ~150 requests; failure mode = **502 "Sorry, we're kinda busy"** (HTML) or 200+`BACKEND_ERROR` JSON, lasting minutes. No 429 provoked (did not stress).
- Recommended policy (reuse `projects/.throttle/` pattern, a separate bucket `archive.org`): 1 request in flight; >=2 s gap between API calls (search/metadata); downloads: 1 stream, 1 file at a time, `ffmpeg -ss` on URL counts as one request burst; on 429/503 honor `Retry-After` else exponential 10s,30s,90s,(abort at 15 min like Commons); on 502/BACKEND_ERROR retry 3x (6s, 15s, 40s) then fail with clear message ("archive.org đang quá tải").
- UA: `claude-video-master/0.1 (local video pipeline; contact: <email-or-repo-url>)` — include contact (IA `ia` CLI/Python lib send own UA; no formal requirement found). Do **not** reuse the Wikimedia UA constant blindly; add repo URL `github.com/jhin1m/claude-video-master`.
- Cache: write search result and metadata JSON into `archive_ia/<sceneId>.json`; never re-fetch metadata for a picked id (batch pick = sequential).
- Max per sceneclip: ffmpeg only reads needed bytes (verified 206 ranges).

## 5. Probe results (live, 2026-10-13)
| Query | id | title / year | best file | res | licenseurl | downloads |
|---|---|---|---|---|---|---|
| UN + war | `1934-10-17_King_Alexander_Assassination` | Assassination of King Alexander 1934 | `…Assassination.mp4` h.264 | 640x480 | publicdomain/ | 172,948 |
| UN + war | `1944-06-06_Eve_of_Battle` | Eve of Battle 1944 | `….mp4` | 640x480 | publicdomain/ | 72,817 |
| UN + war | `1945-12-06_Nazis_Face_War_Crime_Evidence` | 1945 | `….mp4` | 640x480 | publicdomain/ | 78,585 |
| UN + war | `UniversalNewsreelVolume35Release6007-23-1962` | 1962 | mp4 640x360; **orig .mov 1280x720 (345 MB)** | 640x360 / 720p | (varies) | – |
| prelinger + war | `Doctorin1946` | Doctor in Industry 1946 | `Doctorin1946.mp4` | 640x480 | publicdomain/ | 13,503,732 |
| prelinger + war | `WartimeN1943` | Wartime Nutrition 1943 | mp4 | 640x480 | publicdomain/ | 962,831 |
| prelinger 1950s ads | `FromtheG1954` | From the Ground Up 1954 | mp4 | 640x480 | publicdomain/ | 10,535,385 |
| prelinger 1950s ads | `DuckandC1951` | Duck and Cover 1951 | mp4 | 640x480 | publicdomain/ | 948,570 |
| prelinger 1950s ads | `1955Chev1955` | 1955 Chevrolet Screen Ads | mp4 | 640x480 | publicdomain/ | 165,450 |
| prelinger (no lic.) | `Goodbye_Mrs_Ant` | 1959 | mp4 640x480; orig .mov 2048x1536 (2 GB) | 640x480 | **none -> reject** | – |
| nasa apollo | `Apollo1116mmOnboardFilm` | Apollo 11 16mm onboard 1969, 5456 s | `apollo11_6_1.mp4` h.264 | **852x480** | none (accept via collection) | 301,031 |
| nasa apollo | `MercuryGeminiApolloHdResourceReel` | HD reel | mp4 640x360; orig .mov **1280x720** (1.3 GB per reel) | 360p/720p | PDM | – |
| nasa | `NASA-Ultra-High-Definition` | UHD | mp4 **3840x2160** | 4K | – | – |
| nasa apollo | `TheSpaceProgram` | – | – | – | CC0 | 30,967 |
| FedFlix army | `gov.archives.arc.2871` | Expansion to Air Power 1944 | `_512kb.mp4` 320x240; orig .mpeg 640x480 (GBs) | 320x240 / 480 | CC0 | 128,233 |
| FedFlix | `gov.ntis.ava02601vnb1` | Nuremberg | same pattern | 640x480 mpeg | publicdomain/ | 171,224 |
| WWII archive | `ARC-38987` | United News Nov 1943 (Tarawa) | mp4 640x360; orig .mov 1280x720 | 360p/720p | PDM | – |
| images nasa | `GPN-2000-001115` | Apollo 15 Saturn V launch 1971 | `GPN-2000-001115.jpg` 206 KB | unknown (no dims) | none; NASA | 29,340 |
| images nasa | `MSFC-6900937` | Apollo 11 Moon Landing | `6900937.jpg` 307 KB | unknown | rights="Public Domain" | 57,426 |

### Resolution share (20 items/collection, top-by-downloads + a deeper page; mp4 files only vs any video file)
| Collection | N | mp4 >=720p | any file >=720p | mp4 >=480p |
|---|---|---|---|---|
| universal_newsreels | 20 | 0 | 3 (.mov 1280x720) | 15 (rest 320x240 mp4 only on 2) |
| prelinger (licensed) | 20 | 0 | 0 | 20 (all 640x480) |
| nasa movies | 20 | 1 (4K) | 3 | 17 (Apollo 16mm = 852x480) |
| FedFlix (licensed) | 20 | 0 | 0 | 0 (mp4 = 320x240; best 640x480 MPEG2) |
**Total 80 items: 1.3% mp4 >=720p, 7.5% any file >=720p. Sampling biased to high-download items; deep tail likely same or worse.**

### Recommendation on resolution rule
- Replace `>=720p` with `minHeight 480` (video) and flag `lowRes:true` if <720; allow 360 for 16:9 only with manual override `--allow-lowres`.
- Framing: 4:3 640x480 -> fit height in 1920x1080 => 1440x1080 (2.25x upscale) over blurred-fill bg (same trick as Commons portrait images). Optionally `scale=...:flags=lanczos` + light `hqdn3d`. Do NOT Ken-Burns zoom beyond 1.0 (soft). Archival look is acceptable for documentary; use sparingly (<~30% scenes) to avoid mushy video.
- 320x240-only items (FedFlix mp4) -> pick MPEG2 640x480 original via ffmpeg URL-seek or skip; mark `heavy`.

## 6. Credit line (for `visual.source` + `credits.txt`)
`visual.source = { author, license, url }` (same as Commons). Proposed:
- `author`: `creator` (join arrays with "; ") + ` / Internet Archive` ; fallback to collection name (`Universal Newsreel (NARA)`, `NASA`, `Prelinger Archives`).
- `license`: `Public Domain` | `CC0 1.0` | `Public Domain Mark 1.0` | `CC BY 4.0` | `CC BY-SA 4.0` | for NASA w/o license: `Public Domain (US Government work)`; map from licenseurl.
- `url`: `https://archive.org/details/<id>`.
Credits.txt line: `"<Title>" (<year>), <creator>, via Internet Archive <https://archive.org/details/<id>> — <license>` ; Prelinger: append "Prelinger Archives" (they request, not required); NASA: "Credit: NASA" (required request), no endorsement wording. Add `visual.caption` rule like Commons archive (title + year + holder) — user already mandates for archive stills; apply to IA footage too ("Universal Newsreel, 1944-06-06 · National Archives").

## 7. IA vs Commons vs Pexels (topic fit)
- **IA wins**: moving footage of 1920–1967 events (WWII, Cold War, atomic tests, Berlin Wall, Sputnik, 1930s–50s daily life/ads/propaganda), Apollo/space race (480p), US gov training/industrial films, US 1940s–50s consumer culture.
- **Commons wins**: still images (engravings, manuscripts, portraits, maps) with machine-readable license+author; pre-1900; non-US subjects; high resolution.
- **Pexels wins**: modern generic B-roll, HD/4K, 2000s+ visuals.
- IA weak: anything post-1967 (copyright), non-US/non-English (Vietnam history footage: mostly not whitelisted; US war-in-Vietnam newsreels exist 1960s), HD quality, face-identifiable modern people, color modern.
- Vietnam-relevant: Universal Newsreel `1967-04-18_Peace_March`, US gov (FedFlix) Vietnam War films; verify caption accuracy (propaganda bias — add disclaimer in script).

## 8. Pitfalls (summary)
1. Errors as 200+JSON (`BACKEND_ERROR`, `DEEP_PAGING`); 502 HTML outages of ~15 min; `/metadata/<bad>` = `{}`.
2. `collection` / `creator` string-or-array; numbers as strings; `length` "mm:ss".
3. Image `width/height` missing in metadata.
4. Collection id case-sensitive (`FedFlix`).
5. Free-text query silently expands to full-text+reviews -> use field-scoped queries.
6. Prelinger/NASA licenseurl coverage 18% / 5% -> treat missing differently per collection.
7. Same film appears in many versions/parts (Prelinger: "highest quality = most recently uploaded"; `Duck_and_Cover` exists under `ourmedia` (no license) AND `DuckandC1951` (prelinger PD)) -> dedupe by title+year, prefer whitelist/licensed id.
8. PD films may contain 3rd-party elements (music/stock); original audio is irrelevant (we mute) but visuals (brand logos, Getty watermarks, burned-in "Prelinger" ids) can remain: view frame before accepting (repo rule).
9. Newsreels have narrator audio only; silent/no-sound for many; we strip audio anyway.
10. Huge originals: never download .mov/.mpeg/.mxf fully; use `ffmpeg -ss` on URL or cap size.
11. Geo-restricted hiding for VN callers (server-side).
12. IA does not issue written licences; risk is on us (Prelinger FAQ). Keep sources in credits.txt.
13. Faulty `year` e.g. `Televisi1960` year=1950; trust `date` string loosely.

## 9. Suggested CLI shape (not implemented)
`cvm ia search <sceneId> "<english query>" [--collection universal_newsreels,nasa,…] [--years 1939-1945] [--type video|image]` -> `ia/<sceneId>.json` (id,title,year,creator,collection,license,needsReview,best file{name,w,h,len,size},downloads,detailsUrl).
`cvm ia pick <sceneId> <identifier> [--start s] [--file name]` -> ffmpeg URL-seek clip (+0.2s margin each side, 30fps, mute), pillarbox/blur-fill 1920x1080, jpg frame like Pexels, write `visual.source`. `--batch picks.json`. Throttle bucket `archive.org`. Reuse `licenseOk` pattern from `wikimedia.ts` but with whitelist+licenseurl logic above.

## Unresolved questions
- Official IA rate-limit policy (no doc found; did not stress-test 429). Contact `info@archive.org` if bulk use planned.
- `possible-copyright-status` value set never observed in whitelisted collections (0 of ~130 items).
- FedFlix/NARA items: are embedded Getty/3rd-party clips common? Not sampled; needs visual review.
- Whether MPEG-PS (.mpeg) URL-seek is acceptable speed for 2–4 GB FedFlix originals (not tested; mp4 seek verified only).
- NASA collection: how many `nasa`-member items are actually user re-uploads w/ non-gov rights (need an uploader/`creator` check; only the 4K Apollo case seen, and it is in `opensource_movies`, not `nasa`).
- Image side: no clean PD-licensed historical-photo collection verified besides NASA; LoC/NARA photo collections on IA not probed.
- User to decide: accept lower min-res (480) and the Prelinger "licenseurl required" hard gate (cuts Prelinger pool 82%).

## Sources
- Scrape/advanced search docs mirror: https://doc-tools.readthedocs.io/en/ia-test-gsod/item-search-apis.html
- Prelinger rights FAQ: https://www.panix.com/~footage/prelarch.html ; IA collection metadata `https://archive.org/metadata/prelinger` (rights field), Prelinger 2002 declaration https://w2.eff.org/IP/P2P/MGM_v_Grokster/20020122_prelinger_decl.html
- Universal Newsreels: IA collection description (`/metadata/universal_newsreels`), NARA https://unwritten-record.blogs.archives.gov/2013/12/30/universal-newsreels-national-archives/
- NASA guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/ ; IA `/metadata/nasa`
- FedFlix: https://en.wikipedia.org/wiki/Public.Resource.Org ; https://nextgov.com/modernization/2011/01/fedflix-federal-video-archive-grows-in-popularity/231810
- Flickr Commons usage: https://www.flickr.com/commons/usage/
- Live API evidence: all `https://archive.org/advancedsearch.php`, `/metadata/<id>`, `/download/<id>/<file>`, `/services/search/v1/scrape` calls 2026-10-13.

Status: DONE_WITH_CONCERNS
Summary: IA is viable for 1920s–60s footage via advancedsearch+metadata+ffmpeg URL-seek (verified), gated by collection whitelist AND licenseurl (licenseurl alone is unreliable; verified mislabeled uploads). Concerns: only ~1% of sampled whitelisted items have mp4 >=720p so the 720p rule must drop to ~480p; IA search was flaky during probing; no official rate-limit doc found.
