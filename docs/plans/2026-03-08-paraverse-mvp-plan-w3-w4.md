# ParaVerse MVP Plan — Week 3–4

> Continuation of `2026-03-08-paraverse-mvp-plan.md` (Tasks 12–19)

---

## Week 3: Simulation Engines

### Task 12: Agent Service

**Files:**
- Create: `backend/src/services/agentService.ts`
- Create: `backend/src/db/queries/agents.ts`
- Test: `backend/tests/unit/services/agentService.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/agentService.test.ts
import { describe, test, expect } from "bun:test";
import { buildDemographicDistribution } from "../../src/services/agentService";

describe("agentService", () => {
  test("buildDemographicDistribution for fin_sentiment", () => {
    const dist = buildDemographicDistribution("fin_sentiment", 100);
    expect(dist.length).toBe(3);
    // 60% retail, 20% media, 20% institutional
    const retail = dist.find(d => d.group_name === "retail_investor");
    expect(retail).toBeDefined();
    expect(retail!.count).toBe(60);
  });

  test("buildDemographicDistribution for crisis_pr", () => {
    const dist = buildDemographicDistribution("crisis_pr", 100);
    expect(dist.length).toBe(4);
    // 50% consumer, 20% media, 15% loyalist, 15% critic
    const consumer = dist.find(d => d.group_name === "consumer");
    expect(consumer!.count).toBe(50);
  });

  test("counts sum to total agent_count", () => {
    const dist = buildDemographicDistribution("fin_sentiment", 73);
    const total = dist.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(73);
  });
});
```

**Step 2: Implement agentService**

```typescript
// backend/src/db/queries/agents.ts
import { query } from "../client";

export interface AgentRow {
  id: string;
  simulation_id: string;
  name: string;
  persona: string;
  demographics: Record<string, unknown>;
  memory: Record<string, unknown>[];
}

export async function getAgentsBySimulation(simulationId: string) {
  const result = await query<AgentRow>(
    `SELECT id, simulation_id, name, persona, demographics, memory
     FROM agent_profiles WHERE simulation_id = $1`,
    [simulationId]
  );
  return result.rows;
}

export async function getAgentById(id: string) {
  const result = await query<AgentRow>(
    `SELECT * FROM agent_profiles WHERE id = $1`, [id]
  );
  return result.rows[0] || null;
}
```

```typescript
// backend/src/services/agentService.ts
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";
import type { ScenarioType } from "@shared/types/project";

interface DemographicGroup {
  group_name: string;
  count: number;
  percentage: number;
  traits: Record<string, string>;
}

const SCENARIO_DEMOGRAPHICS: Record<string, { group_name: string; percentage: number; traits: Record<string, string> }[]> = {
  fin_sentiment: [
    { group_name: "retail_investor", percentage: 60, traits: { role: "retail investor", subtypes: "conservative,aggressive,impulsive" } },
    { group_name: "media_analyst", percentage: 20, traits: { role: "financial media analyst", subtypes: "bullish,bearish,neutral" } },
    { group_name: "institutional", percentage: 20, traits: { role: "institutional representative", subtypes: "fund_manager,broker,researcher" } },
  ],
  crisis_pr: [
    { group_name: "consumer", percentage: 50, traits: { role: "general consumer" } },
    { group_name: "media_reporter", percentage: 20, traits: { role: "media reporter", behavior: "investigative,sensationalist,factual" } },
    { group_name: "brand_loyalist", percentage: 15, traits: { role: "brand loyalist" } },
    { group_name: "critic", percentage: 15, traits: { role: "brand critic or competitor fan" } },
  ],
  content_lab: [
    { group_name: "hardcore_fan", percentage: 30, traits: { role: "hardcore fan", engagement: "high" } },
    { group_name: "casual_fan", percentage: 40, traits: { role: "casual fan", engagement: "medium" } },
    { group_name: "passerby", percentage: 30, traits: { role: "passerby viewer", engagement: "low" } },
  ],
  policy_lab: [
    { group_name: "supporter", percentage: 35, traits: { role: "policy supporter" } },
    { group_name: "opponent", percentage: 35, traits: { role: "policy opponent" } },
    { group_name: "undecided", percentage: 30, traits: { role: "undecided citizen" } },
  ],
  war_game: [
    { group_name: "domestic_public", percentage: 40, traits: { role: "domestic public" } },
    { group_name: "foreign_public", percentage: 30, traits: { role: "foreign public" } },
    { group_name: "media", percentage: 15, traits: { role: "media institution" } },
    { group_name: "diplomat", percentage: 15, traits: { role: "government/diplomat" } },
  ],
  train_lab: [
    { group_name: "stakeholder", percentage: 50, traits: { role: "stakeholder" } },
    { group_name: "media", percentage: 25, traits: { role: "media" } },
    { group_name: "regulator", percentage: 25, traits: { role: "regulator" } },
  ],
};

export function buildDemographicDistribution(
  scenarioType: string,
  agentCount: number
): DemographicGroup[] {
  const template = SCENARIO_DEMOGRAPHICS[scenarioType];
  if (!template) throw new Error(`Unknown scenario: ${scenarioType}`);

  let remaining = agentCount;
  return template.map((group, i) => {
    const isLast = i === template.length - 1;
    const count = isLast ? remaining : Math.round(agentCount * group.percentage / 100);
    remaining -= count;
    return { ...group, count };
  });
}

const PERSONA_PROMPT = `Generate a realistic persona for a simulated agent. Return JSON:
{
  "name": "realistic name",
  "persona": "2-3 sentence personality description including values, communication style, and decision-making tendency",
  "demographics": {
    "age_range": "20-30|30-40|40-50|50-60|60+",
    "gender": "male|female|non-binary",
    "occupation": "specific job title",
    "personality_type": "brief type description"
  }
}`;

export class AgentService {
  private llm = getLlmService();
  private vectors = getVectorService();

  async generateAgents(params: {
    simulationId: string;
    scenarioType: ScenarioType;
    agentCount: number;
    seedContext: string;
    onProgress?: (progress: number) => void;
  }): Promise<string[]> {
    const { simulationId, scenarioType, agentCount, seedContext, onProgress } = params;
    const distribution = buildDemographicDistribution(scenarioType, agentCount);
    const agentIds: string[] = [];
    let generated = 0;

    for (const group of distribution) {
      // Generate agents in batches of 5
      for (let i = 0; i < group.count; i += 5) {
        const batchSize = Math.min(5, group.count - i);
        const batchPromises = Array.from({ length: batchSize }, () =>
          this.llm.chatJson<{
            name: string;
            persona: string;
            demographics: Record<string, unknown>;
          }>(
            [
              { role: "system", content: PERSONA_PROMPT },
              {
                role: "user",
                content: `Role: ${group.traits.role}\nGroup: ${group.group_name}\nContext: ${seedContext.slice(0, 500)}`,
              },
            ],
            { tier: "general", temperature: 0.9 }
          )
        );

        const results = await Promise.all(batchPromises);
        for (const agent of results) {
          const embedding = await this.llm.embedSingle(agent.persona);
          const id = await this.vectors.upsertAgentProfile({
            simulationId,
            name: agent.name,
            persona: agent.persona,
            embedding,
            demographics: { ...agent.demographics, ...group.traits, group: group.group_name },
          });
          agentIds.push(id);
        }

        generated += batchSize;
        onProgress?.(Math.round((generated / agentCount) * 100));
      }
    }

    logger.info({ simulationId, count: agentIds.length }, "Agents generated");
    return agentIds;
  }
}

let instance: AgentService | null = null;
export function getAgentService(): AgentService {
  if (!instance) instance = new AgentService();
  return instance;
}
```

**Step 3: Run tests**

Run: `cd backend && bun test tests/unit/services/agentService.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/agentService.ts backend/src/db/queries/agents.ts backend/tests/unit/services/agentService.test.ts
git commit -m "feat: add agent service with demographic distribution and persona generation"
```

---

### Task 13: Base IPC Runner infrastructure

**Files:**
- Create: `backend/src/services/runners/baseRunner.ts`
- Test: `backend/tests/unit/services/runners/baseRunner.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/runners/baseRunner.test.ts
import { describe, test, expect } from "bun:test";
import { parseJsonlLine, serializeCommand } from "../../../src/services/runners/baseRunner";

describe("baseRunner", () => {
  test("parseJsonlLine parses valid JSON", () => {
    const result = parseJsonlLine('{"type":"agent_action","tick":1}');
    expect(result).toEqual({ type: "agent_action", tick: 1 });
  });

  test("parseJsonlLine returns null for invalid JSON", () => {
    const result = parseJsonlLine("not json");
    expect(result).toBeNull();
  });

  test("parseJsonlLine returns null for empty string", () => {
    const result = parseJsonlLine("");
    expect(result).toBeNull();
  });

  test("serializeCommand produces valid JSON line", () => {
    const result = serializeCommand({ type: "start_simulation", config: {} });
    expect(result).toBe('{"type":"start_simulation","config":{}}\n');
    expect(JSON.parse(result.trim())).toEqual({ type: "start_simulation", config: {} });
  });
});
```

**Step 2: Implement baseRunner**

