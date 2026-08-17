#!/usr/bin/env node
/**
 * The landing site (10-13).
 *
 * A static generator in one file, and the absence of a framework is the point
 * rather than an omission. PRD-SITE-005 asks for a page readable within three
 * seconds on a 3G-class connection at under 500 KB. A React build reaches that
 * only after being fought; hand-written HTML reaches it by default, and this
 * site is six pages of prose that will change a few times a year.
 *
 * Indonesian is generated at the root and English under `/en/`, from two
 * content files with identical shapes. Indonesian is the source: a missing
 * English string is a gap somebody notices, while a missing Indonesian one
 * would be a hole in the version the audience actually reads (PRD-SITE-001).
 *
 * Nothing here loads a script, a font, or an image from another host. That is
 * partly the byte budget and partly that a school laptop behind a filtering
 * proxy should not get a broken page because a CDN was unreachable.
 */

import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'dist-site');

/**
 * Where a registration email goes.
 *
 * **This must be a mailbox a person actually reads before the site is
 * published.** PRD-SITE-003 requires that submissions reach a real person who
 * responds, and a form that composes mail to an address nobody monitors is
 * worse than no form: a school believes it has made contact and hears nothing.
 */
const CONTACT_EMAIL = 'halo@lenterra.id';

/** Assets live in the org profile repository and are referenced, never forked (PRD-SITE-009). */
const PROFILE_RAW = 'https://raw.githubusercontent.com/lenterra/.github/main/profile/assets';
const DEMO_VIDEO = 'https://drive.google.com/file/d/1QS3X9M3gTgCz83b9qG_wX-ffxFTU74DL/preview';
const GITHUB_ORG = 'https://github.com/lenterra';

const escape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const list = (items) => items.map((item) => `<li>${escape(item)}</li>`).join('');

/**
 * The page shell.
 *
 * The stylesheet is inlined rather than linked. At under 4 KB it costs less as
 * bytes in the document than as a second round trip on a connection where the
 * round trip is the expensive part.
 */
