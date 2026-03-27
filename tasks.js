export const config = { runtime: "edge" };

export default async function handler(req) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.DATABASE_ID;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return new Response(
      JSON.stringify({ error: "Missing NOTION_TOKEN or DATABASE_ID env vars" }),
      { status: 500, headers: corsHeaders("application/json") }
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch events today + reminders in the next 90 days
  const body = {
    filter: {
      or: [
        {
          and: [
            { property: "Type", select: { equals: "Event" } },
            { property: "Start", date: { equals: today } },
          ],
        },
        {
          and: [
            { property: "Type", select: { equals: "Reminder" } },
            { property: "Start", date: { on_or_after: today } },
            {
              property: "Start",
              date: {
                on_or_before: new Date(Date.now() + 90 * 86400000)
                  .toISOString()
                  .split("T")[0],
              },
            },
          ],
        },
      ],
    },
    sorts: [{ property: "Start", direction: "ascending" }],
  };

  const res = await fetch(
    `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: corsHeaders("application/json"),
    });
  }

  const tasks = (data.results || []).map((page) => ({
    id: page.id,
    name: page.properties.Name?.title?.[0]?.plain_text ?? "(无标题)",
    status: page.properties.Status?.status?.name ?? page.properties.Status?.select?.name ?? "Not started",
    type: page.properties.Type?.select?.name ?? "Reminder",
    start: page.properties.Start?.date?.start ?? null,
  }));

  return new Response(JSON.stringify({ tasks, today }), {
    headers: corsHeaders("application/json"),
  });
}

function corsHeaders(contentType) {
  const h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}