```typescript
// backend/src/services/runners/baseRunner.ts
import { logger } from "../../utils/logger";
import type { IpcCommand, IpcEvent } from "@shared/types/simulation";

export function parseJsonlLine(line: string): IpcEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function serializeCommand(cmd: IpcCommand): string {
  return JSON.stringify(cmd) + "\n";
}

export type EventHandler = (event: IpcEvent) => void;

export abstract class BaseRunner {
  protected process: ReturnType<typeof Bun.spawn> | null = null;
  protected eventHandlers: EventHandler[] = [];
  protected stderrBuffer = "";

  abstract get pythonPath(): string;
  abstract get scriptPath(): string;

  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  protected emit(event: IpcEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        logger.error({ err }, "Event handler error");
      }
    }
  }

  async start(simId: string, config: Record<string, unknown>): Promise<void> {
    const maxMemory = parseInt(process.env.SIM_MAX_MEMORY_MB || "2048");

    this.process = Bun.spawn([this.pythonPath, this.scriptPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SIMULATION_ID: simId,
        MAX_MEMORY_MB: String(maxMemory),
      },
    });

    // Read stdout line by line for JSONL events
    this.readStdout();
    this.readStderr();

    // Send start command
    await this.sendCommand({
      type: "start_simulation",
      config,
    } as IpcCommand);

    logger.info({ simId, script: this.scriptPath }, "Simulation process started");
  }

  private async readStdout(): Promise<void> {
    if (!this.process?.stdout) return;

    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const event = parseJsonlLine(line);
          if (event) this.emit(event);
        }
      }
    } catch (err) {
      logger.error({ err }, "stdout read error");
    }
  }

  private async readStderr(): Promise<void> {
    if (!this.process?.stderr) return;

    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        this.stderrBuffer += text;
        logger.warn({ stderr: text.trim() }, "Simulation stderr");
      }
    } catch {
      // Process ended
    }
  }

  async sendCommand(cmd: IpcCommand): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error("Process not running");
    }
    const writer = this.process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(serializeCommand(cmd)));
    writer.releaseLock();
  }

  async stop(reason = "user_request"): Promise<void> {
    if (!this.process) return;

    try {
      await this.sendCommand({ type: "stop_simulation", reason } as IpcCommand);
      // Give process 5s to exit gracefully
      const timeout = setTimeout(() => {
        this.process?.kill();
      }, 5000);

      await this.process.exited;
      clearTimeout(timeout);
    } catch {
      this.process.kill();
    }

    this.process = null;
    this.eventHandlers = [];
    logger.info("Simulation process stopped");
  }

  get isRunning(): boolean {
    return this.process !== null;
  }

  get errors(): string {
    return this.stderrBuffer;
  }
}
```

**Step 3: Run tests**

Run: `cd backend && bun test tests/unit/services/runners/baseRunner.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/runners/baseRunner.ts backend/tests/unit/services/runners/
git commit -m "feat: add base IPC runner with JSONL parsing and subprocess management"
```

---

### Task 14: OASIS Runner + Python scripts

**Files:**
- Create: `backend/src/services/runners/oasisRunner.ts`
- Create: `backend/simulations/oasis/run_oasis_simulation.py`
- Create: `backend/simulations/oasis/oasis_ipc.py`
- Create: `backend/simulations/oasis/agent_factory.py`
- Create: `backend/simulations/oasis/platform_config.py`
- Create: `backend/simulations/oasis/requirements.txt`
- Test: `backend/tests/unit/services/runners/oasisRunner.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/runners/oasisRunner.test.ts
import { describe, test, expect } from "bun:test";
import { OasisRunner } from "../../../src/services/runners/oasisRunner";

describe("OasisRunner", () => {
  test("has correct script path", () => {
    const runner = new OasisRunner();
    expect(runner.scriptPath).toContain("run_oasis_simulation.py");
  });

  test("supports expected commands", () => {
    const runner = new OasisRunner();
    expect(runner.supportedCommands).toContain("start_simulation");
    expect(runner.supportedCommands).toContain("inject_event");
    expect(runner.supportedCommands).toContain("interview_agent");
    expect(runner.supportedCommands).not.toContain("fork_scenario");
  });
});
```

**Step 2: Implement OasisRunner**

```typescript
// backend/src/services/runners/oasisRunner.ts
import { join } from "node:path";
import { BaseRunner } from "./baseRunner";
import type { IpcCommand } from "@shared/types/simulation";

const SUPPORTED_COMMANDS = [
  "start_simulation",
  "inject_event",
  "interview_agent",
  "get_status",
  "stop_simulation",
] as const;

export class OasisRunner extends BaseRunner {
  get pythonPath(): string {
    return process.env.OASIS_PYTHON || join(import.meta.dir, "../../../simulations/oasis/.venv/bin/python");
  }

  get scriptPath(): string {
    return join(import.meta.dir, "../../../simulations/oasis/run_oasis_simulation.py");
  }

  get supportedCommands(): readonly string[] {
    return SUPPORTED_COMMANDS;
  }

  async sendCommand(cmd: IpcCommand): Promise<void> {
    if (!SUPPORTED_COMMANDS.includes(cmd.type as any)) {
      throw new Error(`OASIS does not support command: ${cmd.type}`);
    }
    return super.sendCommand(cmd);
  }
}
```

**Step 3: Create OASIS Python IPC module**

```python
# backend/simulations/oasis/oasis_ipc.py
"""IPC protocol for OASIS simulation engine."""
import sys
import json
from typing import Any, Generator

def read_commands() -> Generator[dict, None, None]:
    """Read JSONL commands from stdin."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            emit_event({"type": "error", "message": f"Invalid command JSON: {e}"})

def emit_event(event: dict[str, Any]) -> None:
    """Write a JSONL event to stdout."""
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def emit_error(message: str) -> None:
    """Emit an error event."""
    emit_event({"type": "error", "message": message})

def emit_status(progress: int, events_count: int) -> None:
    """Emit a status event."""
    emit_event({"type": "status", "progress": progress, "events_count": events_count})
```

**Step 4: Create OASIS agent factory**

```python
# backend/simulations/oasis/agent_factory.py
"""Build OASIS agents from persona JSON configs."""
from typing import Any

def build_oasis_agents(agent_configs: list[dict[str, Any]], model_name: str, api_key: str, base_url: str):
    """
    Convert persona configs to OASIS-compatible agent objects.

    Args:
        agent_configs: List of agent persona dicts with keys: id, name, persona, demographics
        model_name: LLM model name for agent inference
        api_key: API key for the LLM
        base_url: Base URL for the LLM API

    Returns:
        List of configured OASIS agent objects
    """
    try:
        from camel.models import ModelFactory
        from camel.types import ModelPlatformType, ModelType
        from oasis.social_agent import SocialAgent
        from oasis.social_platform.typing import ActionType
    except ImportError as e:
        raise ImportError(f"OASIS dependencies not installed: {e}. Run: pip install camel-ai camel-oasis")

    agents = []
    for config in agent_configs:
        persona_text = (
            f"Name: {config['name']}\n"
            f"Role: {config['demographics'].get('role', 'general user')}\n"
            f"Personality: {config['persona']}\n"
            f"Age: {config['demographics'].get('age_range', '25-45')}\n"
            f"Occupation: {config['demographics'].get('occupation', 'professional')}"
        )

        model = ModelFactory.create(
            model_platform=ModelPlatformType.OPENAI_COMPATIBLE_MODEL,
            model_type=model_name,
            api_key=api_key,
            url=base_url,
        )

        agent = SocialAgent(
            agent_id=config["id"],
            model=model,
            persona=persona_text,
        )
        agents.append(agent)

    return agents
```

**Step 5: Create OASIS platform config**

```python
# backend/simulations/oasis/platform_config.py
"""Platform configuration for OASIS social simulation."""

def create_twitter_platform(num_agents: int):
    """Create a Twitter-like platform environment."""
    try:
        from oasis.social_platform.platform import Platform
        from oasis.social_platform.config import PlatformConfig
    except ImportError as e:
        raise ImportError(f"OASIS not installed: {e}")

    config = PlatformConfig(
        platform_type="twitter",
        num_agents=num_agents,
        recommendation_algorithm="interest_based",
        max_posts_per_tick=5,
        trending_decay_factor=0.95,
    )
    return Platform(config)


def create_reddit_platform(num_agents: int):
    """Create a Reddit-like platform environment."""
    try:
        from oasis.social_platform.platform import Platform
        from oasis.social_platform.config import PlatformConfig
    except ImportError as e:
        raise ImportError(f"OASIS not installed: {e}")

    config = PlatformConfig(
        platform_type="reddit",
        num_agents=num_agents,
        recommendation_algorithm="hot_ranking",
        max_posts_per_tick=3,
    )
    return Platform(config)
```

**Step 6: Create main OASIS simulation script**

