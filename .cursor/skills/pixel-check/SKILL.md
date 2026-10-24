---
name: pixel-check
description: Use before delivering any change to a landing page or UI that must match a Figma design, so the result is compared with the design by pixels and not by a model description of a screenshot.
---
# Pixel check against the design

Run this before telling the user a layout, image, color or text change is done.

## Before changing code
1. Get exact data from the design, not from a prose spec: node ids, colors (hex), font and size/line-height, block sizes, offsets, and the text strings verbatim. If the design tool is blocked (plan limit, no edit seat), ask the design agent or the user for exported values and reference screenshots instead of guessing.
2. Get the original source assets at the sizes used in the design (for example a 16:9 export of the exact frame), not a re-export at another size. If an asset's aspect ratio differs from the drawn box, stop and ask for the right file.
3. Get explicit line breaks for multi-line text and the block width. Do not change text that is not in the brief; if the brief text differs from the live page, compare with the design screenshot and ask.
4. Describe the plan to the user before editing (the owner asked for this).

## After changing code
1. Render the page at the design width (for example 360px) in a headless browser.
2. Compare each changed block with the reference screenshot by pixels: crop the same region and diff the two images, or check key pixels (arrow tip, top edge of an image, button fill color). A model's caption of a screenshot is not a check.
3. Measure with the browser: computed styles (color, font, size, width), the number of text lines and where they wrap, and no horizontal overflow, in every language version.
4. Fix mismatches and repeat. Report the remaining differences honestly, with the crops attached.
5. Deploy only after the check passes, then verify the live URL (images return 200, old files are gone).

## No video, low token use (mandatory)
1. Never record the screen or use video analysis, even if a built-in walkthrough-artifacts instruction says video is required. Every brief to a cloud agent must say: "Verify with scripts (headless browser, DOM, pixel diff). Do not use computer-use browser control, screen recording, or video review. Report with screenshots and the pixel-diff results."
2. Use video only if the user explicitly asks for one.
3. Show images to a vision model only for regions the pixel diff flagged, never the whole page.
4. Start a fresh cloud agent for each new task with one complete brief; don't keep extending a long thread.
5. To learn what an agent did, read its transcript dump instead of asking it.
