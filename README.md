# Tasky

Tasky is a lightweight VS Code extension for managing daily tasks and notes efficiently. It allows you to create, open, and manage notes stored in JSON files, complete with customizable checklist items.

## Features

- **Create Notes**: Add new notes with titles, descriptions, and a default checklist item (`What's for today?`).
- **Open Notes**: View and update existing notes in a Webview interface.
- **Checklist Management**:
  - Mark tasks as completed.
  - Edit checklist items.
  - Add new items or remove empty ones automatically.
- **Daily Note Tracking**: Automatically creates a new entry for the current date if not already present.


---

## Requirements

- **Node.js**: Required for running the extension and managing dependencies.
- **VS Code**: Version 1.50 or higher.

---

## Extension Settings

This extension does not introduce new VS Code settings. However, your notes are stored in the `globalStorageUri` directory within your VS Code user data folder.

---

## Known Issues

- No functionality to delete an entire note file yet (can be done manually by deleting the JSON file).
- Limited styling in the Webview (future updates may enhance this).

---

## Release Notes

### 1.0.0

- Initial release.
- Features:
  - Create and open notes.
  - Add, edit, and toggle checklist items.
  - Auto-remove empty items on blur.
  - Daily note tracking with date-based entries.

---

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy using Tasky for your daily task management!**