```python
# backend/simulations/oasis/run_oasis_simulation.py
"""Main OASIS simulation runner. Communicates with Bun backend via stdin/stdout JSONL."""
import os
import sys
import traceback
from oasis_ipc import read_commands, emit_event, emit_error, emit_status

def run():
    for cmd in read_commands():
        cmd_type = cmd.get("type")

        if cmd_type == "start_simulation":
            try:
                handle_start(cmd.get("config", {}))
            except Exception as e:
                emit_error(f"start_simulation failed: {e}\n{traceback.format_exc()}")

        elif cmd_type == "inject_event":
            try:
                handle_inject(cmd)
            except Exception as e:
                emit_error(f"inject_event failed: {e}")

        elif cmd_type == "interview_agent":
            try:
                handle_interview(cmd)
            except Exception as e:
                emit_error(f"interview_agent failed: {e}")

        elif cmd_type == "get_status":
            handle_status()

        elif cmd_type == "stop_simulation":
            emit_event({"type": "simulation_complete", "stats": get_stats()})
            sys.exit(0)

        else:
            emit_error(f"Unknown command: {cmd_type}")


# Global state
_simulation = None
_agents = []
_events_count = 0
_current_tick = 0
_total_ticks = 0


def handle_start(config: dict):
    global _simulation, _agents, _events_count, _current_tick, _total_ticks

    agent_configs = config.get("agents", [])
    total_ticks = config.get("tick_count", 50)
    platform_type = config.get("platform", "twitter")
    seed_context = config.get("seed_context", "")
    model_name = os.environ.get("LLM_MODEL_GENERAL", "gemini-2.5-flash")
    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "")

    _total_ticks = total_ticks

    try:
        from agent_factory import build_oasis_agents
        from platform_config import create_twitter_platform, create_reddit_platform

        # Build agents
        _agents = build_oasis_agents(agent_configs, model_name, api_key, base_url)

        # Create platform
        if platform_type == "reddit":
            platform = create_reddit_platform(len(_agents))
        else:
            platform = create_twitter_platform(len(_agents))

        # Inject seed context as initial post
        if seed_context:
            emit_event({
                "type": "agent_action",
                "agent_id": "system",
                "action": "seed_post",
                "content": seed_context,
                "tick": 0,
                "metadata": {"source": "seed_context"},
            })

        # Run simulation loop
        from oasis.simulation import Simulation
        _simulation = Simulation(platform=platform, agents=_agents)

        for tick in range(1, total_ticks + 1):
            _current_tick = tick
            tick_events = _simulation.step()

            for event in tick_events:
                _events_count += 1
                emit_event({
                    "type": "agent_action",
                    "agent_id": str(event.agent_id),
                    "action": event.action_type,
                    "content": getattr(event, "content", ""),
                    "tick": tick,
                    "metadata": {
                        "platform": platform_type,
                        "action_details": getattr(event, "details", {}),
                    },
                })

            # Emit progress every 5 ticks
            if tick % 5 == 0:
                emit_status(
                    progress=round(tick / total_ticks * 100),
                    events_count=_events_count,
                )

        # Done
        emit_event({
            "type": "simulation_complete",
            "stats": get_stats(),
        })

    except ImportError as e:
        emit_error(f"OASIS not installed: {e}. Install with: pip install camel-ai camel-oasis")
    except Exception as e:
        emit_error(f"Simulation error: {e}\n{traceback.format_exc()}")


def handle_inject(cmd: dict):
    global _events_count
    if _simulation is None:
        emit_error("No running simulation")
        return

    event_content = cmd.get("content", "")
    tick = cmd.get("tick", _current_tick)

    # Inject as a system post into the platform
    _simulation.inject_post(content=event_content, tick=tick)
    _events_count += 1
    emit_event({
        "type": "agent_action",
        "agent_id": "system",
        "action": "injected_event",
        "content": event_content,
        "tick": tick,
        "metadata": {"injected": True},
    })


def handle_interview(cmd: dict):
    agent_id = cmd.get("agent_id")
    prompt = cmd.get("prompt", "What do you think about the current situation?")

    if not _agents:
        emit_error("No agents available")
        return

    # Find agent
    target = None
    for agent in _agents:
        if str(agent.agent_id) == agent_id:
            target = agent
            break

    if not target:
        emit_error(f"Agent {agent_id} not found")
        return

    try:
        response = target.respond(prompt)
        emit_event({
            "type": "interview_response",
            "agent_id": agent_id,
            "prompt": prompt,
            "response": response,
            "tick": _current_tick,
        })
    except Exception as e:
        emit_error(f"Interview failed: {e}")


def handle_status():
    emit_status(
        progress=round(_current_tick / max(_total_ticks, 1) * 100),
        events_count=_events_count,
    )


def get_stats() -> dict:
    return {
        "total_events": _events_count,
        "ticks": _current_tick,
        "total_ticks": _total_ticks,
        "agent_count": len(_agents),
    }


if __name__ == "__main__":
    run()
```

**Step 7: Create requirements.txt**

```
# backend/simulations/oasis/requirements.txt
camel-ai>=0.2.78
camel-oasis>=0.2.5
openai
```

**Step 8: Run unit tests**

Run: `cd backend && bun test tests/unit/services/runners/oasisRunner.test.ts`
Expected: PASS

**Step 9: Set up Python venv with uv**

```bash
# Install uv first if not present
curl -LsSf https://astral.sh/uv/install.sh | sh
cd backend/simulations/oasis
uv venv
uv pip install -r requirements.txt
```

**Step 10: Commit**

```bash
git add backend/src/services/runners/oasisRunner.ts backend/simulations/oasis/ backend/tests/unit/services/runners/oasisRunner.test.ts
git commit -m "feat: add OASIS runner with IPC and Python simulation scripts"
```

---

### Task 15: Concordia Runner + Python scripts

**Files:**
- Create: `backend/src/services/runners/concordiaRunner.ts`
- Create: `backend/simulations/concordia/run_concordia_sim.py`
- Create: `backend/simulations/concordia/concordia_ipc.py`
- Create: `backend/simulations/concordia/agent_factory.py`
- Create: `backend/simulations/concordia/game_masters/base_gm.py`
- Create: `backend/simulations/concordia/game_masters/crisis_pr_gm.py`
- Create: `backend/simulations/concordia/requirements.txt`
- Test: `backend/tests/unit/services/runners/concordiaRunner.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/runners/concordiaRunner.test.ts
import { describe, test, expect } from "bun:test";
import { ConcordiaRunner } from "../../../src/services/runners/concordiaRunner";

describe("ConcordiaRunner", () => {
  test("has correct script path", () => {
    const runner = new ConcordiaRunner();
    expect(runner.scriptPath).toContain("run_concordia_sim.py");
  });

  test("supports all commands including Concordia-specific", () => {
    const runner = new ConcordiaRunner();
    expect(runner.supportedCommands).toContain("start_simulation");
    expect(runner.supportedCommands).toContain("fork_scenario");
    expect(runner.supportedCommands).toContain("save_checkpoint");
    expect(runner.supportedCommands).toContain("load_checkpoint");
    expect(runner.supportedCommands).toContain("inject_manual_action");
    expect(runner.supportedCommands).toContain("set_grounded_var");
  });
});
```

**Step 2: Implement ConcordiaRunner**

```typescript
// backend/src/services/runners/concordiaRunner.ts
import { join } from "node:path";
import { BaseRunner } from "./baseRunner";
import type { IpcCommand } from "@shared/types/simulation";

const SUPPORTED_COMMANDS = [
  "start_simulation",
  "inject_event",
  "interview_agent",
  "get_status",
  "stop_simulation",
  "save_checkpoint",
  "load_checkpoint",
  "inject_manual_action",
  "set_grounded_var",
  "fork_scenario",
] as const;

export class ConcordiaRunner extends BaseRunner {
  get pythonPath(): string {
    return process.env.CONCORDIA_PYTHON || join(import.meta.dir, "../../../simulations/concordia/.venv/bin/python");
  }

  get scriptPath(): string {
    return join(import.meta.dir, "../../../simulations/concordia/run_concordia_sim.py");
  }

  get supportedCommands(): readonly string[] {
    return SUPPORTED_COMMANDS;
  }

  async forkScenario(label: string, overrides: Record<string, unknown>): Promise<void> {
    return this.sendCommand({
      type: "fork_scenario",
      label,
      overrides,
    } as unknown as IpcCommand);
  }

  async saveCheckpoint(path: string): Promise<void> {
    return this.sendCommand({
      type: "save_checkpoint",
      checkpoint_path: path,
    } as unknown as IpcCommand);
  }

  async loadCheckpoint(path: string): Promise<void> {
    return this.sendCommand({
      type: "load_checkpoint",
      checkpoint_path: path,
    } as unknown as IpcCommand);
  }

  async injectManualAction(actorId: string, actionText: string): Promise<void> {
    return this.sendCommand({
      type: "inject_manual_action",
      actor_id: actorId,
      action_text: actionText,
    } as unknown as IpcCommand);
  }

  async setGroundedVar(varName: string, value: number): Promise<void> {
    return this.sendCommand({
      type: "set_grounded_var",
      var_name: varName,
      value,
    } as unknown as IpcCommand);
  }
}
```

**Step 3: Create Concordia Python IPC module**

```python
# backend/simulations/concordia/concordia_ipc.py
"""IPC protocol for Concordia simulation engine with checkpoint support."""
import sys
import json
import pickle
from pathlib import Path
from typing import Any, Generator

def read_commands() -> Generator[dict, None, None]:
    """Read JSONL commands from stdin."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            emit_event({"type": "error", "message": f"Invalid command JSON: {e}"})

def emit_event(event: dict[str, Any]) -> None:
    """Write a JSONL event to stdout."""
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()

def emit_error(message: str) -> None:
    emit_event({"type": "error", "message": message})

def emit_status(progress: int, events_count: int) -> None:
    emit_event({"type": "status", "progress": progress, "events_count": events_count})

def save_checkpoint(state: Any, path: str) -> None:
    """Serialize simulation state to disk."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "wb") as f:
        pickle.dump(state, f)
    emit_event({"type": "checkpoint_saved", "path": path})

def load_checkpoint(path: str) -> Any:
    """Deserialize simulation state from disk."""
    with open(path, "rb") as f:
        state = pickle.load(f)
    emit_event({"type": "checkpoint_loaded", "path": path})
    return state
```

**Step 4: Create Concordia agent factory**

