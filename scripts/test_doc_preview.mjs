const BASE = "http://127.0.0.1:4173";

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "CloudCoreAI" },
    body: JSON.stringify({ username: "azeemniazi", password: "fatimaarif" })
  });
  if (!loginRes.ok) throw new Error("Login failed");
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];

  // Test ISO 27018.pdf
  const docId = "b16979a0-fc00-4385-8ad4-1fd26f659dfc";
  const viewRes = await fetch(`${BASE}/api/knowledge/documents/${docId}/view`, {
    headers: { cookie }
  });
  console.log("View status:", viewRes.status);
  console.log("Content-Type:", viewRes.headers.get("content-type"));
  const buf = Buffer.from(await viewRes.arrayBuffer());
  console.log("Bytes received:", buf.length);
  console.log("PDF header:", buf.slice(0, 5).toString("utf8")); // Should be %PDF-
}

main().catch(console.error);
