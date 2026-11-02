import fs from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = 'http://127.0.0.1:4173';
const RESULTS_FILE = resolve('./benchmark_results.json');

const questions = [
  // ==========================================
  // LEVEL 1: EASY (Conversational / Quick Facts)
  // ==========================================
  { id: 1, level: 'Easy', category: 'General Conversation', prompt: 'Hello! How are you doing today?' },
  { id: 2, level: 'Easy', category: 'Arithmetic', prompt: 'What is 25 * 14?' },
  { id: 3, level: 'Easy', category: 'Geography', prompt: 'What is the capital city of Pakistan?' },
  { id: 4, level: 'Easy', category: 'History', prompt: 'Who is the founder of Pakistan and when was it founded?' },
  { id: 5, level: 'Easy', category: 'Science', prompt: 'What is the boiling point and freezing point of water in Celsius?' },
  { id: 6, level: 'Easy', category: 'Math', prompt: 'How many hours are there in exactly one week?' },
  { id: 7, level: 'Easy', category: 'Language', prompt: 'Translate this English sentence into polite Urdu: Good morning, welcome to our office.' },
  { id: 8, level: 'Easy', category: 'Computer Science', prompt: 'What does the abbreviation CPU stand for in computer hardware?' },
  { id: 9, level: 'Easy', category: 'General Knowledge', prompt: 'Which planet in our solar system is known as the Red Planet and why?' },
  { id: 10, level: 'Easy', category: 'Economics', prompt: 'What is the currency of Japan, and what is its symbol?' },
  { id: 11, level: 'Easy', category: 'Creative', prompt: 'Give me a short 2-line inspirational quote about persistence in software development.' },
  { id: 12, level: 'Easy', category: 'Food & Culture', prompt: 'What are the main ingredients used to make traditional Pakistani Chicken Biryani?' },

  // ==========================================
  // LEVEL 2: MODERATE (Technical / Coding / Logic)
  // ==========================================
  { id: 13, level: 'Moderate', category: 'Algorithms', prompt: 'Write a Python function to check whether a given string is a palindrome, ignoring non-alphanumeric characters and case.' },
  { id: 14, level: 'Moderate', category: 'Databases', prompt: 'Explain the three primary differences between relational SQL databases and NoSQL document stores.' },
  { id: 15, level: 'Moderate', category: 'SQL', prompt: 'Write an ANSI SQL query to find the 2nd highest salary from an Employee table without using the LIMIT clause.' },
  { id: 16, level: 'Moderate', category: 'Operating Systems', prompt: 'Explain the difference between a process and a thread in modern operating systems.' },
  { id: 17, level: 'Moderate', category: 'JavaScript', prompt: 'Write a JavaScript function to deep-clone a nested object without using JSON.parse(JSON.stringify()).' },
  { id: 18, level: 'Moderate', category: 'Networking', prompt: 'Explain what idempotent HTTP methods mean in RESTful API design, and classify GET, POST, PUT, and DELETE.' },
  { id: 19, level: 'Moderate', category: 'Software Design', prompt: 'Explain the difference between Dependency Injection and Inversion of Control with a concise example.' },
  { id: 20, level: 'Moderate', category: 'DevOps', prompt: 'What is Docker, and how does containerization differ fundamentally from traditional hardware virtualization?' },
  { id: 21, level: 'Moderate', category: 'Algorithms', prompt: 'Compare the average and worst-case time and space complexities of Quick Sort vs Merge Sort.' },
  { id: 22, level: 'Moderate', category: 'Networking', prompt: 'Explain how TCP 3-way handshake and 4-way termination work step-by-step.' },
  { id: 23, level: 'Moderate', category: 'Security', prompt: 'Explain the difference between symmetric encryption (AES) and asymmetric encryption (RSA), and when each is used.' },
  { id: 24, level: 'Moderate', category: 'Data Structures', prompt: 'Write a Python function to reverse a singly linked list in-place and return the new head.' },
  { id: 25, level: 'Moderate', category: 'Python', prompt: 'Explain Python generators and the yield keyword, and write a generator function that yields Fibonacci numbers up to N.' },

  // ==========================================
  // LEVEL 3: ADVANCED (Architecture / Enterprise / Pakistan Context / RAG)
  // ==========================================
  { id: 26, level: 'Advanced', category: 'Automotive / Market', prompt: 'Compare the Honda Civic RS with Hyundai Elantra GLS in the Pakistani car market regarding engine performance, local fuel economy, build quality, and resale value.' },
  { id: 27, level: 'Advanced', category: 'Enterprise Cloud', prompt: 'Explain how enterprise data centers achieve Tier-3 and Tier-4 reliability, focusing on power redundancy (N+1 vs 2N), concurrent maintainability, and annual downtime limits.' },
  { id: 28, level: 'Advanced', category: 'RAG Architecture', prompt: 'Explain how Retrieval-Augmented Generation (RAG) works: detail the roles of dense vector embeddings, HNSW vector indexing, and cross-encoder rerankers.' },
  { id: 29, level: 'Advanced', category: 'Algorithms', prompt: 'Write a complete Python implementation of an LRU (Least Recently Used) Cache using a doubly linked list and a hash map with O(1) get and put operations.' },
  { id: 30, level: 'Advanced', category: 'Distributed Systems', prompt: 'Explain the CAP theorem and analyze how Apache Cassandra, MongoDB, and CockroachDB position themselves within its trade-offs.' },
  { id: 31, level: 'Advanced', category: 'Algorithms', prompt: 'Write a Python implementation of Dijkstra algorithm using a min-heap priority queue to find shortest paths from a source node in a weighted directed graph.' },
  { id: 32, level: 'Advanced', category: 'System Design', prompt: 'Design a scalable real-time chat application backend like WhatsApp/Slack handling 50,000 concurrent WebSocket connections, message persistence, and delivery receipts.' },
  { id: 33, level: 'Advanced', category: 'Database Internals', prompt: 'Explain the internal difference between PostgreSQL B-Tree indexes, GIN indexes, and BRIN indexes, explaining optimal use-cases for each.' },
  { id: 34, level: 'Advanced', category: 'Machine Learning', prompt: 'Explain the self-attention mechanism in the Transformer architecture mathematically: write out the formula for Attention(Q, K, V), explain the scaling factor sqrt(d_k), and why it prevents vanishing gradients.' },
  { id: 35, level: 'Advanced', category: 'Security & Compliance', prompt: 'What are the core technical requirements for PCI-DSS 4.0 and ISO 27001 compliance when hosting banking and payment workloads in a cloud environment?' },
  { id: 36, level: 'Advanced', category: 'Operating Systems', prompt: 'Explain how Linux virtual memory paging works: Multi-level page tables, TLB cache lookups, Page Fault handling, and the Copy-On-Write (COW) mechanism during fork().' },
  { id: 37, level: 'Advanced', category: 'Cloud Architecture', prompt: 'Design an automated Disaster Recovery (DR) strategy for a multi-region cloud application with RPO < 5 minutes and RTO < 15 minutes.' },
  { id: 38, level: 'Advanced', category: 'Bash / Linux', prompt: 'Write an optimized Bash script that monitors CPU, memory, and disk usage every 10 seconds, logging alerts to a file if memory exceeds 85% or CPU exceeds 90% for 3 consecutive checks.' },

  // ==========================================
  // LEVEL 4: VERY VERY DIFFICULT (Extreme Logic / Hard Algorithmic Proofs / Concurrency)
  // ==========================================
  { id: 39, level: 'Expert', category: 'Algorithms', prompt: 'Implement the Aho-Corasick string matching algorithm in Python from scratch, including trie construction, BFS failure link computation, output links, and multi-pattern searching.' },
  { id: 40, level: 'Expert', category: 'Logic Puzzle', prompt: 'Solve the classic 12-coins balance puzzle: You have 12 identical coins, one of which is counterfeit (either heavier or lighter). Using a balance scale exactly 3 times, provide a complete deterministic decision tree that identifies the counterfeit coin and whether it is heavier or lighter.' },
  { id: 41, level: 'Expert', category: 'Concurrency', prompt: 'Write a complete Python implementation of an asynchronous Actor Model system using asyncio, supporting mailboxes, message routing, worker pools, supervisor restarts, and poison-pill termination.' },
  { id: 42, level: 'Expert', category: 'Distributed Consensus', prompt: 'Explain the Paxos consensus algorithm step-by-step: describe Phase 1a (Prepare), 1b (Promise), Phase 2a (Accept), and 2b (Accepted). Mathematically prove why split-brain cannot occur under network partitions.' },
  { id: 43, level: 'Expert', category: 'Low-Level Concurrency', prompt: 'Explain the implementation of a Lock-Free Single-Producer Single-Consumer (SPSC) queue using circular buffers, memory barriers (Acquire/Release semantics), and atomic pointer operations.' },
  { id: 44, level: 'Expert', category: 'Theoretical CS', prompt: 'Prove mathematically whether the set of all halting Turing machines (the Halting Problem) is recursively enumerable. Then state and prove Rice Theorem and explain its implication for static code analysis.' },
  { id: 45, level: 'Expert', category: 'Graph Theory', prompt: 'Implement the Floyd-Warshall all-pairs shortest path algorithm in Python with path reconstruction, and explain how to detect negative-weight cycles and which vertex pairs are affected by them.' },
  { id: 46, level: 'Expert', category: 'Database Engines', prompt: 'Compare B-Tree and Log-Structured Merge-tree (LSM-tree) storage engines at the byte and disk I/O level: analyze Write Amplification Factor (WAF), Read Amplification, space amplification, and compaction strategies (Leveled vs Size-Tiered).' },
  { id: 47, level: 'Expert', category: 'Combinatorial Optimization', prompt: 'Write an ultra-optimized Python solver for the N-Queens problem using bitwise manipulation (bitmasking with columns, left diagonals, and right diagonals). Explain the bitwise operations and analyze why it is orders of magnitude faster than naive recursion.' },
  { id: 48, level: 'Expert', category: 'NLP / Tokenization', prompt: 'Write a complete from-scratch implementation of a Byte-Pair Encoding (BPE) tokenizer in Python: include training on a corpus, computing pair frequencies, iterative merging, vocabulary creation, and encoding/decoding text.' },
  { id: 49, level: 'Expert', category: 'Distributed Systems', prompt: 'Design a distributed rate-limiter for a global API gateway handling 1,000,000 RPS. Detail the sliding window counter algorithm with Redis, handling clock drift (TrueTime/NTP), atomic Lua scripts, and fallback under Redis partition.' },
  { id: 50, level: 'Expert', category: 'Distributed State', prompt: 'Explain Conflict-Free Replicated Data Types (CRDTs) vs Operational Transformation (OT) for collaborative real-time text editing. Detail the exact data structure for a sequence CRDT (such as LSeq or RGA), unique identifier generation, tombstone handling, and garbage collection.' }
];