```python
# backend/simulations/concordia/agent_factory.py
"""Build Concordia agents with Components."""
from typing import Any

def build_concordia_agents(agent_configs: list[dict[str, Any]], model, clock):
    """
    Convert persona configs into Concordia EntityAgent objects.
    """
    try:
        from concordia.agents import entity_agent
        from concordia.components.agent import (
            observation,
            action_spec_ignored,
        )
    except ImportError as e:
        raise ImportError(f"Concordia not installed: {e}")

    agents = []
    for config in agent_configs:
        agent_name = config["name"]
        persona = config["persona"]
        demographics = config.get("demographics", {})

        # Build agent with observation and action components
        agent = entity_agent.EntityAgent(
            agent_name=agent_name,
            act_component=action_spec_ignored.ActionSpecIgnored(model=model),
            context_components={
                "persona": _create_persona_component(persona, demographics),
                "observation": observation.Observation(
                    agent_name=agent_name,
                    clock_now=clock.now,
                    memory=None,
                ),
            },
        )
        agent._config_id = config["id"]
        agents.append(agent)

    return agents


def _create_persona_component(persona: str, demographics: dict):
    """Create a simple persona context component."""
    from concordia.components.agent import constant

    role = demographics.get("role", "participant")
    persona_text = (
        f"You are playing the role of a {role}.\n"
        f"Your personality: {persona}\n"
        f"Background: {', '.join(f'{k}: {v}' for k, v in demographics.items() if k != 'role')}"
    )
    return constant.Constant(state=persona_text)
```

**Step 5: Create base Game Master**

```python
# backend/simulations/concordia/game_masters/base_gm.py
"""Base Game Master utilities for Concordia simulations."""
from typing import Any
from concordia_ipc import emit_event, emit_error


class BaseGameMaster:
    """Base class for scenario-specific Game Masters."""

    def __init__(self, model, agents: list, grounded_vars: dict[str, float] | None = None):
        self.model = model
        self.agents = agents
        self.grounded_vars = grounded_vars or {}
        self.branches: dict[str, dict] = {}
        self.events_count = 0
        self.current_tick = 0

    def set_grounded_var(self, name: str, value: float):
        self.grounded_vars[name] = value
        emit_event({
            "type": "grounded_var",
            "var_name": name,
            "value": value,
            "tick": self.current_tick,
        })

    def get_grounded_var(self, name: str, default: float = 0.0) -> float:
        return self.grounded_vars.get(name, default)

    def fork_scenario(self, label: str, override_vars: dict):
        """Create a scenario branch with different variable overrides."""
        self.branches[label] = {
            "label": label,
            "override_vars": override_vars,
            "grounded_vars": {**self.grounded_vars, **{k: float(v) for k, v in override_vars.items() if isinstance(v, (int, float))}},
        }
        emit_event({
            "type": "branch_update",
            "branch_id": label,
            "summary": f"Branch {label} created with overrides: {override_vars}",
            "tick": self.current_tick,
        })

    def emit_agent_action(self, agent_id: str, action: str, content: str, metadata: dict | None = None):
        self.events_count += 1
        emit_event({
            "type": "agent_action",
            "agent_id": agent_id,
            "action": action,
            "content": content,
            "tick": self.current_tick,
            "metadata": metadata or {},
        })

    def get_state(self) -> dict:
        """Return serializable state for checkpoint."""
        return {
            "grounded_vars": self.grounded_vars,
            "branches": self.branches,
            "events_count": self.events_count,
            "current_tick": self.current_tick,
        }

    def load_state(self, state: dict):
        """Restore state from checkpoint."""
        self.grounded_vars = state.get("grounded_vars", {})
        self.branches = state.get("branches", {})
        self.events_count = state.get("events_count", 0)
        self.current_tick = state.get("current_tick", 0)
```

**Step 6: Create Crisis PR Game Master**

```python
# backend/simulations/concordia/game_masters/crisis_pr_gm.py
"""Crisis PR Game Master for CrisisSimulator scenario."""
from base_gm import BaseGameMaster
from concordia_ipc import emit_event


class CrisisPrGameMaster(BaseGameMaster):
    """
    Game Master for crisis public relations simulation.
    Manages brand_reputation_score and A/B/C strategy branches.
    """

    def __init__(self, model, agents, crisis_context: str = ""):
        super().__init__(model, agents, grounded_vars={
            "brand_reputation_score": 75.0,
            "media_pressure": 0.0,
            "public_anger": 0.0,
        })
        self.crisis_context = crisis_context

    def evaluate_round(self, tick: int, branch_label: str | None = None):
        """
        Evaluate the current round and update grounded variables.
        Called after each tick of agent actions.
        """
        self.current_tick = tick

        # Use the GM's LLM to evaluate sentiment shift
        prompt = self._build_evaluation_prompt(branch_label)

        try:
            from openai import OpenAI
            import os
            import json

            client = OpenAI(
                api_key=os.environ.get("LLM_API_KEY", ""),
                base_url=os.environ.get("LLM_BASE_URL", ""),
            )

            response = client.chat.completions.create(
                model=os.environ.get("LLM_MODEL_BOOST", "gemini-2.5-flash"),
                messages=[
                    {"role": "system", "content": "You are a crisis PR analyst. Evaluate the current state and return JSON with updated metrics."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )

            metrics = json.loads(response.choices[0].message.content)
            rep_delta = metrics.get("reputation_delta", 0)
            media_pressure = metrics.get("media_pressure", self.get_grounded_var("media_pressure"))
            public_anger = metrics.get("public_anger", self.get_grounded_var("public_anger"))

            new_rep = max(0, min(100, self.get_grounded_var("brand_reputation_score") + rep_delta))
            self.set_grounded_var("brand_reputation_score", new_rep)
            self.set_grounded_var("media_pressure", media_pressure)
            self.set_grounded_var("public_anger", public_anger)

        except Exception as e:
            emit_event({"type": "error", "message": f"GM evaluation failed: {e}"})

    def _build_evaluation_prompt(self, branch_label: str | None) -> str:
        branch_info = f"\nCurrent branch: {branch_label}" if branch_label else ""
        return (
            f"Crisis context: {self.crisis_context}\n"
            f"Current tick: {self.current_tick}\n"
            f"Brand reputation: {self.get_grounded_var('brand_reputation_score'):.1f}/100\n"
            f"Media pressure: {self.get_grounded_var('media_pressure'):.1f}\n"
            f"Public anger: {self.get_grounded_var('public_anger'):.1f}\n"
            f"{branch_info}\n\n"
            f"Based on the agents' recent actions, return JSON:\n"
            f'{{"reputation_delta": <-10 to +5 float>, "media_pressure": <0-100 float>, "public_anger": <0-100 float>}}'
        )

    def run_branch(self, label: str, response_statement: str, ticks: int):
        """Run a scenario branch with a specific crisis response strategy."""
        branch = self.branches.get(label)
        if not branch:
            self.fork_scenario(label, {"response_statement": response_statement})
            branch = self.branches[label]

        # Save pre-branch vars
        saved_vars = {**self.grounded_vars}

        # Apply branch overrides
        for k, v in branch["override_vars"].items():
            if isinstance(v, (int, float)):
                self.set_grounded_var(k, float(v))

        # Inject crisis response as system event
        self.emit_agent_action(
            agent_id="brand",
            action="public_statement",
            content=response_statement,
            metadata={"branch": label},
        )

        # Run branch ticks
        for t in range(ticks):
            self.current_tick += 1
            self.evaluate_round(self.current_tick, branch_label=label)

            emit_event({
                "type": "branch_update",
                "branch_id": label,
                "summary": f"Tick {self.current_tick}: rep={self.get_grounded_var('brand_reputation_score'):.1f}",
                "tick": self.current_tick,
                "grounded_vars": {**self.grounded_vars},
            })

        # Restore pre-branch vars for next branch
        self.grounded_vars = saved_vars
```

**Step 7: Create main Concordia simulation script**

