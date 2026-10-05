import re
from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

def generate(system: str, user: str) -> str:
    if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.strip():
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model=ANTHROPIC_MODEL,
                max_tokens=900,
                system=system,
                messages=[{'role': 'user', 'content': user}]
            )
            ans = ''.join(getattr(x, 'text', '') for x in msg.content if getattr(x, 'type', '') == 'text')
            if ans and len(ans.strip()) > 0:
                return ans
        except Exception as exc:
            print(f"[AI Service] Anthropic API call failed: {exc}. Falling back to grounded contextual generator.")

    return educational_context_answer(user)

def educational_context_answer(prompt_text: str) -> str:
    """
    Intelligent educational fallback grounded in retrieved course context and key syllabus concepts.
    Used when no external LLM API key is configured or during offline demonstration mode.
    """
    # Extract Course Context and Question from prompt
    context_match = re.search(r'COURSE CONTEXT:\s*(.*?)(?=\s*QUESTION:|\Z)', prompt_text, re.DOTALL | re.IGNORECASE)
    question_match = re.search(r'QUESTION:\s*(.*)', prompt_text, re.DOTALL | re.IGNORECASE)
    
    context = context_match.group(1).strip() if context_match else ""
    question = question_match.group(1).strip() if question_match else prompt_text.strip()
    q_lower = question.lower()

    # REST API explanation
    if 'rest' in q_lower and ('api' in q_lower or 'what' in q_lower or 'explain' in q_lower):
        return (
            "### 🌐 What is a REST API?\n\n"
            "**REST (Representational State Transfer)** is an architectural style for designing networked applications over HTTP.\n\n"
            "#### 💡 Simple Explanation:\n"
            "Think of a REST API like a waiter in a restaurant. You (the client/frontend) sit at a table and read the menu (available endpoints). "
            "You ask the waiter for an item (request), the waiter brings your order from the kitchen (server/database), and delivers it back to you in a standard format (usually JSON).\n\n"
            "#### 📌 Key HTTP Methods:\n"
            "- **`GET`**: Retrieve data from the server without modifying anything (e.g., `GET /api/v1/courses`).\n"
            "- **`POST`**: Submit new data or create a new resource (e.g., `POST /api/v1/courses/:id/enroll`).\n"
            "- **`PUT` / `PATCH`**: Update an existing resource with new details.\n"
            "- **`DELETE`**: Remove a resource from the server.\n\n"
            "#### 💻 Practical Example:\n"
            "```http\n"
            "GET /api/v1/courses/101 HTTP/1.1\n"
            "Host: api.vertexlearn.local\n"
            "Accept: application/json\n"
            "```\n"
            "Response:\n"
            "```json\n"
            "{\n"
            "  \"id\": \"101\",\n"
            "  \"title\": \"Full Stack Web Development\",\n"
            "  \"status\": \"approved\"\n"
            "}\n"
            "```\n\n"
            "#### 🎯 Summary Points:\n"
            "1. **Stateless**: Every request from client to server must contain all necessary authentication and context.\n"
            "2. **Resource-Oriented**: URIs represent nouns (resources) like `/users`, `/courses`.\n"
            "3. **Predictable Status Codes**: `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.\n\n"
            "> *[Notice: Running in Development AI Mode — Grounded in VertexLearn Course Materials]*"
        )

    # Difference between GET and POST
    if 'difference' in q_lower and ('get' in q_lower and 'post' in q_lower):
        return (
            "### ⚖️ Difference Between GET and POST\n\n"
            "In HTTP and RESTful API architecture, **`GET`** and **`POST`** serve distinct purposes:\n\n"
            "| Feature | GET | POST |\n"
            "| :--- | :--- | :--- |\n"
            "| **Primary Purpose** | Retrieve existing data | Create new resources or submit data |\n"
            "| **Request Body** | Does not typically include a body | Includes a payload (e.g., JSON) in the body |\n"
            "| **Idempotency** | **Idempotent** (repeating produces same server state) | **Non-Idempotent** (repeating creates multiple resources) |\n"
            "| **Caching** | Responses can be cached by browsers/CDNs | Responses are not cached by default |\n"
            "| **Visibility** | Parameters visible in URL query string | Data sent securely within HTTP request body |\n"
            "| **Safety** | Safe method (does not alter server state) | Unsafe method (modifies server state) |\n\n"
            "#### 💡 Real-World Example:\n"
            "- **`GET /api/v1/courses`** reads the course catalog. You can refresh 100 times without side effects.\n"
            "- **`POST /api/v1/auth/login`** sends credentials to authenticate and issue a token.\n\n"
            "> *[Notice: Running in Development AI Mode — Grounded in VertexLearn Course Materials]*"
        )

    # Summary or Key Concepts request
    if 'summar' in q_lower or 'key concept' in q_lower or 'overview' in q_lower:
        if context:
            clean_ctx = re.sub(r'\[Source \d+\]', '', context).strip()
            first_few = clean_ctx[:600]
            return (
                "### 📝 Course Material Summary\n\n"
                f"Based on the course curriculum and retrieved lesson transcripts:\n\n"
                f"{first_few}...\n\n"
                "#### 💡 Core Learning Takeaways:\n"
                "- Master the underlying architectural principles before writing code.\n"
                "- Follow industry best practices regarding security, input validation, and testing.\n"
                "- Utilize hands-on exercises and quizzes to solidify concept retention.\n\n"
                "> *[Notice: Running in Development AI Mode — Grounded in VertexLearn Course Materials]*"
            )

    # Interview Question
    if 'interview' in q_lower:
        return (
            "### 💼 Technical Interview Question\n\n"
            "**Question:** *Explain what makes an API truly RESTful and how HTTP status codes communicate state to clients.*\n\n"
            "#### 🎯 How to structure your answer:\n"
            "1. Define REST principles: Statelessness, Client-Server separation, Uniform Interface, Resource identification through URIs.\n"
            "2. Explain standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).\n"
            "3. Mention standard response categories:\n"
            "   - **2xx**: Success (`200 OK`, `201 Created`)\n"
            "   - **4xx**: Client errors (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`)\n"
            "   - **5xx**: Server errors (`500 Internal Server Error`, `503 Service Unavailable`)\n"
            "4. Provide a concrete example from your past projects.\n\n"
            "> *[Notice: Running in Development AI Mode — Grounded in VertexLearn Course Materials]*"
        )

    # General question grounded in context
    if context:
        clean_ctx = re.sub(r'\[Source \d+\]', '', context).strip()
        paragraphs = [p.strip() for p in clean_ctx.split('\n') if len(p.strip()) > 30]
        excerpt = paragraphs[0] if paragraphs else clean_ctx[:400]
        return (
            f"### 🎓 AI Tutor Explanation\n\n"
            f"Here is an explanation based on the lesson material:\n\n"
            f"> \"{excerpt}\"\n\n"
            f"#### 🔍 Detailed Breakdown:\n"
            f"- **Context**: This concept is fundamental to the course modules and is tested in upcoming quizzes.\n"
            f"- **Application**: When building production systems, always follow this pattern to maintain clean separation of concerns.\n"
            f"- **Next Steps**: Review the lesson notes and take the module quiz to evaluate your understanding.\n\n"
            "> *[Notice: Running in Development AI Mode — Grounded in VertexLearn Course Materials]*"
        )

    return (
        "### 🎓 VertexLearn AI Tutor\n\n"
        "I am ready to help you with this course! You can ask me to:\n"
        "- **Explain concepts simply** (e.g., *'What is REST API?'*)\n"
        "- **Compare topics** (e.g., *'Difference between GET and POST'*)\n"
        "- **Provide practical examples or code snippets**\n"
        "- **Give technical interview questions**\n"
        "- **Summarize the current lesson or course**\n\n"
        "> *[Notice: Running in Development AI Mode. Add ANTHROPIC_API_KEY in .env for production Claude 3.5 Sonnet generation]*"
    )
