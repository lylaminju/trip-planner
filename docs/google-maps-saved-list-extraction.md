# Google Maps Saved List Extraction

Historical research note. The importer script this describes was removed once
places moved to Supabase; the endpoint findings below are kept as reference in
case saved-list import is rebuilt.

Source link:

https://maps.app.goo.gl/qaVycWwrraarnLtQ6

## How The Data Was Found

1. Resolve the short link with headers:

   ```bash
   curl -sSIL https://maps.app.goo.gl/qaVycWwrraarnLtQ6
   ```

2. The redirect points to a Google Maps saved-list URL:

   ```text
   https://www.google.com/maps/@/data=!3m1!4b1!4m3!11m2!2s4-dXS8zG87kRcBBAscU-EA!3e3?...
   ```

3. Fetching the rendered page exposes a preload URL in the HTML:

   ```html
   /maps/preview/entitylist/getlist?...&pb=%211m4%211s4-dXS8zG87kRcBBAscU-EA...
   ```

4. The useful endpoint is:

   ```text
   https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=ca&pb=%211m4%211s4-dXS8zG87kRcBBAscU-EA%212e1%213m1%211e1%212e2%213e2%214i500%216m3%211s544KaqTQO5uU5OMP1azguA0%2115i204459%2128e2%2116b1
   ```

5. The response starts with Google's XSSI prefix:

   ```text
   )]}'
   ```

   Remove that prefix, then parse the rest as JSON.

6. The root payload shape observed on 2026-05-18:

   ```text
   parsed[0][4]  = list title ("New York")
   parsed[0][8]  = place rows
   parsed[0][17] = list emoji/icon
   ```

7. Each place row is an array. The fields the importer used are:

   ```text
   row[2]       = place name
   row[3]       = saved-list note/comment
   row[1][2]    = address when present
   row[1][4]    = fallback address when present
   row[1][5][2] = latitude
   row[1][5][3] = longitude
   row[1][6]    = Google internal IDs
   row[1][7]    = Google entity token such as /g/... or /m/... when present
   ```

## Caveats

- This endpoint is undocumented and can change without notice.
- The response does not consistently expose official Google Places API `place_id` values.
- Some rows contain Google entity tokens (`/g/...` or `/m/...`) and internal IDs instead.
- Any future importer should preserve these raw identifiers rather than pretending they are official Places API IDs.