function layout(t, { slug, title, description, body }) {
  const css = readFileSync(join(HERE, 'styles.css'), 'utf8');
  const base = t.dir;
  const href = (page) => `${base}/${page}`.replace('//', '/') || '/';

  const nav = [
    ['', t.nav.home],
    ['sekolah', t.nav.schools],
    ['guru', t.nav.teachers],
    ['permainan', t.nav.games],
    ['privasi', t.nav.privacy],
    ['tentang', t.nav.about],
  ]
    .map(([page, label]) => {
      const target = page === '' ? `${base}/` : `${base}/${page}/`;
      const current = page === slug ? ' aria-current="page"' : '';
      return `<a href="${target.replace('//', '/')}"${current}>${escape(label)}</a>`;
    })
    .join('');

  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:type" content="website">
<link rel="alternate" hreflang="id" href="/${slug ? slug + '/' : ''}">
<link rel="alternate" hreflang="en" href="/en/${slug ? slug + '/' : ''}">
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">${escape(t.site.skipToContent)}</a>
<header class="site-header">
  <a class="brand" href="${href('')}">
    <span class="mark" aria-hidden="true">◗</span>
    <span>
      <strong>${escape(t.site.name)}</strong>
      <small>${escape(t.site.tagline)}</small>
    </span>
  </a>
  <nav aria-label="${escape(t.nav.home)}">${nav}
    <a class="lang" href="${t.nav.switchHref}">${escape(t.nav.switch)}</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <p>${escape(t.footer.note)}</p>
  <p><a href="${GITHUB_ORG}">GitHub</a> · <a href="${href('privasi')}/">${escape(t.nav.privacy)}</a></p>
  <p class="fine">${escape(t.footer.copyright)}</p>
</footer>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function home(t) {
  const features = t.home.features
    .map(
      (feature) =>
        `<article class="card"><h3>${escape(feature.title)}</h3><p>${escape(feature.body)}</p></article>`,
    )
    .join('');

  return `
<section class="hero">
  <h1>${escape(t.home.heroTitle)}</h1>
  <p class="lede">${escape(t.home.heroBody)}</p>
  <p class="actions">
    <a class="button" href="${t.dir}/sekolah/#daftar">${escape(t.home.cta)}</a>
    <a class="button ghost" href="${t.dir}/permainan/">${escape(t.home.ctaSecondary)}</a>
  </p>
</section>

<section>
  <h2>${escape(t.home.statusTitle)}</h2>
  <p>${escape(t.home.statusBody)}</p>
</section>

<section>
  <h2>${escape(t.home.featuresTitle)}</h2>
  <div class="cards">${features}</div>
</section>

<section>
  <h2>${escape(t.home.demoTitle)}</h2>
  <p>${escape(t.home.demoBody)}</p>
  <p><a class="button ghost" href="${DEMO_VIDEO}" rel="noopener">${escape(t.home.demoLink)}</a></p>
</section>
`;
}

function schools(t) {
  const s = t.schools;
  const f = s.formFields;

  // A mailto rather than a form service. Nothing is posted anywhere: the fields
  // compose a message in the visitor's own mail client and they press send. It
  // collects nothing on our side and needs no backend, which is what keeps this
  // a genuinely static site (PRD-SITE-008).
  const fields = Object.entries(f)
    .map(
      ([key, label]) => `
    <label class="field">
      <span>${escape(label)}</span>
      <input id="f-${key}" name="${key}" type="text" autocomplete="off">
    </label>`,
    )
    .join('');

  return `
<section>
  <h1>${escape(s.heading)}</h1>
  <p class="lede">${escape(s.intro)}</p>
</section>

<section>
  <h2>${escape(s.termTitle)}</h2>
  <ol class="steps">${list(s.term)}</ol>
</section>

<section>
  <h2>${escape(s.needTitle)}</h2>
  <ul>${list(s.need)}</ul>
</section>

<section>
  <h2>${escape(s.costTitle)}</h2>
  <p>${escape(s.costBody)}</p>
</section>

<section>
  <h2>${escape(s.getTitle)}</h2>
  <ul>${list(s.get)}</ul>
</section>

<section>
  <h2>${escape(s.dataTitle)}</h2>
  <p>${escape(s.dataBody)}</p>
  <p><a href="${t.dir}/privasi/">${escape(s.dataLink)}</a></p>
</section>

<section id="daftar" class="panel">
  <h2>${escape(s.formTitle)}</h2>
  <p>${escape(s.formIntro)}</p>
  <form id="register">
    ${fields}
    <button type="submit" class="button">${escape(s.formSubmit)}</button>
  </form>
  <p class="fine">${escape(s.formNote)}</p>
  <p class="fine">${escape(s.formNext)}</p>
</section>

<script>
/* Composes a mailto from the fields. No network request is made, by design:
   nothing is collected on our side, and the site needs no backend. */
document.getElementById('register').addEventListener('submit', function (event) {
  event.preventDefault();
  var order = ${JSON.stringify(Object.keys(f))};
  var labels = ${JSON.stringify(f)};
  var lines = order.map(function (key) {
    var input = document.getElementById('f-' + key);
    return labels[key] + ': ' + (input && input.value ? input.value : '-');
  });
  var school = document.getElementById('f-school');
  var subject = ${JSON.stringify(t.locale === 'id' ? 'Pendaftaran sekolah' : 'School registration')} +
    (school && school.value ? ' — ' + school.value : '');
  window.location.href =
    'mailto:${CONTACT_EMAIL}?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(lines.join('\\n'));
});
</script>
`;
}

function teachers(t) {
  const s = t.teachers;
  return `
<section>
  <h1>${escape(s.heading)}</h1>
  <p class="lede">${escape(s.intro)}</p>
</section>

<section>
  <h2>${escape(s.questionsTitle)}</h2>
  <ol class="steps">${list(s.questions)}</ol>
</section>

<section>
  <h2>${escape(s.evidenceTitle)}</h2>
  <p>${escape(s.evidenceBody)}</p>
</section>

<section>
  <h2>${escape(s.timeTitle)}</h2>
  <p>${escape(s.timeBody)}</p>
</section>

<section>
  <h2>Lenterra</h2>
  <p><img loading="lazy" width="320" height="640" src="${PROFILE_RAW}/screenshots/3.png" alt="${escape(
    t.locale === 'id' ? 'Tangkapan layar aplikasi Lenterra' : 'A screenshot of the Lenterra app',
  )}"></p>
</section>
`;
}

function games(t) {
  const entries = t.games.list
    .map((game) => {
      const mapping = game.mapping.length
        ? `<ul class="mapping">${list(game.mapping)}</ul>`
        : '';
      const planned = game.mapping.length === 0 ? ' planned' : '';
      return `
    <article class="card${planned}">
      <h3>${escape(game.name)}</h3>
      <p class="status">${escape(game.status)}</p>
      <p>${escape(game.teaches)}</p>
      ${mapping}
    </article>`;
    })
    .join('');

  return `
<section>
  <h1>${escape(t.games.heading)}</h1>
  <p class="lede">${escape(t.games.intro)}</p>
</section>

<section>
  <div class="cards">${entries}</div>
</section>

<section>
  <h2>${escape(t.games.coursesTitle)}</h2>
  <p>${escape(t.games.coursesBody)}</p>
</section>
`;
}

function privacy(t) {
  const sections = t.privacy.sections
    .map((entry) => `<section><h2>${escape(entry.heading)}</h2><p>${escape(entry.body)}</p></section>`)
    .join('');

  return `
<section>
  <h1>${escape(t.privacy.heading)}</h1>
  <p class="lede">${escape(t.privacy.intro)}</p>
</section>
${sections}
<section>
  <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</section>
`;
}

function about(t) {
  const s = t.about;
  return `
<section>
  <h1>${escape(s.heading)}</h1>
  <p class="lede">${escape(s.intro)}</p>
</section>

<section>
  <h2>${escape(s.teamTitle)}</h2>
  <ul>${list(s.team)}</ul>
</section>

<section>
  <h2>${escape(s.contactTitle)}</h2>
  <p>${escape(s.contactBody)}</p>
  <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</section>

<section>
  <h2>${escape(s.repoTitle)}</h2>
  <p>${escape(s.repoBody)}</p>
  <p><a href="${GITHUB_ORG}">${GITHUB_ORG}</a></p>
</section>
`;
}

function results(t) {
  return `
<section>
  <h1>${escape(t.results.heading)}</h1>
  <p class="lede">${escape(t.results.intro)}</p>
</section>
`;
}

const PAGES = [
  { slug: '', key: 'home', render: home },
  { slug: 'sekolah', key: 'schools', render: schools },
  { slug: 'guru', key: 'teachers', render: teachers },
  { slug: 'permainan', key: 'games', render: games },
  { slug: 'privasi', key: 'privacy', render: privacy },
  { slug: 'tentang', key: 'about', render: about },
  { slug: 'hasil', key: 'results', render: results },
];

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const written = [];

  for (const locale of ['id', 'en']) {
    const t = JSON.parse(readFileSync(join(HERE, 'content', `${locale}.json`), 'utf8'));

    for (const page of PAGES) {
      const meta = t[page.key];
      const html = layout(t, {
        slug: page.slug,
        title: meta.title,
        description: meta.description,
        body: page.render(t),
      });

      const dir = join(OUT, t.dir.replace(/^\//, ''), page.slug);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, 'index.html');
      writeFileSync(file, html);
      written.push({ file, bytes: Buffer.byteLength(html) });
    }
  }

  // GitHub Pages serves 404.html for unknown paths.
  const id = JSON.parse(readFileSync(join(HERE, 'content', 'id.json'), 'utf8'));
  writeFileSync(
    join(OUT, '404.html'),
    layout(id, {
      slug: '',
      title: 'Halaman tidak ditemukan — Lenterra',
      description:
        'Alamat yang Anda buka tidak ada di situs Lenterra. Kembali ke beranda untuk menemukan halaman yang Anda cari.',
      body: `<section><h1>Halaman tidak ditemukan</h1><p class="lede">Alamat yang Anda buka tidak ada. Kembali ke <a href="/">beranda</a>.</p></section>`,
    }),
  );

  // Tells Pages not to run Jekyll over the output.
  writeFileSync(join(OUT, '.nojekyll'), '');

  if (existsSync(join(HERE, 'static'))) {
    cpSync(join(HERE, 'static'), OUT, { recursive: true });
  }

  return written;
}

const written = build();
console.log(`built ${written.length} pages into dist-site/`);
for (const page of written) {
  console.log(`  ${(page.bytes / 1024).toFixed(1).padStart(6)} KB  ${page.file.replace(OUT, '')}`);
}
