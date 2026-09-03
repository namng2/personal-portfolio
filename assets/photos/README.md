# Photos for the Map tab

Drop image files here, then add a matching entry to `../data/photos.json`.

The **Add a photo…** button on the Map tab writes that entry for you: it reads
GPS out of the photo's EXIF where present (otherwise you click the map), and
prints the JSON to paste.

Keep filenames lowercase — GitHub Pages is case-sensitive, macOS is not, so a
`.JPG` referenced as `.jpg` works locally and 404s once deployed.

Resize before committing; full-resolution camera files make the repo slow to
clone and the page slow to load. Around 2000px on the long edge is plenty.
