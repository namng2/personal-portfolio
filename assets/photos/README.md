# Photos for the Map tab

Drop image files here, then add a matching entry to `../data/photos.json`.

`file` can be either a name in this folder or a full `https://` URL, so photos
can live in the repo or on an image host:

```json
{ "file": "ocean-beach.jpg",                    "lat": 37.76, "lng": -122.51 }
{ "file": "https://res.cloudinary.com/…/x.jpg", "lat": 37.76, "lng": -122.51 }
```

A remote host must also be added to `img-src` in the CSP in `index.html`, or
the browser silently drops the image. Other schemes (`data:`, `javascript:`)
are refused.

The **Add a photo…** button on the Map tab writes that entry for you: it reads
GPS out of the photo's EXIF where present (otherwise you click the map), and
prints the JSON to paste.

Keep filenames lowercase — GitHub Pages is case-sensitive, macOS is not, so a
`.JPG` referenced as `.jpg` works locally and 404s once deployed.

Resize before committing; full-resolution camera files make the repo slow to
clone and the page slow to load. Around 2000px on the long edge is plenty.