async function run() {
  console.log('========================================================================');
  console.log('      CloudCore AI Chatbot 50-Question End-to-End Benchmark Suite       ');
  console.log('========================================================================');
  console.log(`Starting benchmark of ${questions.length} questions across 4 difficulty tiers.\n`);

  // 1. Authenticate to get session cookie
  console.log('Step 1: Authenticating as dev user (azeemniazi)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'CloudCoreAI' },
    body: JSON.stringify({ username: 'azeemniazi', password: 'fatimaarif' })
  });
  if (!loginRes.ok) throw new Error(`Authentication failed with status ${loginRes.status}`);
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) throw new Error('No session cookie returned');
  const cookie = setCookie.split(';')[0];
  console.log('Authenticated successfully. Session cookie acquired.\n');

  // Load existing results if resuming
  let results = [];
  try {
    const raw = await fs.readFile(RESULTS_FILE, 'utf8');
    results = JSON.parse(raw);
    console.log(`Loaded ${results.length} previously completed benchmark results from ${RESULTS_FILE}.\n`);
  } catch {}

  const completedIds = new Set(results.map(r => r.id));

  // 2. Iterate through questions
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (completedIds.has(q.id)) {
      console.log(`[Q${q.id}/50] [${q.level.toUpperCase()}] Already completed. Skipping.`);
      continue;
    }

    console.log(`------------------------------------------------------------------------`);
    console.log(`[Q${q.id}/50] Level: ${q.level.toUpperCase()} | Category: ${q.category}`);
    console.log(`Prompt: "${q.prompt.slice(0, 80)}${q.prompt.length > 80 ? '...' : ''}"`);
    process.stdout.write('Generating response: ');

    const startTime = Date.now();
    let status = 0;
    let answer = '';
    let error = null;

    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'CloudCoreAI',
          'cookie': cookie
        },
        body: JSON.stringify({
          message: q.prompt,
          max_tokens: q.level === 'Easy' ? 400 : q.level === 'Moderate' ? 800 : 1500
        }),
        signal: AbortSignal.timeout(240000) // 4 minutes timeout for deep reasoning
      });

      status = res.status;
      const data = await res.json();
      if (res.ok) {
        answer = data.answer || '';
      } else {
        error = data.error?.message || `HTTP ${res.status}`;
      }
    } catch (err) {
      error = err.message;
    }

    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const charCount = answer.length;
    // Standard rule of thumb: ~4 chars per token
    const tokenEst = Math.round(charCount / 4);
    const speedTokensPerSec = durationSec > 0 ? (tokenEst / durationSec).toFixed(1) : '0';

    const passed = status === 200 && answer.length > 20 && !error;
    const resultItem = {
      id: q.id,
      level: q.level,
      category: q.category,
      prompt: q.prompt,
      status,
      durationMs,
      durationSec: Number(durationSec.toFixed(2)),
      charCount,
      tokenEst,
      speedTokensPerSec: Number(speedTokensPerSec),
      passed,
      error,
      answerSnippet: answer.slice(0, 300).replace(/\s+/g, ' '),
      fullAnswer: answer
    };

    results.push(resultItem);
    completedIds.add(q.id);

    // Persist immediately after every question
    await fs.writeFile(RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');

    if (passed) {
      console.log(`PASSED (${status}) in ${durationSec.toFixed(1)}s | ~${tokenEst} tokens (~${speedTokensPerSec} tok/s)`);
      console.log(`Sample: "${resultItem.answerSnippet.slice(0, 120)}..."\n`);
    } else {
      console.log(`FAILED (${status}) in ${durationSec.toFixed(1)}s | Error: ${error}\n`);
    }
  }

  // 3. Generate Summary Analytics
  console.log('========================================================================');
  console.log('                         BENCHMARK COMPLETE                             ');
  console.log('========================================================================');

  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const avgDuration = (results.reduce((acc, r) => acc + r.durationMs, 0) / total / 1000).toFixed(2);
  const totalTokens = results.reduce((acc, r) => acc + r.tokenEst, 0);
  const avgSpeed = (results.filter(r => r.speedTokensPerSec > 0).reduce((acc, r) => acc + r.speedTokensPerSec, 0) / results.filter(r => r.speedTokensPerSec > 0).length || 0).toFixed(1);

  console.log(`Total Questions  : ${total}`);
  console.log(`Passed (200 OK)  : ${passedCount} / ${total} (${((passedCount / total) * 100).toFixed(1)}%)`);
  console.log(`Total Output     : ~${totalTokens} generated tokens`);
  console.log(`Average Latency  : ${avgDuration}s per response`);
  console.log(`Average Speed    : ~${avgSpeed} tokens/second\n`);

  for (const lvl of ['Easy', 'Moderate', 'Advanced', 'Expert']) {
    const subset = results.filter(r => r.level === lvl);
    if (!subset.length) continue;
    const subsetPassed = subset.filter(r => r.passed).length;
    const subsetAvgDur = (subset.reduce((acc, r) => acc + r.durationMs, 0) / subset.length / 1000).toFixed(1);
    const subsetAvgTokens = Math.round(subset.reduce((acc, r) => acc + r.tokenEst, 0) / subset.length);
    const subsetAvgSpeed = (subset.filter(r => r.speedTokensPerSec > 0).reduce((acc, r) => acc + r.speedTokensPerSec, 0) / subset.filter(r => r.speedTokensPerSec > 0).length || 0).toFixed(1);
    console.log(`[Tier: ${lvl.toUpperCase()}] Passed: ${subsetPassed}/${subset.length} | Avg Duration: ${subsetAvgDur}s | Avg Tokens: ~${subsetAvgTokens} | Avg Speed: ~${subsetAvgSpeed} tok/s`);
  }

  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
