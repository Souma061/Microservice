import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://host.docker.internal:4000";
const TARGET_VUS = Number(__ENV.TARGET_VUS) || 10;
const RAMP = __ENV.RAMP || "10s";
const HOLD = __ENV.HOLD || "30s";

export const options = {
  stages: [
    { duration: RAMP, target: TARGET_VUS },
    { duration: HOLD, target: TARGET_VUS },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    checks: ["rate>0.99"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  let res = http.get(`${BASE}/`);
  check(res, { "page 200": (r) => r.status === 200 });

  res = http.post(
    `${BASE}/links`,
    JSON.stringify({ url: `https://example.com/k6/${__VU}-${__ITER}` }),
    { headers: { "Content-Type": "application/json" } },
  );
  const createdCode = res.status === 201 ? res.json("code") : null;
  check(res, { "create 201": (r) => r.status === 201 });

  res = http.get(`${BASE}/links`);
  check(res, { "list 200": (r) => r.status === 200 });
  const items = res.status === 200 ? res.json() : [];

  const code = createdCode || (items[0] && items[0].code);
  if (code) {
    // redirects: 0 — never follow out to the real destination from a load test
    res = http.get(`${BASE}/${code}`, { redirects: 0 });
    check(res, { "redirect 302": (r) => r.status === 302 });
  } else {
    check({ code }, { "link code available": (c) => Boolean(c) });
  }

  sleep(1);
}
