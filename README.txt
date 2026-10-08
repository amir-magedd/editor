AMIR MAGED — PORTFOLIO WEBSITE
==============================


Pages
  index.html       Home / showreel
  reels.html       15 vertical reels (click to open the player)
  horizontal.html  Short films, coverages, funky edits, interviews
  about.html       Bio, experience, toolkit

Folders
  assets/   style.css + site.js (player, contact card, filters)
  media/    all videos and posters

Put it online (free, ~2 minutes)
  Netlify:  go to app.netlify.com/drop and drag this whole folder onto the page.
  Or GitHub Pages / Vercel / any web host: upload the folder as-is.
  Keep the folder structure exactly as it is.

Direct links to a filter on the Horizontal page
  horizontal.html#short-films   horizontal.html#coverages
  horizontal.html#funky-edits   horizontal.html#interviews

Swap a video
  Replace the file in media/reels or media/horizontal with one of the same name
  (e.g. media/horizontal/h04.mp4 and h04.jpg for its poster).

Protection
  - Right-click, dragging, copying and the save / view-source / developer-tools
    shortcuts are blocked, and every video carries a faint AMIR MAGED watermark.
  - Security headers are already set up for your host:
      Netlify -> _headers      Vercel -> vercel.json      Apache/cPanel -> .htaccess
    Upload the folder as-is and they apply automatically.
  - Note: no website can make its files 100% impossible to copy (screen recording
    always works). These steps stop casual copying, and the watermark keeps your
    name on anything that gets recorded.
