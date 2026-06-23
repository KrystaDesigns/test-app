const experiences = [
  ['Bollywood Jazz Nights', 'Brass, filmi standards and candlelit chai service.'],
  ['Qawwali & Cocktails', 'Soulful live vocals paired with velvet mocktails and spiced pours.'],
  ['Chai & Vinyl Sessions', 'Selectors, rare grooves and a slow-brew listening bar.'],
  ['Listening Bar Nights', 'Low light, hi-fi sound and a menu designed around mood.'],
  ['Karaoke Socials', 'Nostalgic singalongs with playful table-side chai rituals.'],
  ['Acoustic Sessions', 'Unplugged artists, intimate seating and amber lounge glow.'],
  ['Nostalgia Nights', 'Cassette-era visuals, old photos and communal storytelling.'],
];

const chaiProfiles = {
  'Midnight Masala': 'Strong black tea, ginger heat, low sweetness, oat milk and cinematic afterhours mood.',
  'Velvet Cardamom': 'Medium strength, cardamom perfume, honeyed sweetness, whole milk and soulful lounge mood.',
  'Afterhours Ginger': 'Bold brew, fresh ginger, jaggery sweetness, almond milk and energetic late-night mood.',
};

const experienceProfiles = {
  'Listening Bar': 'An intimate 75-guest listening bar with chai service, mocktails, vinyl selectors and amber lounge lighting.',
  'Qawwali Lounge': 'A soulful seated night with live qawwali, low tables, spiced chai, cocktails and dramatic warm light.',
  'Nostalgia Social': 'A playful private event with karaoke, cassette visuals, comfort snacks, chai flights and photo moments.',
};

const body = document.body;
const nowPlaying = document.querySelector('#now-playing');
const cassette = document.querySelector('#cassette');
const experienceGrid = document.querySelector('#experience-grid');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible'));
}, { threshold: 0.18 });

document.querySelectorAll('.reveal, .section').forEach((element) => revealObserver.observe(element));

document.querySelectorAll('[data-play]').forEach((button) => {
  button.addEventListener('click', () => {
    body.classList.add('is-playing');
    cassette.classList.add('flip');
    nowPlaying.textContent = 'Playing · Side B — Afterhours Masala';
  });
});

document.querySelector('[data-stop]').addEventListener('click', () => {
  body.classList.remove('is-playing');
  nowPlaying.textContent = 'Paused · Side A loaded';
});

document.querySelector('[data-side]').addEventListener('click', () => {
  cassette.classList.toggle('flip');
  nowPlaying.textContent = cassette.classList.contains('flip') ? 'Loaded · Side B experiences' : 'Loaded · Side A story';
});

experienceGrid.innerHTML = experiences.map(([title, copy], index) => `
  <article class="experience-card" style="--tilt:${index % 2 ? '2deg' : '-2deg'}">
    <span>0${index + 1}</span><h3>${title}</h3><p>${copy}</p><button type="button">Open poster</button>
  </article>
`).join('');

document.querySelectorAll('.experience-card button').forEach((button) => {
  button.addEventListener('click', () => button.closest('.experience-card').classList.toggle('open'));
});

createBuilder('chai', chaiProfiles, '#chai-name', '#chai-output');
createBuilder('experience', experienceProfiles, '#experience-name', '#experience-output');

function createBuilder(type, profiles, titleSelector, outputSelector) {
  const row = document.querySelector(`[data-builder="${type}"]`);
  const title = document.querySelector(titleSelector);
  const output = document.querySelector(outputSelector);
  row.innerHTML = Object.keys(profiles).map((name, index) => `<button class="chip ${index === 0 ? 'active' : ''}" type="button">${name}</button>`).join('');
  row.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      row.querySelectorAll('button').forEach((chip) => chip.classList.remove('active'));
      button.classList.add('active');
      title.textContent = button.textContent;
      output.textContent = profiles[button.textContent];
    });
  });
}
