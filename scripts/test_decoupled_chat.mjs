const BASE = "http://127.0.0.1:4173";

async function test() {
  console.log("Logging in as azeemniazi...");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "CloudCoreAI" },
    body: JSON.stringify({ username: "azeemniazi", password: "fatimaarif" })
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];
  console.log("Logged in. Cookie acquired.\n");

  console.log("==========================================================================");
  console.log("TEST 1: Pure AI Assistant Chat (use_rag: false)");
  console.log("Prompt: 'Write a concise Python function to check if a number is prime.'");
  console.log("==========================================================================");
  const t1 = Date.now();
  const res1 = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "CloudCoreAI", cookie },
    body: JSON.stringify({
      message: "Write a concise Python function to check if a number is prime.",
      use_rag: false,
      max_tokens: 250
    })
  });
  const dur1 = ((Date.now() - t1) / 1000).toFixed(2);
  const data1 = await res1.json();
  console.log(`Status: ${res1.status} | Latency: ${dur1}s`);
  console.log("Citations count:", data1.citations?.length || 0);
  console.log("Answer snippet:\n" + (data1.answer || "").slice(0, 300) + "...\n");

  console.log("==========================================================================");
  console.log("TEST 2: Dedicated Knowledge Hub AI Chat (use_rag: true)");
  console.log("Prompt: 'What certifications does the PTCL data center hold according to our files?'");
  console.log("==========================================================================");
  const t2 = Date.now();
  const res2 = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "CloudCoreAI", cookie },
    body: JSON.stringify({
      message: "What certifications does the PTCL data center hold according to our files?",
      use_rag: true,
      max_tokens: 400
    })
  });
  const dur2 = ((Date.now() - t2) / 1000).toFixed(2);
  const data2 = await res2.json();
  console.log(`Status: ${res2.status} | Latency: ${dur2}s`);
  console.log("Citations count:", data2.citations?.length || 0);
  if (data2.citations?.length) {
    console.log("Cited documents:", data2.citations.map(c => c.filename));
  }
  console.log("Answer snippet:\n" + (data2.answer || "").slice(0, 300) + "...\n");
}

test().catch(console.error);
