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

  // Fetch all items from today to today+90 days regardless of type
  const body = {
    filter: {
      and: [
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
    sorts: [{ property: "Start", direction: "ascending" }],
  };

  // 🔍 调试日志 1: 打印请求信息
  console.log("=== Notion API Request Debug ===");
  console.log("DATABASE_ID:", DATABASE_ID);
  console.log("NOTION_TOKEN exists:", !!NOTION_TOKEN);
  console.log("Request body:", JSON.stringify(body, null, 2));

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

  // 🔍 调试日志 2: 打印响应状态
  console.log("Response status:", res.status);
  console.log("Response ok:", res.ok);

  const data = await res.json();

  // 🔍 调试日志 3: 打印完整的响应数据
  console.log("Response data:", JSON.stringify(data, null, 2));

  if (!res.ok) {
    // 返回完整的错误信息给前端，便于查看
    return new Response(JSON.stringify({
      error: data,
      debug: {
        status: res.status,
        databaseId: DATABASE_ID,
        requestBody: body
      }
    }), {
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
