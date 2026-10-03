# SEO guide: ranking for "Shivam Kumar Sah"

Nobody can guarantee a #1 spot on Google. A personal name is still one of the easiest searches to win,
because few pages compete for it. Google ranks a name search well when it can tell that one person,
one name and one website belong together. Everything below is about making that obvious.

## The biggest issue: your name is spelled four ways

| Where | What it says today |
|---|---|
| This website | Shivam Kumar Sah |
| LinkedIn | Shubham Shah (`/in/shubham-shah-…`) |
| Email | shubhamshah2078@gmail.com |
| Website address | shubhamportfolio743.netlify.app |
| GitHub | thewebgenius (no real name) |

Google cannot be sure these are the same person. Pick the name you want people to search, which is
"Shivam Kumar Sah", and use it everywhere:

1. **LinkedIn**: set your display name to *Shivam Kumar Sah*. If people know you as Shubham, use
   *Shivam Kumar Sah (Shubham)* or put "Shubham" in the "Additional name" field. Put the portfolio URL in
   Contact info → Website, and add the site to the Featured section.
2. **GitHub**: Settings → Public profile → Name: *Shivam Kumar Sah*, Website: your portfolio URL.
   Create a repository named `thewebgenius` with a README that starts "Hi, I'm Shivam Kumar Sah" and
   links back to the site.
3. **Kaggle, Hugging Face, ORCID and Google Scholar** (once the paper is out): same name, same photo, link
   to the site. Add each new profile URL to the `sameAs` list in `public/index.html`.
4. **The paper**: publish the arXiv preprint under exactly "Shivam Kumar Sah". Google Scholar and arXiv
   pages rank very well for names.

The JSON-LD already lists "Shubham Shah", "Shivam Sah" and "Shivam Shah" as `alternateName`, so Google
can connect the old spellings to you.

## Step 1: get your own domain (strongly recommended)

A domain like `shivamkumarsah.com`, `.me` or `.dev` is the single strongest name signal. Check it is
available, buy it (about $10–15 a year), then in Netlify go to Domain management → Add a domain and
follow the DNS steps. Then replace `https://shubhamportfolio743.netlify.app` in:

- `public/index.html` (canonical, Open Graph, JSON-LD)
- `public/sitemap.xml`
- `public/robots.txt`
- `scripts/prerender-meta.mjs` (`SITE`)
- `public/og-image.png` (regenerate it, or just leave it; the URL printed on it is cosmetic)

Keep the Netlify address working: Netlify redirects it to the new domain automatically.

## Step 2: what is already in the code

**Title (54 characters, name first):**
```html
<title>Shivam Kumar Sah | ML Researcher – NLP &amp; Deep Learning</title>
```

**Meta description (159 characters):**
```html
<meta name="description" content="Shivam Kumar Sah is a B.Tech CSE (AI/ML) student at DIT University researching Nepali-English NLP, speech for low-resource languages and applied deep learning." />
```

**Canonical, robots, social cards** (`public/index.html`): canonical URL, `index, follow,
max-image-preview:large`, Open Graph `profile` tags, a Twitter card, and a 1200×630 preview image
(`public/og-image.png`).

**JSON-LD** (`public/index.html`): a `@graph` with `WebSite`, `ProfilePage` and `Person`. Google
documents `ProfilePage` with a `Person` as `mainEntity` for "About me" pages. The `Person` part:

```json
{
  "@type": "Person",
  "@id": "https://shubhamportfolio743.netlify.app/#person",
  "name": "Shivam Kumar Sah",
  "givenName": "Shivam",
  "additionalName": "Kumar",
  "familyName": "Sah",
  "alternateName": ["Shivam Sah", "Shubham Shah", "Shivam Shah"],
  "url": "https://shubhamportfolio743.netlify.app/",
  "image": "https://shubhamportfolio743.netlify.app/images/profileimage/profile-pic.jpeg",
  "jobTitle": "Machine Learning Student Researcher",
  "email": "mailto:shubhamshah2078@gmail.com",
  "affiliation": { "@type": "CollegeOrUniversity", "name": "DIT University", "url": "https://www.dituniversity.edu.in/" },
  "knowsAbout": ["Machine learning", "Natural language processing", "Code-switching", "Automatic speech recognition", "Computer vision"],
  "sameAs": [
    "https://www.linkedin.com/in/shubham-shah-b6a03b296/",
    "https://github.com/thewebgenius"
  ]
}
```

**Other files:**
- `public/robots.txt` and `public/sitemap.xml` list both pages and the profile photo.
- `public/site.webmanifest` and PNG icons.
- `scripts/prerender-meta.mjs` runs after `npm run build` and writes `build/lab/kmeans/index.html`, so
  the playground has its own title, description, canonical URL and `WebApplication` schema without
  needing JavaScript.
- A `<noscript>` block with your name, summary, projects and links, for crawlers that don't run JS.
- One `<h1>` (your name), and alt text on your photo ("Portrait of Shivam Kumar Sah").

## Step 3: tell Google the site exists

1. Deploy the new build.
2. Open [Google Search Console](https://search.google.com/search-console), add the site as a
   **URL-prefix** property, choose "HTML tag" verification, paste the tag where the comment says
   `google-site-verification` in `public/index.html`, redeploy, then click Verify.
3. Sitemaps → submit `sitemap.xml`.
4. URL Inspection → enter the home page URL → **Request indexing**. Repeat for `/lab/kmeans`.
5. Do the same in [Bing Webmaster Tools](https://www.bing.com/webmasters) (it can import from Search
   Console in one click). Bing also feeds DuckDuckGo and Yahoo.

## Step 4: check that it all works

- [Rich Results Test](https://search.google.com/test/rich-results): paste your URL and confirm
  "Profile page" is detected with no errors.
- [Schema Markup Validator](https://validator.schema.org/): checks the full JSON-LD.
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/): confirms the preview image
  and title, and refreshes LinkedIn's cache.
- [PageSpeed Insights](https://pagespeed.web.dev/): mobile score. Speed is a minor ranking factor,
  but it is easy to keep green.

## Step 5: links pointing at the site

Links from pages that already rank for your name matter most:

- LinkedIn (website field, Featured section, and a post announcing the new site and the K-Means
  playground, which is a natural follow-up to your 211K-impression post).
- GitHub profile README and the README of each project repository.
- Your DIT University department, lab or club pages, if they list students or projects.
- Kaggle notebooks (skin cancer, SmartBinX): put the portfolio link in the notebook description.
- A short write-up on Medium or dev.to about the K-Means playground or the seqeval pitfall from your
  paper, signed with your full name and linking to the site.

## Step 6: wait and measure

New sites usually take from a few days to a few weeks to show up for a name search. In Search Console
→ Performance, filter by query "shivam kumar sah" to watch impressions and position. If someone else
with the same name already ranks, consistent profiles plus your own domain is how you overtake them
over time.
