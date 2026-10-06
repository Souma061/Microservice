const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const COUNT = Number(process.env.SEED_COUNT ?? 100);
const CLICKS = Number(process.env.SEED_CLICKS ?? 5);

const json = (r) => r.json().catch(() => ({}));

async function post(path, body) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const created = [];
let failed = 0;

for (let i = 0; i < COUNT; i++) {
  const r = await post("/links", { url: `https://example.com/seed/${i}` });
  if (r.ok) created.push(await json(r));
  else failed++;
}

let clicks = 0;
for (const link of created) {
  for (let c = 0; c < CLICKS; c++) {
    const r = await fetch(`${BASE}/${link.code}`, { redirect: "manual" });
    if (r.ok || r.status === 302) clicks++;
  }
}

console.log(
  `seeded ${created.length} links (${failed} failed), ${clicks} clicks -> ${BASE}`,
);
