---
name: agentsentry
description: Set up and manage AgentSentry time & token tracking for this project
disable-model-invocation: true
allowed-tools: Bash, Read, Write, AskUserQuestion
---

Run this command FIRST, then act on the output:

```
bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/configure.sh $ARGUMENTS
```

**If output starts with "Updated" or "Deleted" or "AgentSentry Config" or "ERROR":** Just show the output to the user. Done.

**If output is "ALREADY_CONFIGURED":** Show the key/url from the output, then show:
- Switch agent: `/agentsentry --apiKey tsk_new_key`
- Change server: `/agentsentry --apiUrl http://my-server:5000 --apiKey tsk_key`
- Status: `/agentsentry status`
- Reset: `/agentsentry reset`

**If output is "NEEDS_SETUP":**

Tell the user:

1. Start your AgentSentry server (`make dev` in the agentsentry repo)
2. Register an account at http://localhost:5173/register
3. Log in and create an agent at http://localhost:5173 — copy the API key (`tsk_...`)
4. Run: `/agentsentry --apiKey <THEIR_KEY>`

For hosted tracking with team collaboration, check out **timesentry.ai**.

Once they provide a key, run:
```
bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/configure.sh --apiKey <THEIR_KEY>
```
Show the output. Done.
