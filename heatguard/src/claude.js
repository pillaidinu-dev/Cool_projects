// Shared Claude tool-use loop for HeatGuard's agents.

import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.HEATGUARD_MODEL || 'claude-opus-5-5';

export function claudeAvailable() {
  if (process.env.HEATGUARD_AGENT === 'rules') return false;
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client;
const getClient = () => (client ??= new Anthropic());

/**
 * Run a tool-use conversation until Claude stops calling tools.
 * `runTool(name, input)` returns a JSON-serialisable result or throws (sent back as an error
 * result so Claude can correct itself). Returns Claude's final text.
 */
export async function runToolLoop({ system, tools, prompt, runTool, maxTurns = 8, effort = 'medium' }) {
  const messages = [{ role: 'user', content: prompt }];
  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the model declines, the API retries on a fallback model
      output_config: { effort },
      system,
      tools,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Model declined (${response.stop_details?.category ?? 'no category'})`);
    }
    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return response.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    }

    const results = [];
    for (const tu of toolUses) {
      try {
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(await runTool(tu.name, tu.input)) });
      } catch (err) {
        results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: err.message });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  return null; // ran out of turns
}