```python
# backend/simulations/concordia/run_concordia_sim.py
"""Main Concordia simulation runner."""
import os
import sys
import traceback

# Add current dir to path for local imports
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "game_masters"))

from concordia_ipc import read_commands, emit_event, emit_error, emit_status, save_checkpoint, load_checkpoint

# Global state
_gm = None
_agents = []
_events_count = 0
_current_tick = 0
_total_ticks = 0
_checkpoint_state = None


def run():
    for cmd in read_commands():
        cmd_type = cmd.get("type")
        try:
            if cmd_type == "start_simulation":
                handle_start(cmd.get("config", {}))
            elif cmd_type == "inject_event":
                handle_inject(cmd)
            elif cmd_type == "interview_agent":
                handle_interview(cmd)
            elif cmd_type == "get_status":
                handle_status()
            elif cmd_type == "stop_simulation":
                emit_event({"type": "simulation_complete", "stats": get_stats()})
                sys.exit(0)
            elif cmd_type == "save_checkpoint":
                handle_save_checkpoint(cmd)
            elif cmd_type == "load_checkpoint":
                handle_load_checkpoint(cmd)
            elif cmd_type == "fork_scenario":
                handle_fork(cmd)
            elif cmd_type == "inject_manual_action":
                handle_manual_action(cmd)
            elif cmd_type == "set_grounded_var":
                handle_set_var(cmd)
            else:
                emit_error(f"Unknown command: {cmd_type}")
        except Exception as e:
            emit_error(f"{cmd_type} failed: {e}\n{traceback.format_exc()}")


def handle_start(config: dict):
    global _gm, _agents, _total_ticks, _current_tick, _events_count

    agent_configs = config.get("agents", [])
    _total_ticks = config.get("tick_count", 50)
    scenario_type = config.get("scenario_type", "crisis_pr")
    seed_context = config.get("seed_context", "")
    branches_config = config.get("branches", [])

    model_name = os.environ.get("LLM_MODEL_BOOST", "gemini-2.5-flash")
    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "")

    try:
        from openai import OpenAI

        model = OpenAI(api_key=api_key, base_url=base_url)

        # Build agents
        from agent_factory import build_concordia_agents

        class SimpleClock:
            def __init__(self):
                self._tick = 0
            def now(self):
                return self._tick
            def advance(self):
                self._tick += 1

        clock = SimpleClock()

        _agents = build_concordia_agents(agent_configs, model, clock)

        # Create scenario-specific GM
        if scenario_type == "crisis_pr":
            from crisis_pr_gm import CrisisPrGameMaster
            _gm = CrisisPrGameMaster(model=model, agents=_agents, crisis_context=seed_context)
        else:
            from base_gm import BaseGameMaster
            _gm = BaseGameMaster(model=model, agents=_agents)

        # Handle A/B/C branches for crisis_pr
        if branches_config and scenario_type == "crisis_pr":
            ticks_per_branch = _total_ticks // max(len(branches_config), 1)

            for branch in branches_config:
                label = branch.get("label", "A")
                description = branch.get("description", "")
                _gm.run_branch(label, description, ticks_per_branch)

            emit_event({"type": "simulation_complete", "stats": get_stats()})
        else:
            # Simple sequential simulation
            for tick in range(1, _total_ticks + 1):
                _current_tick = tick
                clock.advance()
                _gm.current_tick = tick
                _gm.evaluate_round(tick)

                if tick % 5 == 0:
                    emit_status(round(tick / _total_ticks * 100), _gm.events_count)

            emit_event({"type": "simulation_complete", "stats": get_stats()})

    except ImportError as e:
        emit_error(f"Concordia not installed: {e}")
    except Exception as e:
        emit_error(f"Simulation error: {e}\n{traceback.format_exc()}")


def handle_inject(cmd: dict):
    if _gm is None:
        emit_error("No running simulation")
        return
    content = cmd.get("content", "")
    _gm.emit_agent_action("system", "injected_event", content, {"injected": True})


def handle_interview(cmd: dict):
    agent_id = cmd.get("agent_id")
    prompt = cmd.get("prompt", "What is your perspective?")

    if not _agents:
        emit_error("No agents available")
        return

    target = None
    for a in _agents:
        if getattr(a, "_config_id", None) == agent_id:
            target = a
            break

    if not target:
        emit_error(f"Agent {agent_id} not found")
        return

    try:
        response = target.act()
        emit_event({
            "type": "interview_response",
            "agent_id": agent_id,
            "prompt": prompt,
            "response": str(response),
            "tick": _current_tick,
        })
    except Exception as e:
        emit_error(f"Interview failed: {e}")


def handle_status():
    emit_status(
        round(_current_tick / max(_total_ticks, 1) * 100),
        _gm.events_count if _gm else 0,
    )


def handle_save_checkpoint(cmd: dict):
    if _gm is None:
        emit_error("No simulation to checkpoint")
        return
    path = cmd.get("checkpoint_path", f"/tmp/paraverse_checkpoint_{_current_tick}.pkl")
    state = {"gm_state": _gm.get_state(), "tick": _current_tick}
    save_checkpoint(state, path)


def handle_load_checkpoint(cmd: dict):
    global _current_tick
    path = cmd.get("checkpoint_path")
    if not path:
        emit_error("No checkpoint path provided")
        return
    state = load_checkpoint(path)
    if _gm:
        _gm.load_state(state.get("gm_state", {}))
    _current_tick = state.get("tick", 0)


def handle_fork(cmd: dict):
    if _gm is None:
        emit_error("No running simulation")
        return
    label = cmd.get("label", "A")
    overrides = cmd.get("overrides", {})
    _gm.fork_scenario(label, overrides)


def handle_manual_action(cmd: dict):
    if _gm is None:
        emit_error("No running simulation")
        return
    actor_id = cmd.get("actor_id", "human")
    action_text = cmd.get("action_text", "")
    _gm.emit_agent_action(actor_id, "manual_action", action_text, {"source": "human"})


def handle_set_var(cmd: dict):
    if _gm is None:
        emit_error("No running simulation")
        return
    var_name = cmd.get("var_name")
    value = cmd.get("value", 0)
    _gm.set_grounded_var(var_name, float(value))


def get_stats() -> dict:
    return {
        "total_events": _gm.events_count if _gm else 0,
        "ticks": _current_tick,
        "total_ticks": _total_ticks,
        "agent_count": len(_agents),
        "grounded_vars": _gm.grounded_vars if _gm else {},
        "branches": list(_gm.branches.keys()) if _gm else [],
    }


if __name__ == "__main__":
    run()
```

**Step 8: Create requirements.txt**

```
# backend/simulations/concordia/requirements.txt
gdm-concordia>=2.0.0
openai
```

**Step 9: Run tests**

Run: `cd backend && bun test tests/unit/services/runners/concordiaRunner.test.ts`
Expected: PASS

**Step 10: Set up Concordia Python venv**

```bash
cd backend/simulations/concordia
uv venv
uv pip install -r requirements.txt
```

**Step 11: Commit**

```bash
git add backend/src/services/runners/concordiaRunner.ts backend/simulations/concordia/ backend/tests/unit/services/runners/concordiaRunner.test.ts
git commit -m "feat: add Concordia runner with IPC, checkpoint, fork, and Crisis PR Game Master"
```

---

### Task 16: Simulation Service (engine router)

**Files:**
- Create: `backend/src/services/simulationService.ts`
- Create: `backend/src/db/queries/simulations.ts`
- Test: `backend/tests/unit/services/simulationService.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/simulationService.test.ts
import { describe, test, expect } from "bun:test";
import { resolveEngine } from "../../src/services/simulationService";

describe("simulationService", () => {
  test("resolveEngine routes fin_sentiment to oasis", () => {
    expect(resolveEngine("fin_sentiment")).toBe("oasis");
  });

  test("resolveEngine routes content_lab to oasis", () => {
    expect(resolveEngine("content_lab")).toBe("oasis");
  });

  test("resolveEngine routes crisis_pr to concordia", () => {
    expect(resolveEngine("crisis_pr")).toBe("concordia");
  });

  test("resolveEngine routes policy_lab to concordia", () => {
    expect(resolveEngine("policy_lab")).toBe("concordia");
  });

  test("resolveEngine routes war_game to concordia", () => {
    expect(resolveEngine("war_game")).toBe("concordia");
  });

  test("resolveEngine routes train_lab to concordia", () => {
    expect(resolveEngine("train_lab")).toBe("concordia");
  });

  test("resolveEngine throws for unknown type", () => {
    expect(() => resolveEngine("unknown" as any)).toThrow();
  });
});
```

**Step 2: Implement simulation queries**

```typescript
// backend/src/db/queries/simulations.ts
import { query } from "../client";

export interface SimulationRow {
  id: string;
  project_id: string;
  engine: string;
  status: string;
  config: Record<string, unknown>;
  checkpoint_path: string | null;
  grounded_vars: Record<string, number>;
  stats: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function createSimulation(
  projectId: string,
  engine: string,
  config: Record<string, unknown>
) {
  const result = await query<SimulationRow>(
    `INSERT INTO simulations (project_id, engine, config) VALUES ($1, $2, $3) RETURNING *`,
    [projectId, engine, JSON.stringify(config)]
  );
  return result.rows[0];
}

export async function getSimulation(id: string) {
  const result = await query<SimulationRow>(`SELECT * FROM simulations WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function updateSimulationStatus(
  id: string,
  status: string,
  extra?: { stats?: Record<string, unknown>; checkpoint_path?: string; grounded_vars?: Record<string, number> }
) {
  const sets = ["status = $2"];
  const params: unknown[] = [id, status];
  let i = 3;

  if (status === "running") sets.push(`started_at = NOW()`);
  if (status === "completed" || status === "failed") sets.push(`completed_at = NOW()`);
  if (extra?.stats) { sets.push(`stats = $${i++}`); params.push(JSON.stringify(extra.stats)); }
  if (extra?.checkpoint_path) { sets.push(`checkpoint_path = $${i++}`); params.push(extra.checkpoint_path); }
  if (extra?.grounded_vars) { sets.push(`grounded_vars = $${i++}`); params.push(JSON.stringify(extra.grounded_vars)); }

  await query(`UPDATE simulations SET ${sets.join(", ")} WHERE id = $1`, params);
}

export async function getSimulationEvents(simulationId: string, limit = 100, offset = 0) {
  const result = await query(
    `SELECT * FROM simulation_events WHERE simulation_id = $1 ORDER BY sim_timestamp, id LIMIT $2 OFFSET $3`,
    [simulationId, limit, offset]
  );
  return result.rows;
}

export async function insertSimulationEvent(event: {
  simulation_id: string;
  branch_id?: string;
  agent_id?: string;
  event_type: string;
  platform?: string;
  content?: string;
  sim_timestamp: number;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO simulation_events (simulation_id, branch_id, agent_id, event_type, platform, content, sim_timestamp, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.simulation_id, event.branch_id || null, event.agent_id || null,
      event.event_type, event.platform || null, event.content || null,
      event.sim_timestamp, JSON.stringify(event.metadata || {}),
    ]
  );
}

