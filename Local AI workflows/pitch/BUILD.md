# Scribular pitch deck

The editable five-slide PowerPoint is in `output/scribular-pitch.pptx`. All slide text is native PowerPoint text; the simplified deck has no artwork. Each slide includes the supplied speaker script, with editorial notes added where requested.

## Build

```sh
npm install
node src/build_deck.js
node src/render_preview.js
```

The renderer source writes SVG and HTML preview mirrors. On a Mac with Brave installed, render previews and the PDF with:

```sh
for i in 1 2 3 4 5; do
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
    --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=1600,900 --screenshot="$PWD/output/slide-$i.png" \
    "file://$PWD/output/slide-$i.html"
done
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  --headless --disable-gpu --no-sandbox \
  --print-to-pdf="$PWD/output/scribular-pitch-preview.pdf" \
  "file://$PWD/output/preview.html"
```

The supplied PDF and PNGs are from the HTML/SVG mirror, not a direct PowerPoint render. `src/render_preview.js` loads `src/build_deck.js` through a recording stand-in for pptxgenjs, so the preview uses the deck's own geometry and text; edit only `build_deck.js`.
