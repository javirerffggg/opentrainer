import { NextResponse } from "next/server";
import {
  ROUTINE_GENERATOR_PROMPT,
  ROUTINE_SWAP_SYSTEM_PROMPT,
  SMART_SWAP_SYSTEM_PROMPT,
  TRAINING_LAB_FULL_PROMPT,
  TRAINING_LAB_SNAPSHOT_PROMPT,
} from "../../../../convex/ai/prompts";

const EQUIPMENT_PARSER_PROMPT = `You are an equipment parser for a fitness app. Parse the user's gym description into a structured equipment list.

KNOWN GYM CHAINS (use these defaults):
- "Planet Fitness": smith_machine, cable_machine, dumbbells, leg_press, leg_curl, leg_extension, pull_up_bar, treadmill, bike, elliptical (NO barbell, NO power_rack, NO heavy dumbbells)
- "LA Fitness" / "24 Hour Fitness" / "Gold's Gym": Full gym - all equipment available
- "Anytime Fitness": Usually full gym, may vary by location
- "Orange Theory": dumbbells, rower, treadmill, trx (limited strength equipment)
- "CrossFit box": barbell, power_rack, pull_up_bar, kettlebells, rower, rings
- "YMCA": Typically full gym with good variety

HOME GYM PATTERNS:
- "power rack" / "squat rack" / "cage": power_rack, usually implies barbell
- "dumbbells only": dumbbells, possibly adjustable_bench
- "bands" / "resistance bands": resistance_bands
- "pull-up bar" / "doorway bar": pull_up_bar

VALID EQUIPMENT IDS:
barbell, dumbbells, kettlebells, resistance_bands, pull_up_bar, adjustable_bench, power_rack, smith_machine, cable_machine, leg_press, leg_curl, leg_extension, chest_fly_machine, lat_pulldown, seated_row_machine, shoulder_press_machine, dip_station, hyperextension_bench, ab_wheel, exercise_ball, treadmill, stationary_bike, elliptical, rower, stair_climber, jump_rope, sled, rings, trx

OUTPUT FORMAT (JSON only):
{
  "equipment": ["equipment_id", "equipment_id", ...],
  "note": "Optional note about limitations or assumptions"
}

RULES:
1. Only use equipment IDs from the valid list above
2. When in doubt about a gym chain, assume full equipment
3. Include a note when making assumptions about limitations
4. For home gyms, only include what's explicitly mentioned`;

interface GeminiCallOptions {
  systemPrompt: string;
  userMessage: string;
  responseFormat?: "json" | "text";
  maxTokens?: number;
}

async function callOpenRouterGemini(options: GeminiCallOptions) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://opentrainer.app",
      "X-Title": "OpenTrainer",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userMessage },
      ],
      max_tokens: options.maxTokens ?? 1024,
      ...(options.responseFormat === "json" && {
        response_format: { type: "json_object" },
      }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content ?? "";

  return {
    text: content,
  };
}

export async function POST(request: Request) {
  try {
    const { action, args } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    // 1. generateRoutine
    if (action.includes("routineGenerator") && action.includes("generateRoutine")) {
      const payload = {
        profile: args.profile,
        request: {
          splitType: args.splitType,
          primaryGoal: args.primaryGoal,
          additionalNotes: args.additionalNotes,
        },
      };

      const response = await callOpenRouterGemini({
        systemPrompt: ROUTINE_GENERATOR_PROMPT,
        userMessage: JSON.stringify(payload),
        responseFormat: "json",
        maxTokens: 2048,
      });

      const result = JSON.parse(response.text);

      // Basic validation
      if (!result.name || typeof result.name !== "string") {
        throw new Error("Invalid routine: missing name");
      }
      if (!Array.isArray(result.days) || result.days.length === 0) {
        throw new Error("Invalid routine: missing days");
      }

      return NextResponse.json(result);
    }

    // 2. getRoutineSwapAlternatives
    if (action.includes("routineGenerator") && action.includes("getRoutineSwapAlternatives")) {
      const payload = {
        exercise: args.exerciseName,
        reason: args.reason,
        equipment: args.equipment ?? [],
        dayExercises: args.dayContext ?? [],
        userNotes: args.userNotes,
      };

      const response = await callOpenRouterGemini({
        systemPrompt: ROUTINE_SWAP_SYSTEM_PROMPT,
        userMessage: JSON.stringify(payload),
        responseFormat: "json",
        maxTokens: 512,
      });

      const result = JSON.parse(response.text);
      return NextResponse.json(result);
    }

    // 3. parseEquipment
    if (action.includes("equipmentParser") && action.includes("parseEquipment")) {
      if (!args.description || !args.description.trim()) {
        return NextResponse.json({ equipment: [], note: "No description provided" });
      }

      const response = await callOpenRouterGemini({
        systemPrompt: EQUIPMENT_PARSER_PROMPT,
        userMessage: args.description,
        responseFormat: "json",
        maxTokens: 512,
      });

      const result = JSON.parse(response.text);
      return NextResponse.json(result);
    }

    // 4. smartSwap getAlternatives
    if (action.includes("smartSwap") && action.includes("getAlternatives")) {
      const payload = {
        eq: args.eq ?? [],
        curr: args.curr,
        reason: args.reason,
        recentVol: args.recentVol ?? [],
        swapCount: args.swapCount,
      };

      const response = await callOpenRouterGemini({
        systemPrompt: SMART_SWAP_SYSTEM_PROMPT,
        userMessage: JSON.stringify(payload),
        responseFormat: "json",
      });

      const result = JSON.parse(response.text);
      return NextResponse.json(result);
    }

    // 5. trainingLab generateReport
    if (action.includes("trainingLab") && action.includes("generateReport")) {
      const systemPrompt =
        args.reportType === "full" ? TRAINING_LAB_FULL_PROMPT : TRAINING_LAB_SNAPSHOT_PROMPT;

      // Strip internal chart properties from payload to save tokens
      const {
        _chartVolumeByMuscle,
        _chartVolumeByMuscleOverTime,
        _chartRpeByWorkout,
        _chartExerciseTrends,
        ...geminiPayload
      } = args.payload || {};

      const response = await callOpenRouterGemini({
        systemPrompt,
        userMessage: JSON.stringify(geminiPayload),
        responseFormat: "json",
      });

      const result = JSON.parse(response.text);

      // Reconstruct the response with chart data
      if (args.reportType === "snapshot") {
        const snapshot = {
          type: "snapshot",
          ...result,
          chartData: {
            volumeByMuscle: _chartVolumeByMuscle?.slice(0, 8) ?? [],
          },
        };
        return NextResponse.json(snapshot);
      } else {
        const report = {
          type: "full",
          ...result,
          chartData: {
            volumeByMuscle: _chartVolumeByMuscleOverTime ?? [],
            rpeByWorkout: _chartRpeByWorkout ?? [],
            exerciseTrends: _chartExerciseTrends ?? [],
          },
        };
        return NextResponse.json(report);
      }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