export async function createScenarioBranch(simulationId: string, label: string, description: string, overrideVars: Record<string, unknown>) {
  const result = await query(
    `INSERT INTO scenario_branches (simulation_id, branch_label, description, override_vars) VALUES ($1, $2, $3, $4) RETURNING *`,
    [simulationId, label, description, JSON.stringify(overrideVars)]
  );
  return result.rows[0];
}
```

**Step 3: Implement SimulationService**

```typescript
// backend/src/services/simulationService.ts
import { OasisRunner } from "./runners/oasisRunner";
import { ConcordiaRunner } from "./runners/concordiaRunner";
import type { BaseRunner } from "./runners/baseRunner";
import { ENGINE_MAP, type ScenarioType, type EngineType } from "@shared/types/project";
import {
  createSimulation,
  getSimulation,
  updateSimulationStatus,
  insertSimulationEvent,
  createScenarioBranch,
} from "../db/queries/simulations";
import { getAgentsBySimulation } from "../db/queries/agents";
import { getTaskManager, TaskType } from "../utils/taskManager";
import { logger } from "../utils/logger";

export function resolveEngine(scenarioType: ScenarioType): EngineType {
  const engine = ENGINE_MAP[scenarioType];
  if (!engine) throw new Error(`Unknown scenario type: ${scenarioType}`);
  return engine;
}

export class SimulationService {
  private activeRunners: Map<string, BaseRunner> = new Map();

  private createRunner(engine: EngineType): BaseRunner {
    return engine === "oasis" ? new OasisRunner() : new ConcordiaRunner();
  }

  async create(projectId: string, scenarioType: ScenarioType, config: Record<string, unknown>) {
    const engine = resolveEngine(scenarioType);
    return createSimulation(projectId, engine, { ...config, scenario_type: scenarioType });
  }

  async start(simId: string, ownerId: string): Promise<string> {
    const sim = await getSimulation(simId);
    if (!sim) throw new Error("Simulation not found");
    if (sim.status !== "pending" && sim.status !== "configuring") {
      throw new Error(`Cannot start simulation in status: ${sim.status}`);
    }

    const engine = sim.engine as EngineType;
    const runner = this.createRunner(engine);

    // Get agents for this simulation
    const agents = await getAgentsBySimulation(simId);

    // Create async task
    const taskManager = getTaskManager();
    const task = await taskManager.create(TaskType.SIMULATION, simId, ownerId);

    // Set up event handler
    runner.onEvent(async (event) => {
      try {
        if (event.type === "agent_action" || event.type === "branch_update") {
          await insertSimulationEvent({
            simulation_id: simId,
            agent_id: (event as any).agent_id,
            event_type: event.type,
            content: (event as any).content,
            sim_timestamp: (event as any).tick || 0,
            metadata: event,
          });
        }

        if (event.type === "status") {
          await taskManager.progress(task.id, (event as any).progress || 0);
        }

        if (event.type === "grounded_var") {
          const vars = { ...sim.grounded_vars, [(event as any).var_name]: (event as any).value };
          await updateSimulationStatus(simId, "running", { grounded_vars: vars });
        }

        if (event.type === "simulation_complete") {
          await updateSimulationStatus(simId, "completed", { stats: (event as any).stats });
          await taskManager.complete(task.id, (event as any).stats);
          this.activeRunners.delete(simId);
        }

        if (event.type === "error") {
          logger.error({ simId, error: (event as any).message }, "Simulation error event");
        }
      } catch (err) {
        logger.error({ err, simId }, "Event handler DB error");
      }
    });

    // Store runner
    this.activeRunners.set(simId, runner);

    // Update status and start
    await updateSimulationStatus(simId, "running");
    await taskManager.start(task.id);

    const config = {
      ...sim.config,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        persona: a.persona,
        demographics: a.demographics,
      })),
    };

    runner.start(simId, config).catch(async (err) => {
      logger.error({ err, simId }, "Simulation start failed");
      await updateSimulationStatus(simId, "failed");
      await taskManager.fail(task.id, String(err));
      this.activeRunners.delete(simId);
    });

    return task.id;
  }

  async stop(simId: string): Promise<void> {
    const runner = this.activeRunners.get(simId);
    if (runner) {
      await runner.stop();
      this.activeRunners.delete(simId);
    }
    await updateSimulationStatus(simId, "completed");
  }

  async forkScenario(simId: string, label: string, description: string, overrides: Record<string, unknown>) {
    const runner = this.activeRunners.get(simId);
    if (!runner || !(runner instanceof ConcordiaRunner)) {
      throw new Error("Fork only supported for running Concordia simulations");
    }
    await createScenarioBranch(simId, label, description, overrides);
    await runner.forkScenario(label, overrides);
  }

  async saveCheckpoint(simId: string, path: string) {
    const runner = this.activeRunners.get(simId);
    if (!runner || !(runner instanceof ConcordiaRunner)) {
      throw new Error("Checkpoint only supported for Concordia simulations");
    }
    await runner.saveCheckpoint(path);
    await updateSimulationStatus(simId, "running", { checkpoint_path: path });
  }

  async injectManualAction(simId: string, actorId: string, actionText: string) {
    const runner = this.activeRunners.get(simId);
    if (!runner || !(runner instanceof ConcordiaRunner)) {
      throw new Error("Manual action only supported for Concordia simulations");
    }
    await runner.injectManualAction(actorId, actionText);
  }

  getRunner(simId: string): BaseRunner | undefined {
    return this.activeRunners.get(simId);
  }
}

let instance: SimulationService | null = null;
export function getSimulationService(): SimulationService {
  if (!instance) instance = new SimulationService();
  return instance;
}
```

**Step 4: Run tests**

Run: `cd backend && bun test tests/unit/services/simulationService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/simulationService.ts backend/src/db/queries/simulations.ts backend/tests/unit/services/simulationService.test.ts
git commit -m "feat: add simulation service with dual-engine routing and event persistence"
```

---

## Week 4: Report Service + API Routes

### Task 17: Report Service (ReACT loop)

**Files:**
- Create: `backend/src/services/reportService.ts`
- Create: `backend/src/db/queries/reports.ts`
- Test: `backend/tests/unit/services/reportService.test.ts`

**Step 1: Write failing test**

```typescript
// backend/tests/unit/services/reportService.test.ts
import { describe, test, expect } from "bun:test";
import { buildReportOutline } from "../../src/services/reportService";

describe("reportService", () => {
  test("buildReportOutline returns sections for fin_sentiment", () => {
    const outline = buildReportOutline("fin_sentiment");
    expect(outline.length).toBeGreaterThan(3);
    expect(outline[0].title).toBeDefined();
  });

  test("buildReportOutline returns sections for crisis_pr", () => {
    const outline = buildReportOutline("crisis_pr");
    expect(outline.length).toBeGreaterThan(3);
    // crisis_pr should have strategy comparison section
    const hasComparison = outline.some(s => s.title.toLowerCase().includes("comparison") || s.title.toLowerCase().includes("strategy"));
    expect(hasComparison).toBe(true);
  });
});
```

**Step 2: Implement report queries**

```typescript
// backend/src/db/queries/reports.ts
import { query } from "../client";

