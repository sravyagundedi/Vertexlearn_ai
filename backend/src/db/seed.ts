import bcrypt from 'bcryptjs';
import { q, pool } from './pool.js';

async function seed() {
  console.log('--- Starting VertexLearn AI Seed Data Population ---');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // 1. Create / Ensure Demo Users
  const usersToSeed = [
    { name: 'Demo Student', email: 'student@vertexlearn.local', role: 'student', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80' },
    { name: 'Demo Instructor', email: 'instructor@vertexlearn.local', role: 'instructor', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80' },
    { name: 'Demo Admin', email: 'admin@vertexlearn.local', role: 'admin', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80' },
  ];

  const userMap = new Map<string, string>();
  for (const u of usersToSeed) {
    const res = await q<any>(
      `INSERT INTO users (full_name, email, password_hash, role, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url, role = EXCLUDED.role
       RETURNING id, role`,
      [u.name, u.email, passwordHash, u.role, u.avatar]
    );
    userMap.set(u.email, res[0].id);
  }

  const studentId = userMap.get('student@vertexlearn.local')!;
  const instructorId = userMap.get('instructor@vertexlearn.local')!;

  // 2. Clean up duplicate or old demo courses
  await q(`DELETE FROM courses WHERE title = 'Full Stack Web Development' AND id NOT IN (
    SELECT id FROM courses WHERE title = 'Full Stack Web Development' ORDER BY created_at ASC LIMIT 1
  )`);

  // 3. Courses Dataset
  const coursesData = [
    {
      title: 'Full Stack Web Development',
      description: 'Master modern full-stack web engineering: HTML5/CSS3, TypeScript, React, Node.js, Express REST APIs, PostgreSQL databases, Docker containerization, and production deployment.',
      category: 'Development',
      difficulty: 'intermediate',
      price: 0,
      rating: 4.9,
      modules: [
        {
          title: 'Module 1: Web Architecture & Client Foundations',
          order: 1,
          quiz: {
            title: 'Web Foundations & DOM Mastery Quiz',
            description: 'Evaluate your understanding of client-server architecture, HTML semantics, and CSS layout algorithms.',
            difficulty: 'beginner',
            passing_score: 70,
            questions: [
              {
                text: 'Which HTML5 semantic element is best suited to encapsulate independent, self-contained content such as a blog post or news item?',
                options: [
                  { text: '<section>', correct: false },
                  { text: '<article>', correct: true },
                  { text: '<aside>', correct: false },
                  { text: '<div>', correct: false },
                ],
                explanation: '<article> is designed for standalone syndicatable content that makes sense on its own.',
              },
              {
                text: 'What is the default value of the CSS `flex-direction` property in modern browsers?',
                options: [
                  { text: 'column', correct: false },
                  { text: 'row', correct: true },
                  { text: 'row-reverse', correct: false },
                  { text: 'inline', correct: false },
                ],
                explanation: 'Flex containers lay out children along the main axis horizontally in `row` direction by default.',
              },
              {
                text: 'Which JavaScript method correctly adds an event listener without overwriting existing listeners on a DOM node?',
                options: [
                  { text: 'element.onclick = fn', correct: false },
                  { text: 'element.addEventListener("click", fn)', correct: true },
                  { text: 'element.attachListener("click", fn)', correct: false },
                  { text: 'element.bind("click", fn)', correct: false },
                ],
                explanation: '`addEventListener` allows registering multiple event handlers on the same target without clobbering prior handlers.',
              },
            ],
          },
          lectures: [
            {
              title: 'Introduction to Modern Web Architecture',
              video_url: 'https://www.youtube.com/watch?v=zJSY8tbf_ys',
              duration_seconds: 780,
              description: 'Understand the journey of an HTTP request from browser DNS lookup to server response, DOM rendering, and script execution.',
              learning_objectives: [
                'Describe the role of client-server architecture in modern applications',
                'Trace DNS resolution and TLS handshake lifecycles',
                'Understand critical rendering path: DOM, CSSOM, and layout tree',
              ],
              notes: `### Web Architecture Overview\n\nThe web operates on a client-server architecture where clients (browsers, mobile apps) request resources and servers process and respond.\n\n#### Key Milestones in a Request:\n1. **DNS Lookup**: Translates domain name (e.g. vertexlearn.ai) to an IP address.\n2. **TCP & TLS Handshake**: Establishes an encrypted, reliable transport connection.\n3. **HTTP Request & Response**: Client requests an asset with headers, server returns status and body.\n4. **Browser Rendering Engine**: Parses HTML into DOM, CSS into CSSOM, calculates layout, and paints pixels.`,
              key_concepts: ['DNS Resolution', 'TCP/IP', 'Client-Server Model', 'Critical Rendering Path'],
              quick_check: [
                { question: 'What translates human-friendly domains into machine IP addresses?', options: ['DNS', 'BGP', 'TLS', 'HTTP'], answer: 0, explanation: 'The Domain Name System (DNS) maps human-readable names to IP addresses.' }
              ],
              transcript: 'Welcome to Full Stack Web Development. In this foundational lesson, we explore how modern web applications function. When you type an address in your browser, a DNS lookup converts that domain to an IP address. Next, a TCP connection is negotiated alongside TLS encryption. The browser requests index.html, parses the incoming stream into DOM nodes, constructs CSSOM rules, and paints the layout on screen.',
            },
            {
              title: 'HTML5 Semantic Foundations & Accessibility',
              video_url: 'https://www.youtube.com/watch?v=kUMe1FH4CHE',
              duration_seconds: 920,
              description: 'Learn how semantic tags improve SEO, screen reader accessibility, and long-term code maintainability.',
              learning_objectives: [
                'Utilize semantic elements like main, header, nav, section, and article',
                'Apply ARIA roles and labels to enhance accessibility',
                'Structure web forms with proper labels, inputs, and validation attributes',
              ],
              notes: `### Semantic HTML5\n\nSemantic HTML introduces tags that describe their meaning to both browser and developer.\n\n\`\`\`html\n<header>\n  <nav>\n    <a href="/">Home</a>\n  </nav>\n</header>\n<main>\n  <article>\n    <h1>Semantic Architecture</h1>\n    <p>Using semantic elements promotes accessibility and search discoverability.</p>\n  </article>\n</main>\n\`\`\``,
              key_concepts: ['Semantic Tags', 'Screen Readers (a11y)', 'Form Validation'],
              quick_check: [
                { question: 'Which tag should wrap navigation links?', options: ['<nav>', '<menu>', '<header>', '<ul>'], answer: 0, explanation: '<nav> communicates that enclosed links provide primary navigational pathways.' }
              ],
              transcript: 'Semantic HTML is the backbone of accessible web development. By using header, nav, main, article, section, and footer instead of generic div wrappers, search engines understand page hierarchy and assistive technologies can navigate efficiently.',
            },
            {
              title: 'Modern CSS, Flexbox & Grid Systems',
              video_url: 'https://www.youtube.com/watch?v=1PnVor36_40',
              duration_seconds: 1100,
              description: 'Master one-dimensional Flexbox and two-dimensional Grid layouts to craft fluid, responsive UI layouts.',
              learning_objectives: [
                'Master Flexbox alignment, justification, and wrapping',
                'Design 2D layouts using CSS Grid template areas and fractional units',
                'Implement responsive media queries and fluid clamp() typography',
              ],
              notes: `### CSS Flexbox & Grid\n\n- **Flexbox**: Ideal for 1D alignments (rows or columns) such as navbars, button groups, and cards.\n- **CSS Grid**: Ideal for 2D layouts (rows AND columns simultaneously) like dashboards and gallery layouts.\n\n\`\`\`css\n.dashboard-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\n  gap: 1.5rem;\n}\n\`\`\``,
              key_concepts: ['Flexbox', 'CSS Grid', 'Media Queries', 'Clamp sizing'],
              quick_check: [
                { question: 'Which layout model is best suited for 2-dimensional layouts?', options: ['CSS Grid', 'Flexbox', 'Inline-block', 'Float'], answer: 0, explanation: 'CSS Grid was specifically designed for two-dimensional grid layouts.' }
              ],
              transcript: 'In this class, we explore modern CSS layout paradigms. Flexbox gives you control along a single axis, perfect for headers, toolbars, and dynamic alignments. CSS Grid gives you a dual-axis coordinate system to create complete responsive page layouts without brittle hacks.',
            },
            {
              title: 'JavaScript Essentials: Execution & The DOM',
              video_url: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
              duration_seconds: 1350,
              description: 'Understand how JavaScript executes in the browser engine, closures, scope chains, and DOM event delegation.',
              learning_objectives: [
                'Understand execution context, call stack, and memory heap',
                'Use closures and scope chains effectively',
                'Leverage event delegation and bubbling for performant DOM updates',
              ],
              notes: `### JavaScript Engine & The DOM\n\nJavaScript is a single-threaded, non-blocking language powered by an event loop.\n\n\`\`\`javascript\n// Event delegation pattern\ndocument.querySelector('#list').addEventListener('click', (e) => {\n  if (e.target.matches('.item')) {\n    console.log('Clicked item:', e.target.dataset.id);\n  }\n});\n\`\`\``,
              key_concepts: ['Call Stack', 'Event Delegation', 'Closures', 'Async Event Loop'],
              quick_check: [
                { question: 'What enables a nested function to retain access to outer variables after execution?', options: ['Closure', 'Hoisting', 'Prototype', 'Polymorphism'], answer: 0, explanation: 'Closures bundle a function with references to its surrounding lexical environment.' }
              ],
              transcript: 'JavaScript brings the web to life. In this lesson, we study the JavaScript runtime, the call stack, memory heap, and event loop. We will see how functions create closures and how event delegation lets you listen to dynamic children efficiently.',
            },
          ],
        },
        {
          title: 'Module 2: Backend Architecture & REST APIs',
          order: 2,
          quiz: {
            title: 'REST APIs, HTTP & Node.js Mastery Quiz',
            description: 'Test your understanding of RESTful API principles, HTTP verbs, status codes, idempotency, and Node.js asynchronous architecture.',
            difficulty: 'intermediate',
            passing_score: 75,
            questions: [
              {
                text: 'Which HTTP method is specifically intended to retrieve data without modifying any server state?',
                options: [
                  { text: 'POST', correct: false },
                  { text: 'GET', correct: true },
                  { text: 'DELETE', correct: false },
                  { text: 'PATCH', correct: false },
                ],
                explanation: 'GET requests must be safe and idempotent, intended exclusively for retrieving resource representations.',
              },
              {
                text: 'What is the primary architectural difference between HTTP PUT and PATCH methods?',
                options: [
                  { text: 'PUT replaces the entire resource; PATCH applies partial modifications', correct: true },
                  { text: 'PUT is safe; PATCH is unsafe', correct: false },
                  { text: 'PUT cannot have a request body; PATCH requires one', correct: false },
                  { text: 'There is no difference; they are exact synonyms', correct: false },
                ],
                explanation: 'RFC specifications state PUT completely replaces target resources, whereas PATCH updates specified fields.',
              },
              {
                text: 'Which HTTP response status code communicates that a new resource has been successfully created?',
                options: [
                  { text: '200 OK', correct: false },
                  { text: '201 Created', correct: true },
                  { text: '204 No Content', correct: false },
                  { text: '304 Not Modified', correct: false },
                ],
                explanation: '201 Created is the standard status code indicating that the request resulted in the creation of a new resource.',
              },
              {
                text: 'What does "statelessness" mean in the context of REST API design?',
                options: [
                  { text: 'The server stores user session data in server memory across requests', correct: false },
                  { text: 'Every request contains all credentials and information needed for processing', correct: true },
                  { text: 'The server does not connect to any database', correct: false },
                  { text: 'The client must always retain a WebSocket connection', correct: false },
                ],
                explanation: 'REST statelessness requires that all context needed to satisfy a request is contained entirely in the request itself.',
              },
              {
                text: 'Which header indicates that the request or response payload is formatted as JSON?',
                options: [
                  { text: 'Accept-Encoding: gzip', correct: false },
                  { text: 'Content-Type: application/json', correct: true },
                  { text: 'Content-Disposition: attachment', correct: false },
                  { text: 'Connection: keep-alive', correct: false },
                ],
                explanation: '`Content-Type: application/json` informs the parser to deserialize the body as JSON data.',
              },
            ],
          },
          lectures: [
            {
              title: 'HTTP Fundamentals: Methods, Headers & Status Codes',
              video_url: 'https://www.youtube.com/watch?v=-MTSQjw5DrM',
              duration_seconds: 960,
              description: 'Detailed analysis of the HTTP/1.1 and HTTP/2 protocols, headers, verbs, and status code taxonomies.',
              learning_objectives: [
                'Distinguish between Safe and Idempotent HTTP methods',
                'Correctly apply status codes (2xx, 3xx, 4xx, 5xx)',
                'Utilize standard headers for caching, authorization, and content negotiation',
              ],
              notes: `### HTTP Protocol Principles\n\nHTTP is the communication protocol of the web. Understanding its verbs and status codes is essential for backend engineering.\n\n#### HTTP Status Code Categories:\n- **2xx (Success)**: \`200 OK\`, \`201 Created\`, \`204 No Content\`\n- **3xx (Redirection)**: \`301 Moved Permanently\`, \`304 Not Modified\`\n- **4xx (Client Errors)**: \`400 Bad Request\`, \`401 Unauthorized\`, \`403 Forbidden\`, \`404 Not Found\`\n- **5xx (Server Errors)**: \`500 Internal Server Error\`, \`503 Service Unavailable\``,
              key_concepts: ['HTTP Verbs', 'Status Codes', 'Idempotency', 'Request Headers'],
              quick_check: [
                { question: 'Which status code indicates an unauthenticated request?', options: ['401 Unauthorized', '403 Forbidden', '400 Bad Request', '404 Not Found'], answer: 0, explanation: '401 Unauthorized indicates that the client must authenticate itself before proceeding.' }
              ],
              transcript: 'REST APIs expose resources over HTTP. GET reads data, POST creates resources, PUT updates resources completely, and DELETE removes resources. Authentication and authorization protect private endpoints. Good APIs validate inputs, return predictable errors, and use pagination for large collections.',
            },
            {
              title: 'REST API Architecture & Resource Modeling',
              video_url: 'https://www.youtube.com/watch?v=-MTSQjw5DrM',
              duration_seconds: 1140,
              description: 'Design clean, predictable, RESTful endpoints following standard conventions, resource nesting, and error schemas.',
              learning_objectives: [
                'Structure resource URIs using plural nouns (e.g. /courses, /modules)',
                'Implement nested resource endpoints (e.g. /courses/:id/modules)',
                'Design standardized error payloads and validation formats',
              ],
              notes: `### RESTful URI Conventions\n\n- **Get all courses**: \`GET /api/v1/courses\`\n- **Get course by id**: \`GET /api/v1/courses/:id\`\n- **Enroll in course**: \`POST /api/v1/courses/:id/enroll\`\n- **Update lecture progress**: \`POST /api/v1/lectures/:id/progress\`\n\nAvoid using verbs in URIs (e.g. avoid \`/getCourse\` or \`/createLecture\`). The HTTP verb describes the action; the URI identifies the resource.`,
              key_concepts: ['Uniform Interface', 'Resource Naming', 'Sub-resources', 'HATEOAS'],
              quick_check: [
                { question: 'Which URI follows best REST design for creating a comment on post 42?', options: ['POST /posts/42/comments', 'POST /createCommentForPost42', 'GET /posts/42?action=comment', 'POST /posts/add_comment/42'], answer: 0, explanation: 'Nesting resources as `/posts/42/comments` with POST verb cleanly reflects hierarchy.' }
              ],
              transcript: 'In this lesson, we study REST API design. A REST API communicates over HTTP using nouns for endpoints and HTTP verbs for operations. For example, GET /courses retrieves courses, while POST /courses adds a new one. We must ensure error responses return standard error objects with machine-readable codes and helpful messages.',
            },
            {
              title: 'Node.js Core: Event Loop, Asynchronous I/O & Streams',
              video_url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
              duration_seconds: 1320,
              description: 'Deep dive into the Node.js libuv event loop, non-blocking I/O phases, and memory management.',
              learning_objectives: [
                'Understand the 6 phases of the libuv event loop',
                'Compare process.nextTick, Promise microtasks, and setImmediate',
                'Process large data using Node.js Readable and Writable streams',
              ],
              notes: `### Node.js Event Loop Phases\n\n1. **Timers**: Executes callbacks scheduled by setTimeout and setInterval\n2. **Pending Callbacks**: Executes I/O callbacks deferred to the next loop iteration\n3. **Idle, Prepare**: Used internally only\n4. **Poll**: Retrieves new I/O events; executes I/O related callbacks\n5. **Check**: Executes setImmediate() callbacks\n6. **Close Callbacks**: Handles socket closures`,
              key_concepts: ['Libuv', 'Event Loop', 'Microtasks', 'Streams'],
              quick_check: [
                { question: 'Which entity powers the non-blocking asynchronous I/O engine in Node.js?', options: ['libuv', 'V8 engine only', 'Apache', 'Nginx'], answer: 0, explanation: 'libuv is the multi-platform C library that provides the asynchronous event loop.' }
              ],
              transcript: 'Node.js allows JavaScript to run on the server. Because JavaScript is single-threaded, Node.js delegates filesystem, database, and network operations to libuv worker threads. When an operation completes, its callback is queued in the event loop without blocking the main execution thread.',
            },
            {
              title: 'Express.js: Middleware Pipeline & Production Error Handling',
              video_url: 'https://www.youtube.com/watch?v=Oe421EPjeBE',
              duration_seconds: 1250,
              description: 'Build enterprise Express.js microservices with custom middleware chains, authentication guards, and centralized error handlers.',
              learning_objectives: [
                'Write modular middleware functions with (req, res, next)',
                'Implement robust centralized error middleware (err, req, res, next)',
                'Integrate rate-limiting, CORS, and helmet security headers',
              ],
              notes: `### Centralized Error Handling in Express\n\nAlways declare error handling middleware at the very end of your app:\n\n\`\`\`typescript\napp.use((err: any, req: Request, res: Response, next: NextFunction) => {\n  console.error(err);\n  const status = err.status || 500;\n  res.status(status).json({\n    error: {\n      code: err.code || 'INTERNAL_ERROR',\n      message: err.message || 'Server error'\n    }\n  });\n});\n\`\`\``,
              key_concepts: ['Middleware Pipeline', 'Error Handling', 'CORS', 'Rate Limiting'],
              quick_check: [
                { question: 'How many arguments must an Express error handling middleware function accept?', options: ['4 (err, req, res, next)', '3 (req, res, next)', '2 (req, res)', '1 (err)'], answer: 0, explanation: 'Express identifies error-handling middleware specifically by having 4 arguments.' }
              ],
              transcript: 'Express uses a chain-of-responsibility middleware pattern. Every request flows sequentially through logging, CORS, rate limiting, authentication, route handlers, and finally into the global error handler if any step passes an error to next(err).',
            },
          ],
        },
        {
          title: 'Module 3: Database Systems & PostgreSQL',
          order: 3,
          quiz: {
            title: 'Database Architecture & SQL Optimization Quiz',
            description: 'Evaluate your proficiency with relational schemas, indexing, foreign keys, transactions, and pgvector embeddings.',
            difficulty: 'intermediate',
            passing_score: 70,
            questions: [
              {
                text: 'What is the purpose of an SQL index on a database column?',
                options: [
                  { text: 'To compress the table disk size', correct: false },
                  { text: 'To speed up SELECT query retrieval at the expense of write latency', correct: true },
                  { text: 'To ensure column values can never be modified', correct: false },
                  { text: 'To automatically encrypt sensitive data', correct: false },
                ],
                explanation: 'Indexes create balanced trees or hashes that locate rows in logarithmic time, speeding up reads while adding overhead on writes.',
              },
              {
                text: 'What ensures that all steps of a multi-table database transaction either all commit or all rollback safely?',
                options: [
                  { text: 'ACID Properties (Atomicity)', correct: true },
                  { text: 'Eventual Consistency', correct: false },
                  { text: 'DNS Routing', correct: false },
                  { text: 'HTTP Keep-Alive', correct: false },
                ],
                explanation: 'Atomicity in ACID guarantees that an entire series of database modifications finishes or leaves the database unchanged.',
              },
            ],
          },
          lectures: [
            {
              title: 'Relational Modeling, Foreign Keys & Schema Design',
              video_url: 'https://www.youtube.com/watch?v=qw--VYLpxG4',
              duration_seconds: 1400,
              description: 'Model scalable relational schemas in PostgreSQL using primary keys, UUIDs, foreign keys, cascading deletes, and unique constraints.',
              learning_objectives: [
                'Normalize data up to Third Normal Form (3NF)',
                'Apply ON DELETE CASCADE and ON DELETE SET NULL safely',
                'Choose appropriate data types: UUID, TIMESTAMPTZ, NUMERIC, and JSONB',
              ],
              notes: `### PostgreSQL Schema Best Practices\n\n- Use **UUID** for globally unique non-guessable IDs.\n- Use **TIMESTAMPTZ** for timezone-aware timestamps.\n- Use **NUMERIC(10,2)** for prices and financial numbers to avoid floating point inaccuracies.\n- Enforce referential integrity using **FOREIGN KEY** with appropriate cascade rules.`,
              key_concepts: ['Primary Keys', 'Foreign Keys', 'UUIDs', 'Cascading Rules'],
              quick_check: [
                { question: 'Why should monetary prices use NUMERIC rather than FLOAT in PostgreSQL?', options: ['NUMERIC avoids binary floating point rounding errors', 'FLOAT is limited to whole numbers', 'NUMERIC is always faster', 'FLOAT cannot be stored on disk'], answer: 0, explanation: 'NUMERIC stores exact decimals, preventing rounding anomalies critical in financial operations.' }
              ],
              transcript: 'Relational databases form the bedrock of persistent enterprise software. In this lecture, we design PostgreSQL tables with foreign keys and unique constraints. We inspect the vertexlearn schema: users, courses, modules, lectures, enrollments, and lecture_progress, ensuring data integrity.',
            },
            {
              title: 'Advanced SQL: Aggregations, Joins & Subqueries',
              video_url: 'https://www.youtube.com/watch?v=qw--VYLpxG4',
              duration_seconds: 1550,
              description: 'Write performant multi-table queries utilizing INNER JOIN, LEFT JOIN, GROUP BY, HAVING, and window functions.',
              learning_objectives: [
                'Master complex multi-table joins without N+1 query bottlenecks',
                'Calculate aggregate metrics (COUNT, AVG, SUM, COALESCE)',
                'Optimize subqueries and Common Table Expressions (CTEs)',
              ],
              notes: `### Aggregations & Joins\n\n\`\`\`sql\nSELECT c.id, c.title, \n       COUNT(DISTINCT e.id)::int AS total_students,\n       COALESCE(AVG(e.progress_percent), 0)::numeric(5,2) AS avg_progress\nFROM courses c\nLEFT JOIN enrollments e ON e.course_id = c.id\nGROUP BY c.id, c.title;\n\`\`\``,
              key_concepts: ['LEFT JOIN', 'GROUP BY', 'COALESCE', 'CTEs'],
              quick_check: [
                { question: 'What does COALESCE(val, 0) do when val is NULL?', options: ['Returns 0', 'Throws a runtime error', 'Deletes the row', 'Returns NULL'], answer: 0, explanation: 'COALESCE returns the first non-null argument in its parameter list.' }
              ],
              transcript: 'In this lesson, we write analytical queries to calculate student progress and enrollment analytics across multiple joined tables. We use COALESCE to ensure clean fallback numbers when no enrollments exist.',
            },
          ],
        },
      ],
    },
    {
      title: 'Python Programming Masterclass',
      description: 'Comprehensive modern Python from fundamentals to OOP, decorators, generators, data manipulation, APIs, and automated testing.',
      category: 'Programming',
      difficulty: 'beginner',
      price: 0,
      rating: 4.8,
      modules: [
        {
          title: 'Module 1: Python Fundamentals & Data Structures',
          order: 1,
          quiz: {
            title: 'Python Basics & Collections Quiz',
            description: 'Verify your knowledge of Python lists, dicts, tuples, and comprehension expressions.',
            difficulty: 'beginner',
            passing_score: 70,
            questions: [
              {
                text: 'Which data structure in Python is immutable?',
                options: [
                  { text: 'List', correct: false },
                  { text: 'Dictionary', correct: false },
                  { text: 'Tuple', correct: true },
                  { text: 'Set', correct: false },
                ],
                explanation: 'Tuples cannot be modified after instantiation.',
              },
            ],
          },
          lectures: [
            {
              title: 'Python Syntax, Variables & Control Flow',
              video_url: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
              duration_seconds: 1200,
              description: 'Learn the Pythonic way to structure code, declare typed variables, and control flow with match/case and loops.',
              learning_objectives: ['Understand Python data types', 'Apply conditional branching and loops', 'Utilize type annotations'],
              notes: '### Python Basics\n\nPython emphasizes readability and clean syntax with significant whitespace.',
              key_concepts: ['Indentation', 'Type Hints', 'List Comprehensions'],
              quick_check: [{ question: 'What keyword defines a function in Python?', options: ['def', 'func', 'function', 'fn'], answer: 0, explanation: 'In Python, `def` defines a function.' }],
              transcript: 'Welcome to Python. Python is renowned for its elegant syntax and versatility in backend development, AI, and automation.',
            },
          ],
        },
      ],
    },
    {
      title: 'Database Management & SQL Systems',
      description: 'Deep dive into relational database administration, query optimization, ACID transactions, partitioning, and pgvector semantic indexing.',
      category: 'Database',
      difficulty: 'intermediate',
      price: 0,
      rating: 4.9,
      modules: [
        {
          title: 'Module 1: Relational Modeling & Indexing',
          order: 1,
          quiz: {
            title: 'PostgreSQL Indexing & Optimization Quiz',
            description: 'Evaluate index types (B-Tree, GiST, GIN, HNSW) and query planning.',
            difficulty: 'intermediate',
            passing_score: 70,
            questions: [
              {
                text: 'Which index type is default for standard column equality and range searches in PostgreSQL?',
                options: [
                  { text: 'B-Tree', correct: true },
                  { text: 'Hash', correct: false },
                  { text: 'GIN', correct: false },
                  { text: 'BRIN', correct: false },
                ],
                explanation: 'B-Tree is the default PostgreSQL index suitable for =, <, <=, >, >= comparisons.',
              },
            ],
          },
          lectures: [
            {
              title: 'PostgreSQL Architecture & Storage Engine',
              video_url: 'https://www.youtube.com/watch?v=qw--VYLpxG4',
              duration_seconds: 1300,
              description: 'Understand PostgreSQL MVCC, write-ahead logging (WAL), and page memory buffers.',
              learning_objectives: ['Explain Multi-Version Concurrency Control (MVCC)', 'Understand WAL logging', 'Configure connection pooling'],
              notes: '### PostgreSQL Internals\n\nPostgreSQL uses MVCC so readers never block writers and writers never block readers.',
              key_concepts: ['MVCC', 'WAL', 'Shared Buffers'],
              quick_check: [{ question: 'What does MVCC stand for?', options: ['Multi-Version Concurrency Control', 'Master View Control Center', 'Module Vector Cache Control', 'Multi Variable Condition Check'], answer: 0, explanation: 'MVCC stands for Multi-Version Concurrency Control.' }],
              transcript: 'In this class, we inspect the internals of PostgreSQL, how pages are written to disk, how VACUUM reclaims storage, and how WAL guarantees durability.',
            },
          ],
        },
      ],
    },
    {
      title: 'Machine Learning & AI Engineering',
      description: 'Explore neural networks, vector embeddings, semantic search with pgvector, and Retrieval-Augmented Generation (RAG) with LLMs.',
      category: 'Data Science',
      difficulty: 'advanced',
      price: 0,
      rating: 4.95,
      modules: [
        {
          title: 'Module 1: RAG & Vector Databases',
          order: 1,
          quiz: {
            title: 'RAG & Vector Retrieval Quiz',
            description: 'Test your understanding of cosine distance, chunking strategies, and prompt augmentation.',
            difficulty: 'advanced',
            passing_score: 75,
            questions: [
              {
                text: 'What is the purpose of Retrieval-Augmented Generation (RAG)?',
                options: [
                  { text: 'To ground LLM outputs in verified external or private documents to prevent hallucinations', correct: true },
                  { text: 'To compress model weights onto mobile phones', correct: false },
                  { text: 'To replace Python with C++', correct: false },
                  { text: 'To train a model from scratch without data', correct: false },
                ],
                explanation: 'RAG dynamically retrieves relevant context chunks and injects them into the prompt, ensuring grounded factual responses.',
              },
            ],
          },
          lectures: [
            {
              title: 'Retrieval Augmented Generation (RAG) Architecture',
              video_url: 'https://www.youtube.com/watch?v=T-D1OfcDW1M',
              duration_seconds: 1420,
              description: 'How to build production RAG systems with document chunking, embeddings, pgvector cosine distance, and LLM synthesis.',
              learning_objectives: ['Design chunking pipelines with overlap', 'Perform vector similarity searches using cosine distance', 'Construct grounded context prompts for AI tutors'],
              notes: '### RAG Pipeline\n\n1. Chunk documents into ~800 char segments\n2. Compute embeddings (vectors)\n3. Query vector database with user query vector\n4. Inject top chunks into system prompt\n5. Synthesize answer with source citations',
              key_concepts: ['Cosine Similarity', 'pgvector', 'Context Windows', 'Hallucination Mitigation'],
              quick_check: [{ question: 'What SQL operator in pgvector measures cosine distance?', options: ['<=>', '<+>', '<->', '<*>'], answer: 0, explanation: '<=> computes cosine distance between vectors in pgvector.' }],
              transcript: 'RAG combines the retrieval capability of vector databases with the generation capability of Large Language Models. By passing retrieved lecture transcripts to the model, our AI Tutor answers student queries with source citations.',
            },
          ],
        },
      ],
    },
    {
      title: 'Modern React & TypeScript Architecture',
      description: 'Build enterprise-grade frontend applications with React 19, TypeScript strict mode, state management, and modern design systems.',
      category: 'Frontend',
      difficulty: 'intermediate',
      price: 0,
      rating: 4.85,
      modules: [
        {
          title: 'Module 1: React 19 & Component Design',
          order: 1,
          quiz: {
            title: 'React & TypeScript Architecture Quiz',
            description: 'Assess your mastery of React lifecycle, hooks, and TypeScript interfaces.',
            difficulty: 'intermediate',
            passing_score: 70,
            questions: [
              {
                text: 'Which React hook memoizes an expensive calculation between re-renders?',
                options: [
                  { text: 'useMemo', correct: true },
                  { text: 'useCallback', correct: false },
                  { text: 'useRef', correct: false },
                  { text: 'useEffect', correct: false },
                ],
                explanation: '`useMemo` caches the result of a calculation between renders.',
              },
            ],
          },
          lectures: [
            {
              title: 'React 19 Hooks, Props & State Management',
              video_url: 'https://www.youtube.com/watch?v=bMknfKXIFA8',
              duration_seconds: 1300,
              description: 'Learn modern React architecture, pure components, custom hooks, and context state.',
              learning_objectives: ['Master useState, useEffect, and custom hooks', 'Structure reusable component props with TypeScript', 'Implement responsive layout grids'],
              notes: '### React 19 State\n\nAlways maintain unidirectional data flow and isolate side effects in custom hooks.',
              key_concepts: ['Unidirectional Flow', 'Custom Hooks', 'Strict TypeScript Props'],
              quick_check: [{ question: 'What guarantees that state updates in React trigger safe UI re-renders?', options: ['Immutability', 'Global variables', 'Direct DOM mutation', 'Timers'], answer: 0, explanation: 'Immutability allows React to detect changes by reference comparison.' }],
              transcript: 'React simplifies building dynamic user interfaces. By breaking views into composable components with typed props, teams build maintainable, responsive applications.',
            },
          ],
        },
      ],
    },
  ];

  // 4. Insert / Update Courses, Modules, Lectures, and Quizzes
  for (const cData of coursesData) {
    const courseRes = await q<any>(
      `INSERT INTO courses (instructor_id, title, description, category, difficulty, price, status, rating)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
       ON CONFLICT (title) DO UPDATE
       SET description = EXCLUDED.description, category = EXCLUDED.category,
           difficulty = EXCLUDED.difficulty, status = 'approved', rating = EXCLUDED.rating
       RETURNING id`,
      [instructorId, cData.title, cData.description, cData.category, cData.difficulty, cData.price, cData.rating]
    );

    const courseId = courseRes[0].id;

    for (const mData of cData.modules) {
      const moduleRes = await q<any>(
        `INSERT INTO modules (course_id, title, order_index)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [courseId, mData.title, mData.order]
      );

      let moduleId = moduleRes[0]?.id;
      if (!moduleId) {
        const found = await q<any>(
          'SELECT id FROM modules WHERE course_id = $1 AND title = $2',
          [courseId, mData.title]
        );
        moduleId = found[0]?.id;
      }

      // Lectures
      for (let lIdx = 0; lIdx < mData.lectures.length; lIdx++) {
        const lData = mData.lectures[lIdx];
        const lectureRes = await q<any>(
          `INSERT INTO lectures (
             module_id, title, video_url, transcript, duration_seconds, order_index,
             description, learning_objectives, notes, key_concepts, quick_check
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            moduleId,
            lData.title,
            lData.video_url,
            lData.transcript,
            lData.duration_seconds,
            lIdx + 1,
            lData.description,
            lData.learning_objectives,
            lData.notes,
            lData.key_concepts,
            JSON.stringify(lData.quick_check),
          ]
        );

        let lectureId = lectureRes[0]?.id;
        if (!lectureId) {
          const found = await q<any>(
            'SELECT id FROM lectures WHERE module_id = $1 AND title = $2',
            [moduleId, lData.title]
          );
          lectureId = found[0]?.id;
          if (lectureId) {
            await q(
              `UPDATE lectures
               SET video_url = $1, transcript = $2, duration_seconds = $3,
                   description = $4, learning_objectives = $5, notes = $6,
                   key_concepts = $7, quick_check = $8
               WHERE id = $9`,
              [
                lData.video_url,
                lData.transcript,
                lData.duration_seconds,
                lData.description,
                lData.learning_objectives,
                lData.notes,
                lData.key_concepts,
                JSON.stringify(lData.quick_check),
                lectureId,
              ]
            );
          }
        }
      }

      // Quiz
      if (mData.quiz) {
        const quizRes = await q<any>(
          `INSERT INTO quizzes (module_id, course_id, title, description, difficulty, passing_score, is_ai_generated)
           VALUES ($1, $2, $3, $4, $5, $6, false)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [moduleId, courseId, mData.quiz.title, mData.quiz.description, mData.quiz.difficulty, mData.quiz.passing_score]
        );

        let quizId = quizRes[0]?.id;
        if (!quizId) {
          const found = await q<any>('SELECT id FROM quizzes WHERE module_id = $1 AND title = $2', [
            moduleId,
            mData.quiz.title,
          ]);
          quizId = found[0]?.id;
        }

        if (quizId) {
          for (let qIdx = 0; qIdx < mData.quiz.questions.length; qIdx++) {
            const qItem = mData.quiz.questions[qIdx];
            const qqRes = await q<any>(
              `INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index, explanation, points)
               VALUES ($1, $2, 'mcq', $3, $4, 1)
               ON CONFLICT DO NOTHING
               RETURNING id`,
              [quizId, qItem.text, qIdx + 1, qItem.explanation]
            );

            let questionId = qqRes[0]?.id;
            if (!questionId) {
              const found = await q<any>(
                'SELECT id FROM quiz_questions WHERE quiz_id = $1 AND question_text = $2',
                [quizId, qItem.text]
              );
              questionId = found[0]?.id;
            }

            if (questionId) {
              // Delete old options and re-insert for freshness
              await q('DELETE FROM quiz_options WHERE question_id = $1', [questionId]);
              for (const opt of qItem.options) {
                await q(
                  `INSERT INTO quiz_options (question_id, option_text, is_correct)
                   VALUES ($1, $2, $3)`,
                  [questionId, opt.text, opt.correct]
                );
              }
            }
          }
        }
      }
    }
  }

  // 5. Enroll Student in "Full Stack Web Development" & "Modern React & TypeScript Architecture"
  const fullstackCourse = (await q<any>('SELECT id FROM courses WHERE title = $1', ['Full Stack Web Development']))[0];
  const reactCourse = (await q<any>('SELECT id FROM courses WHERE title = $1', ['Modern React & TypeScript Architecture']))[0];

  if (fullstackCourse) {
    const enrollRes = await q<any>(
      `INSERT INTO enrollments (user_id, course_id, progress_percent)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, course_id) DO UPDATE SET progress_percent = EXCLUDED.progress_percent
       RETURNING id`,
      [studentId, fullstackCourse.id]
    );

    const enrollmentId = enrollRes[0].id;

    // Get lectures for Full Stack Web Dev
    const lectures = await q<any>(
      `SELECT l.id, l.title, l.duration_seconds
       FROM lectures l
       JOIN modules m ON m.id = l.module_id
       WHERE m.course_id = $1
       ORDER BY m.order_index ASC, l.order_index ASC`,
      [fullstackCourse.id]
    );

    // Mark the first 2 lessons as completed
    if (lectures.length >= 2) {
      for (let i = 0; i < 2; i++) {
        await q(
          `INSERT INTO lecture_progress (enrollment_id, lecture_id, watched_seconds, completed, last_watched_at)
           VALUES ($1, $2, $3, true, now())
           ON CONFLICT (enrollment_id, lecture_id) DO UPDATE
           SET completed = true, watched_seconds = EXCLUDED.watched_seconds, last_watched_at = now()`,
          [enrollmentId, lectures[i].id, lectures[i].duration_seconds]
        );
      }

      // Calculate real progress
      const totalLectures = lectures.length;
      const progressPercent = Math.round((2 / totalLectures) * 100);
      await q('UPDATE enrollments SET progress_percent = $1 WHERE id = $2', [progressPercent, enrollmentId]);
    }

    // Seed a completed quiz attempt for demo student
    const quiz = (await q<any>('SELECT id FROM quizzes WHERE course_id = $1 LIMIT 1', [fullstackCourse.id]))[0];
    if (quiz) {
      await q(
        `INSERT INTO quiz_attempts (quiz_id, user_id, score, total_questions, correct_answers, percentage, passed, submitted_at)
         VALUES ($1, $2, 100, 3, 3, 100, true, now() - INTERVAL '1 day')
         ON CONFLICT DO NOTHING`,
        [quiz.id, studentId]
      );
    }
  }

  if (reactCourse) {
    await q(
      `INSERT INTO enrollments (user_id, course_id, progress_percent)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [studentId, reactCourse.id]
    );
  }

  // Ensure streak record
  await q(
    `INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date)
     VALUES ($1, 7, 14, CURRENT_DATE)
     ON CONFLICT (user_id) DO UPDATE SET current_streak = 7, last_active_date = CURRENT_DATE`,
    [studentId]
  );

  console.log('--- VertexLearn AI Database Seeding Finished Successfully! ---');
  await pool.end();
}

seed().catch((e) => {
  console.error('Seed script error:', e);
  process.exit(1);
});
