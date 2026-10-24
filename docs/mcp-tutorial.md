# Connect Claude Code, Codex or Antigravity to Lunatic Design

This takes about five minutes, once. After that, your AI agent can work on the document you have open in Lunatic Design.

## What you need

- Lunatic Design **installed** (the Setup file, `lunaticDesign-Setup-0.4.1.exe`). The portable file works too, but move it once and keep it in the same place: the agent remembers where it is.
- At least one of: **Claude Code**, **Codex** or **Antigravity**, already installed on this computer.
- Windows PowerShell or Command Prompt (press the Start button, type `powershell`, press Enter).

## Step 1: Install Lunatic Design

1. Download `lunaticDesign-Setup-0.4.1.exe` from the Releases page.
2. Run it and finish the installer. It creates the folder **Documents\Lunatic Design**, where your documents are saved by default.
3. Open Lunatic Design once from the Start menu, then close it.

## Step 2: Run the setup command once

Open PowerShell and paste this line exactly (the `&` and the quotes matter):

```
& "C:\Program Files\Lunatic Design\Lunatic Design.exe" --install-mcp
```

If you use Command Prompt (cmd) instead, leave out the `&`: `"C:\Program Files\Lunatic Design\Lunatic Design.exe" --install-mcp`.

**Claude Code only:** you can also register the server with one `claude mcp add` line, using the same path (the `--mcp` flag starts the server):

```
claude mcp add lunatic-design -- "$env:LOCALAPPDATA\Programs\Lunatic Design\Lunatic Design.exe" --mcp
```

This does not touch Codex or Antigravity. Use the `--install-mcp` command above to set up all three.

If you installed for your user only, the path is instead `%LOCALAPPDATA%\Programs\Lunatic Design\Lunatic Design.exe`. If you are not sure, right-click the Lunatic Design shortcut on the desktop, choose **Open file location**, and copy the full path of the `.exe` from the address bar.

You should see something like this:

```
Lunatic Design: connecting AI agents
  Claude Code: written to C:\Users\you\.claude.json
  Codex: written to C:\Users\you\.codex\config.toml
  Antigravity: skipped (not installed)
Restart Claude Code, Codex or Antigravity, then ask it to use the lunatic-design tools.
```

- **written** means the agent's settings now include Lunatic Design.
- **skipped (not installed)** means that agent is not on this computer. Nothing was changed for it.
- **NOT written** means the agent's settings file could not be read or changed. The reason is shown after it. The file is left as it was.

The Windows version of the app does not always print to the terminal, so the same result is also saved to:

```
%APPDATA%\Lunatic Design\install-mcp.log
```

Paste `%APPDATA%\Lunatic Design` into the File Explorer address bar to open it.

Your existing settings and other MCP servers stay as they were. Before any file is changed, a copy named `.bak` is saved next to it.

## Step 3: Restart the agent

Close Claude Code, Codex or Antigravity completely, then open it again.

## Step 4: Check that it works

1. Open **Lunatic Design** and leave it open. The agent can only reach the app while it is running.
2. In the agent, ask in plain language, for example:

   > Use the lunatic-design tools. Tell me which document is open, then add a red circle in the middle of the page.

3. You should see the agent call `get_status`, then `add_shape`. The circle appears in the app within a second. Press **Ctrl+Z** in the app to undo it.

If you ask for the list of tools, you should see `get_status`, `get_document`, `add_shape`, `add_shapes`, `update_shape`, `delete_shapes`, `select_shapes`, `undo`, `redo`, `render_page`, `screenshot`, `new_document`, `save_document`, `open_document` and `list_documents`.

## Connect from inside the app (alternative)

Open **Window → Connect AI agents…** in Lunatic Design. The same command is shown there with a **Copy** button. Paste it into PowerShell.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `'"C:\...\Lunatic Design.exe"' is not recognized` | The path is wrong. Use the steps above to find the real path. |
| The agent says "Lunatic Design is not running" | Open Lunatic Design and keep it open, then ask again. |
| `NOT written` for an agent | That agent's settings file is damaged or locked. Close the agent, then run the command again. The `.bak` file keeps the old version. |
| The agent does not see the tools | Restart the agent. Check that the setup line said **written** for that agent. |
| You moved or renamed the app | Run the setup command again with the new path. It replaces the old entry. |
| You upgraded the app | You do not need to run the command again, unless the install location changed. |

## Remove it

Delete the `lunatic-design` entry:

- **Claude Code:** in `%USERPROFILE%\.claude.json`, delete the `"lunatic-design"` block inside `"mcpServers"`.
- **Codex:** in `%USERPROFILE%\.codex\config.toml`, delete the `[mcp_servers.lunatic-design]` section and the two lines under it.
- **Antigravity:** in its `mcp_config.json`, delete the `"lunatic-design"` block inside `"mcpServers"`.

## What the agent can and cannot do

- It can read the open document, add and change shapes and text, undo, look at the page as a picture, and save or open files **only** in `Documents\Lunatic Design`.
- It asks before it would throw away unsaved work.
- It talks to Lunatic Design only on this computer, through a private connection protected by a secret token that changes every time the app starts.
- It cannot reach other folders or the internet through Lunatic Design.