export async function insertReportSection(
  simulationId: string,
  sectionOrder: number,
  title: string,
  content: string,
  toolCalls: Record<string, unknown>[] = []
) {
  const result = await query(
    `INSERT INTO report_sections (simulation_id, section_order, title, content, tool_calls)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [simulationId, sectionOrder, title, content, JSON.stringify(toolCalls)]
  );
  return result.rows[0];
}

export async function getReportSections(simulationId: string) {
  const result = await query(
    `SELECT * FROM report_sections WHERE simulation_id = $1 ORDER BY section_order`,
    [simulationId]
  );
  return result.rows;
}

export async function deleteReportSections(simulationId: string) {
  await query(`DELETE FROM report_sections WHERE simulation_id = $1`, [simulationId]);
}
```

**Step 3: Implement ReportService**

```typescript
// backend/src/services/reportService.ts
import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { getSimulationEvents, getSimulation } from "../db/queries/simulations";
import { getAgentsBySimulation } from "../db/queries/agents";
import { insertReportSection, deleteReportSections } from "../db/queries/reports";
import { getTaskManager, TaskType } from "../utils/taskManager";
import { logger } from "../utils/logger";

interface ReportOutlineSection {
  title: string;
  prompt: string;
  tools: string[];
}

const BASE_OUTLINE: ReportOutlineSection[] = [
  { title: "Executive Summary", prompt: "Write a concise executive summary of the simulation results.", tools: ["events_summary"] },
  { title: "Methodology", prompt: "Describe the simulation methodology, agent composition, and parameters.", tools: ["agent_summary"] },
  { title: "Key Findings", prompt: "Analyze the key findings from the simulation events.", tools: ["events_analysis", "vector_search"] },
  { title: "Sentiment Analysis", prompt: "Provide sentiment distribution analysis over time.", tools: ["sentiment_timeline"] },
  { title: "Recommendations", prompt: "Based on the findings, provide actionable recommendations.", tools: [] },
];

const CRISIS_PR_EXTRA: ReportOutlineSection[] = [
  { title: "Strategy Comparison", prompt: "Compare the A/B/C crisis response strategies and their outcomes.", tools: ["branch_comparison"] },
  { title: "Reputation Recovery Curve", prompt: "Analyze the brand reputation recovery trajectory for each strategy.", tools: ["grounded_vars_timeline"] },
];

export function buildReportOutline(scenarioType: string): ReportOutlineSection[] {
  const outline = [...BASE_OUTLINE];
  if (scenarioType === "crisis_pr") {
    // Insert crisis-specific sections before recommendations
    outline.splice(-1, 0, ...CRISIS_PR_EXTRA);
  }
  return outline;
}

export class ReportService {
  private llm = getLlmService();
  private vectors = getVectorService();

  async generateReport(simulationId: string, ownerId: string): Promise<string> {
    const taskManager = getTaskManager();
    const task = await taskManager.create(TaskType.REPORT_GENERATE, simulationId, ownerId);

    // Run async
    this.doGenerate(simulationId, task.id).catch(async (err) => {
      logger.error({ err, simulationId }, "Report generation failed");
      await taskManager.fail(task.id, String(err));
    });

    return task.id;
  }

  private async doGenerate(simulationId: string, taskId: string): Promise<void> {
    const taskManager = getTaskManager();
    await taskManager.start(taskId);

    const sim = await getSimulation(simulationId);
    if (!sim) throw new Error("Simulation not found");

    const scenarioType = (sim.config as any).scenario_type || "fin_sentiment";
    const outline = buildReportOutline(scenarioType);

    // Clear existing sections
    await deleteReportSections(simulationId);

    // Gather context
    const events = await getSimulationEvents(simulationId, 500);
    const agents = await getAgentsBySimulation(simulationId);

    const contextSummary = this.buildContextSummary(sim, events, agents);

    for (let i = 0; i < outline.length; i++) {
      const section = outline[i];

      // ReACT: Use tools to gather section-specific data
      const toolResults = await this.executeTools(section.tools, simulationId, events, agents, sim);

      const sectionContent = await this.llm.chat(
        [
          {
            role: "system",
            content: `You are a professional analyst writing a simulation report section. Write in clear, professional language. Use data from the provided context.`,
          },
          {
            role: "user",
            content: `${section.prompt}\n\nSimulation Context:\n${contextSummary}\n\nTool Results:\n${toolResults}`,
          },
        ],
        { tier: "boost", temperature: 0.3, maxTokens: 2000 }
      );

      await insertReportSection(simulationId, i, section.title, sectionContent, []);
      await taskManager.progress(taskId, Math.round(((i + 1) / outline.length) * 100));
    }

    await taskManager.complete(taskId, { sections: outline.length });
  }

  private buildContextSummary(sim: any, events: any[], agents: any[]): string {
    return [
      `Simulation engine: ${sim.engine}`,
      `Status: ${sim.status}`,
      `Agent count: ${agents.length}`,
      `Event count: ${events.length}`,
      `Config: ${JSON.stringify(sim.config).slice(0, 500)}`,
      `Stats: ${JSON.stringify(sim.stats)}`,
      `Grounded variables: ${JSON.stringify(sim.grounded_vars)}`,
    ].join("\n");
  }

  private async executeTools(
    tools: string[],
    simulationId: string,
    events: any[],
    agents: any[],
    sim: any
  ): Promise<string> {
    const results: string[] = [];

    for (const tool of tools) {
      switch (tool) {
        case "events_summary": {
          const summary = events.slice(0, 50).map((e: any) =>
            `[tick ${e.sim_timestamp}] ${e.event_type}: ${(e.content || "").slice(0, 100)}`
          ).join("\n");
          results.push(`Events Summary (first 50):\n${summary}`);
          break;
        }
        case "agent_summary": {
          const summary = agents.map((a: any) =>
            `- ${a.name} (${a.demographics?.group || "unknown"}): ${a.persona?.slice(0, 80)}`
          ).join("\n");
          results.push(`Agents:\n${summary}`);
          break;
        }
        case "events_analysis": {
          const typeCounts: Record<string, number> = {};
          for (const e of events) {
            typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
          }
          results.push(`Event type distribution: ${JSON.stringify(typeCounts)}`);
          break;
        }
        case "sentiment_timeline": {
          // Group events by tick and estimate sentiment
          const byTick: Record<number, number> = {};
          for (const e of events) {
            byTick[e.sim_timestamp] = (byTick[e.sim_timestamp] || 0) + 1;
          }
          results.push(`Events per tick: ${JSON.stringify(byTick)}`);
          break;
        }
        case "branch_comparison": {
          const branches = events
            .filter((e: any) => e.event_type === "branch_update")
            .map((e: any) => `[${e.metadata?.branch_id}] tick ${e.sim_timestamp}: ${e.content?.slice(0, 100)}`)
            .join("\n");
          results.push(`Branch updates:\n${branches}`);
          break;
        }
        case "grounded_vars_timeline": {
          const vars = events
            .filter((e: any) => e.event_type === "grounded_var")
            .map((e: any) => `tick ${e.sim_timestamp}: ${e.metadata?.var_name}=${e.metadata?.value}`)
            .join("\n");
          results.push(`Grounded variable changes:\n${vars}`);
          break;
        }
        case "vector_search": {
          // Search for relevant context
          results.push(`Simulation grounded vars: ${JSON.stringify(sim.grounded_vars)}`);
          break;
        }
      }
    }

    return results.join("\n\n");
  }
}

let instance: ReportService | null = null;
export function getReportService(): ReportService {
  if (!instance) instance = new ReportService();
  return instance;
}
```

**Step 4: Run tests**

Run: `cd backend && bun test tests/unit/services/reportService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/reportService.ts backend/src/db/queries/reports.ts backend/tests/unit/services/reportService.test.ts
git commit -m "feat: add report service with ReACT loop and scenario-specific outlines"
```

---

### Task 18: REST API Routes (projects, graph, simulation, report, tasks)

**Files:**
- Create: `backend/src/routes/projects.ts`
- Create: `backend/src/routes/graph.ts`
- Create: `backend/src/routes/simulation.ts`
- Create: `backend/src/routes/report.ts`
- Create: `backend/src/routes/tasks.ts`
- Create: `backend/src/db/queries/projects.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/tests/integration/routes/projects.test.ts`

**Step 1: Create project queries**

```typescript
// backend/src/db/queries/projects.ts
import { query } from "../client";

export interface ProjectRow {
  id: string;
  name: string;
  scenario_type: string;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export async function createProject(name: string, scenarioType: string, ownerId: string, settings?: Record<string, unknown>) {
  const result = await query<ProjectRow>(
    `INSERT INTO projects (name, scenario_type, owner_id, settings) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, scenarioType, ownerId, JSON.stringify(settings || {})]
  );
  return result.rows[0];
}

export async function getProjectsByOwner(ownerId: string, limit = 20, cursor?: string) {
  const params: unknown[] = [ownerId, limit + 1];
  let where = "WHERE owner_id = $1";
  if (cursor) {
    where += ` AND created_at < $3`;
    params.push(cursor);
  }
  const result = await query<ProjectRow>(
    `SELECT * FROM projects ${where} ORDER BY created_at DESC LIMIT $2`,
    params
  );
  const hasMore = result.rows.length > limit;
  const data = hasMore ? result.rows.slice(0, limit) : result.rows;
  return { data, has_more: hasMore, next_cursor: data[data.length - 1]?.created_at };
}

export async function getProject(id: string, ownerId: string) {
  const result = await query<ProjectRow>(
    `SELECT * FROM projects WHERE id = $1 AND owner_id = $2`, [id, ownerId]
  );
  return result.rows[0] || null;
}

export async function deleteProject(id: string, ownerId: string) {
  const result = await query(`DELETE FROM projects WHERE id = $1 AND owner_id = $2`, [id, ownerId]);
  return (result.rowCount || 0) > 0;
}
```

**Step 2: Create route files**

```typescript
// backend/src/routes/projects.ts
import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { createProject, getProjectsByOwner, getProject, deleteProject } from "../db/queries/projects";
import type { ApiResponse } from "@shared/types/api";

const projects = new Hono();
projects.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  scenario_type: z.enum(["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"]),
  settings: z.record(z.unknown()).optional(),
});

projects.post("/", async (c) => {
  const auth: AuthContext = c.get("auth");
  const body = await c.req.json();
  const input = createSchema.parse(body);
  const project = await createProject(input.name, input.scenario_type, auth.userId, input.settings);
  return c.json({ success: true, data: project, error: null } satisfies ApiResponse, 201);
});

projects.get("/", async (c) => {
  const auth: AuthContext = c.get("auth");
  const cursor = c.req.query("cursor");
  const limit = parseInt(c.req.query("limit") || "20");
  const result = await getProjectsByOwner(auth.userId, limit, cursor);
  return c.json({ success: true, data: result.data, error: null, meta: { cursor: result.next_cursor, has_more: result.has_more } } satisfies ApiResponse);
});

projects.get("/:id", async (c) => {
  const auth: AuthContext = c.get("auth");
  const project = await getProject(c.req.param("id"), auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ success: true, data: project, error: null } satisfies ApiResponse);
});

projects.delete("/:id", async (c) => {
  const auth: AuthContext = c.get("auth");
  const deleted = await deleteProject(c.req.param("id"), auth.userId);
  if (!deleted) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ success: true, data: { deleted: true }, error: null } satisfies ApiResponse);
});

export { projects };
```

```typescript
// backend/src/routes/graph.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getProject } from "../db/queries/projects";
import { getDocumentService } from "../services/documentService";
import { getGraphService } from "../services/graphService";
import { getTaskManager, TaskType } from "../utils/taskManager";
import { query } from "../db/client";

const graph = new Hono();
graph.use("*", authMiddleware);

graph.post("/:projectId/documents", async (c) => {
  const auth: AuthContext = c.get("auth");
  const projectId = c.req.param("projectId");
  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  if (!file) throw new HTTPException(400, { message: "No file provided" });

  const buffer = Buffer.from(await file.arrayBuffer());
  const taskManager = getTaskManager();
  const task = await taskManager.create(TaskType.DOCUMENT_PROCESS, projectId, auth.userId);

  // Process async
  const docService = getDocumentService();
  docService.processDocument({
    projectId,
    filename: file.name,
    buffer,
    onProgress: (p) => taskManager.progress(task.id, p),
  }).then((result) => taskManager.complete(task.id, result))
    .catch((err) => taskManager.fail(task.id, String(err)));

  return c.json({ success: true, data: { task_id: task.id }, error: null }, 202);
});

