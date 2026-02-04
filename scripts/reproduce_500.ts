
// Native fetch in Node 18+
// import fetch from 'node-fetch';

const TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImtZTFNDUkdjOHRVbDFKSmQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3dpc2RiYmZpbW9zdnlrcmZ1Z3JvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4ODZmNDU2YS1mZmU4LTQxMTEtOTFlMy04ZWFkMmIzYzkzZTUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY5ODE0OTE1LCJpYXQiOjE3Njk4MTEzMTUsImVtYWlsIjoibWFuYWdlckBqYW1lc3Ryb25pYy50ZXN0IiwicGhvbmUiOiI5MTk5OTk5OTk5OTEiLCJhcHBfbWV0YWRhdGEiOnsiYWxsb3dlZF9jaXR5X2lkcyI6WyIyMjIyMjIyMi1iYmJiLTRiYmItYmJiYi1iYmJiYmJiYmJiYmIiXSwiYXBwX3JvbGUiOiJtYW5hZ2VyIiwiY2l0eV9pZCI6IjIyMjIyMjIyLWJiYmItNGJiYi1iYmJiLWJiYmJiYmJiYmJiYiIsInByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiLCJwaG9uZSJdfSwidXNlcl9tZXRhZGF0YSI6eyJjaXR5X2lkIjoiMjIyMjIyMjItYmJiYi00YmJiLWJiYmItYmJiYmJiYmJiYmJiIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6Ik1hbmFnZXIgKENpdHkgQSkiLCJyb2xlIjoibWFuYWdlciJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzY5ODExMzE1fV0sInNlc3Npb25faWQiOiI4MTdiZWEyNi1hMjc4LTQ0Y2QtYWY1Yi1iYjkwMTlkNTlmNWYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.j4Csswrt7yCuH__bbeaY2QKZCk6fdvnwZTthmUbKJBk";

const REFRESH = "7cj3xagpi3ub";

async function run() {
    const body = {
        city_id: "22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        service_code: "TV_INSTALL_WALL_24_32",
        urgency: "standard",
        complexity: "simple",
        parts_cost: 100
    };

    console.log('Sending request...');
    const response = await fetch('http://localhost:3003/api/pricing/quotes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `sb-wisdbbfimosvykrfugro-auth-token=${JSON.stringify({ access_token: TOKEN, refresh_token: REFRESH })}`
        },
        body: JSON.stringify(body)
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Body:', text);
}

run();
