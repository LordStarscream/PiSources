# PiSources

Pi package bundling development environment skills and web search extensions for the [Pi](https://github.com/pi-dev/pi) coding agent.

## Contents

### Skills

| Skill | Purpose |
|-------|---------|
| `dev-env` | Developer workflow: session recovery, task lists, 7-phase development process, git operations, cwd-first search |
| `web-bash` | Bash commands for quick web lookups: DuckDuckGo, StackOverflow API, Wikipedia, GitHub raw, markdown fetcher |
| `spec-to-app` | Generates complete tested applications from specification documents (15-phase workflow) |

### Extensions

| Extension | Purpose |
|-----------|---------|
| `web-search` | Formal web search tools: `web_search`, `fetch_url`, `fetch_many` for multi-source research |
| `safety-guard` | Blocks dangerous bash commands via event interception |

## Quick Start

### Install

```bash
cd /home/mario/Projects/PiSources
pi install ./
```

### Verify

```bash
pi list  # verify installation
```

### Usage

```bash
pi           # launches agent with skills loaded
/skill:dev-env   # load dev-env skill manually
```

## Architecture

```
PiSources/
├── package.json                    # Pi package manifest
├── extensions/
│   ├── safety-guard/               # Dangerous command blocking
│   └── web-search/                 # Formal web search tools
├── skills/
│   ├── dev-env/                    # Development workflow & behavior
│   ├── web-bash/                   # Bash web command patterns
│   └── spec-to-app/                # Spec-driven app generation
└── .pi/                            # Session state (gitignored)
    ├── TASK_LIST.md                # Current task breakdown
    └── MEMORY.md                   # Project context & decisions
```

## Skill Responsibilities

- **dev-env**: "Wie arbeite ich?" — Session recovery, task management, 7-phase workflow, search strategy
- **web-bash**: "Wie suche ich im Web?" — Bash one-liners for quick lookups
- **spec-to-app**: "Wie generiere ich eine App aus einer Spec?" — Full-stack spec-driven development

## Installation Paths

| Purpose | Location |
|---------|----------|
| Project source of truth | `PiSources/skills/`, `PiSources/extensions/` |
| Global (system-wide) | `~/.pi/agent/skills/`, `~/.pi/agent/extensions/` |
| Local test copy | `PiSources/.pi/skills/`, `PiSources/.pi/extensions/` |

Copy skills to global or local test dirs for testing:
```bash
cp -r skills .pi/
```

## License

Private — owned by [LordStarscream](https://github.com/LordStarscream)