graph.post("/:projectId/graph/build", async (c) => {
  const auth: AuthContext = c.get("auth");
  const projectId = c.req.param("projectId");
  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const taskManager = getTaskManager();
  const task = await taskManager.create(TaskType.GRAPH_BUILD, projectId, auth.userId);

  // Get document chunks
  const docs = await query("SELECT content FROM documents WHERE project_id = $1 ORDER BY chunk_index", [projectId]);
  const chunks = docs.rows.map((r: any) => r.content);

  const graphService = getGraphService();
  graphService.extractOntology(projectId, chunks, (p) => taskManager.progress(task.id, p))
    .then((result) => taskManager.complete(task.id, result))
    .catch((err) => taskManager.fail(task.id, String(err)));

  return c.json({ success: true, data: { task_id: task.id }, error: null }, 202);
});

graph.get("/:projectId/graph", async (c) => {
  const auth: AuthContext = c.get("auth");
  const projectId = c.req.param("projectId");
  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const graphService = getGraphService();
  const graphData = await graphService.getGraph(projectId);
  return c.json({ success: true, data: graphData, error: null });
});

graph.post("/:projectId/graph/search", async (c) => {
  const auth: AuthContext = c.get("auth");
  const projectId = c.req.param("projectId");
  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const { query: searchQuery } = await c.req.json();
  const graphService = getGraphService();
  const results = await graphService.searchGraph(projectId, searchQuery);
  return c.json({ success: true, data: results, error: null });
});

export { graph };
```

```typescript
// backend/src/routes/simulation.ts
import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getProject } from "../db/queries/projects";
import { getSimulation, getSimulationEvents } from "../db/queries/simulations";
import { getSimulationService, resolveEngine } from "../services/simulationService";
import { getAgentService } from "../services/agentService";
import type { ScenarioType } from "@shared/types/project";

const simulation = new Hono();
simulation.use("*", authMiddleware);

const createSchema = z.object({
  project_id: z.string().uuid(),
  agent_count: z.number().int().min(5).max(1000).default(50),
  tick_count: z.number().int().min(5).max(500).default(50),
  seed_context: z.string().default(""),
  platform: z.enum(["twitter", "reddit"]).optional(),
  branches: z.array(z.object({
    label: z.string(),
    description: z.string(),
    override_vars: z.record(z.unknown()),
  })).optional(),
});

simulation.post("/", async (c) => {
  const auth: AuthContext = c.get("auth");
  const body = await c.req.json();
  const input = createSchema.parse(body);

  const project = await getProject(input.project_id, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const simService = getSimulationService();
  const sim = await simService.create(input.project_id, project.scenario_type as ScenarioType, input);

  // Generate agents
  const agentService = getAgentService();
  await agentService.generateAgents({
    simulationId: sim.id,
    scenarioType: project.scenario_type as ScenarioType,
    agentCount: input.agent_count,
    seedContext: input.seed_context,
  });

  return c.json({ success: true, data: sim, error: null }, 201);
});

simulation.post("/:id/start", async (c) => {
  const auth: AuthContext = c.get("auth");
  const simId = c.req.param("id");
  const simService = getSimulationService();
  const taskId = await simService.start(simId, auth.userId);
  return c.json({ success: true, data: { task_id: taskId }, error: null }, 202);
});

simulation.get("/:id/status", async (c) => {
  const sim = await getSimulation(c.req.param("id"));
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });
  return c.json({ success: true, data: { status: sim.status, stats: sim.stats, grounded_vars: sim.grounded_vars }, error: null });
});

simulation.get("/:id/events", async (c) => {
  const simId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");
  const events = await getSimulationEvents(simId, limit, offset);
  return c.json({ success: true, data: events, error: null });
});

simulation.post("/:id/interview", async (c) => {
  const simId = c.req.param("id");
  const { agent_id, prompt } = await c.req.json();
  const simService = getSimulationService();
  const runner = simService.getRunner(simId);
  if (!runner) throw new HTTPException(400, { message: "Simulation not running" });
  await runner.sendCommand({ type: "interview_agent", agent_id, prompt });
  return c.json({ success: true, data: { sent: true }, error: null });
});

// Concordia-only endpoints
simulation.post("/:id/fork", async (c) => {
  const { label, description, override_vars } = await c.req.json();
  const simService = getSimulationService();
  await simService.forkScenario(c.req.param("id"), label, description, override_vars);
  return c.json({ success: true, data: { forked: true }, error: null });
});

simulation.post("/:id/checkpoint", async (c) => {
  const { path } = await c.req.json();
  const simService = getSimulationService();
  await simService.saveCheckpoint(c.req.param("id"), path);
  return c.json({ success: true, data: { saved: true }, error: null });
});

simulation.post("/:id/manual-action", async (c) => {
  const { actor_id, action_text } = await c.req.json();
  const simService = getSimulationService();
  await simService.injectManualAction(c.req.param("id"), actor_id, action_text);
  return c.json({ success: true, data: { injected: true }, error: null });
});

export { simulation };
```

```typescript
// backend/src/routes/report.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getReportService } from "../services/reportService";
import { getReportSections } from "../db/queries/reports";

const report = new Hono();
report.use("*", authMiddleware);

report.post("/:simulationId/report", async (c) => {
  const auth: AuthContext = c.get("auth");
  const simulationId = c.req.param("simulationId");
  const reportService = getReportService();
  const taskId = await reportService.generateReport(simulationId, auth.userId);
  return c.json({ success: true, data: { task_id: taskId }, error: null }, 202);
});

report.get("/:simulationId/report", async (c) => {
  const simulationId = c.req.param("simulationId");
  const sections = await getReportSections(simulationId);
  if (sections.length === 0) throw new HTTPException(404, { message: "Report not found" });
  return c.json({ success: true, data: { sections }, error: null });
});

export { report };
```

```typescript
// backend/src/routes/tasks.ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { getTaskManager } from "../utils/taskManager";

const tasks = new Hono();
tasks.use("*", authMiddleware);

tasks.get("/:id/status", async (c) => {
  const taskManager = getTaskManager();
  const task = await taskManager.get(c.req.param("id"));
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  return c.json({ success: true, data: task, error: null });
});

export { tasks };
```

**Step 3: Update index.ts to mount all routes**

```typescript
// backend/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/errorHandler";
import { auth } from "./routes/auth";
import { projects } from "./routes/projects";
import { graph } from "./routes/graph";
import { simulation } from "./routes/simulation";
import { report } from "./routes/report";
import { tasks } from "./routes/tasks";

const app = new Hono();

app.use("*", errorHandler);
app.use("*", cors());
app.use("*", honoLogger());

app.get("/health", (c) => c.json({ status: "ok" }));

const api = new Hono();
api.route("/auth", auth);
api.route("/projects", projects);
api.route("/projects", graph);
api.route("/simulations", simulation);
api.route("/simulations", report);
api.route("/tasks", tasks);

app.route("/api/v1", api);

const port = parseInt(process.env.PORT || "5001");
console.log(`ParaVerse API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

**Step 4: Write integration test for projects**

```typescript
// backend/tests/integration/routes/projects.test.ts
import { describe, test, expect, beforeAll } from "bun:test";
import app from "../../../src/index";
import { runMigrations } from "../../../src/db/migrate";
import { query } from "../../../src/db/client";

let accessToken: string;

describe("projects routes", () => {
  beforeAll(async () => {
    await runMigrations();
    await query("DELETE FROM projects");
    await query("DELETE FROM users");

    // Register and get token
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "proj-test@test.com", password: "password123", name: "Test" }),
    });
    const body = await res.json();
    accessToken = body.data.access_token;
  });

  test("POST /projects creates project", async () => {
    const res = await app.request("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: "Test Project", scenario_type: "fin_sentiment" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("Test Project");
    expect(body.data.scenario_type).toBe("fin_sentiment");
  });

  test("GET /projects lists owner projects", async () => {
    const res = await app.request("/api/v1/projects", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("GET /projects requires auth", async () => {
    const res = await app.request("/api/v1/projects");
    expect(res.status).toBe(401);
  });
});
```

**Step 5: Run tests**

Run: `cd backend && bun test tests/integration/routes/projects.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/routes/ backend/src/db/queries/projects.ts backend/tests/integration/
git commit -m "feat: add REST API routes for projects, graph, simulation, report, and tasks"
```

---

### Task 19: Rate limiting middleware

**Files:**
- Create: `backend/src/middleware/rateLimit.ts`

**Step 1: Implement rate limiter**

```typescript
// backend/src/middleware/rateLimit.ts
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return redis;
}

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix?: string }) {
  return async (c: Context, next: Next) => {
    const key = `${opts.keyPrefix || "rl"}:${c.get("auth")?.userId || c.req.header("x-forwarded-for") || "anon"}`;

    try {
      const r = getRedis();
      const current = await r.incr(key);
      if (current === 1) {
        await r.pexpire(key, opts.windowMs);
      }
      if (current > opts.max) {
        throw new HTTPException(429, { message: "Too many requests" });
      }
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      // If Redis is down, allow request
    }

    await next();
  };
}
```

**Step 2: Commit**

```bash
git add backend/src/middleware/rateLimit.ts
git commit -m "feat: add Redis-based rate limiting middleware"
```
