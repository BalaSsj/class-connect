import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const { subject_id, faculty_id } = await req.json();
    if (!subject_id) throw new Error("Missing subject_id");

    // Get all topics for this subject
    const { data: topics } = await supabase
      .from("syllabus_topics")
      .select("*")
      .eq("subject_id", subject_id)
      .order("unit_number")
      .order("topic_number");

    if (!topics || topics.length === 0) {
      return new Response(JSON.stringify({ prediction: "No syllabus topics found. Please upload a syllabus first.", next_topics: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const covered = topics.filter(t => t.is_covered);
    const uncovered = topics.filter(t => !t.is_covered);
    const { data: subject } = await supabase.from("subjects").select("name, code").eq("id", subject_id).single();

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an academic teaching assistant. Analyze syllabus progress and predict what topics should be taught next, considering prerequisites and logical flow." },
          {
            role: "user",
            content: `Subject: ${subject?.name} (${subject?.code})
Covered topics (${covered.length}/${topics.length}):
${covered.map(t => `- U${t.unit_number} T${t.topic_number}: ${t.title}`).join("\n") || "None"}

Remaining topics:
${uncovered.map(t => `- U${t.unit_number} T${t.topic_number}: ${t.title}${t.description ? " - " + t.description : ""}`).join("\n")}

Based on the syllabus structure and covered topics, recommend the next 3-5 topics to teach in order. Consider prerequisite dependencies. Also provide a brief teaching strategy note for each recommended topic.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "predict_topics",
            description: "Predict next topics to teach with strategy",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      unit_number: { type: "number" },
                      topic_number: { type: "number" },
                      title: { type: "string" },
                      teaching_strategy: { type: "string" },
                      estimated_periods: { type: "number" },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["unit_number", "topic_number", "title", "teaching_strategy", "priority"],
                    additionalProperties: false,
                  },
                },
                overall_progress_note: { type: "string" },
              },
              required: ["predictions", "overall_progress_note"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "predict_topics" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result = { predictions: [], overall_progress_note: "" };
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // If faculty_id provided, create notifications for recommended topics
    if (faculty_id && result.predictions.length > 0) {
      const { data: fac } = await supabase.from("faculty").select("user_id").eq("id", faculty_id).single();
      if (fac?.user_id) {
        const topicsList = result.predictions.slice(0, 3).map((p: any, i: number) =>
          `${i + 1}. U${p.unit_number} T${p.topic_number}: ${p.title} (${p.teaching_strategy})`
        ).join("\n");

        await supabase.from("notifications").insert({
          user_id: fac.user_id,
          title: `📚 Next Topics: ${subject?.code}`,
          message: `AI recommends teaching next:\n${topicsList}\n\n${result.overall_progress_note}`,
          type: "info",
        });
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
