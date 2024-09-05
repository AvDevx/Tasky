const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    console.log('Congratulations, your extension "tasky" is now active!');

    // Register the command to open the note manager UI
    const openNoteManagerCommand = vscode.commands.registerCommand('tasky.openNoteManager', function () {
        const panel = vscode.window.createWebviewPanel(
            'noteManager', // Identifies the type of the webview. Used internally
            'Note Manager', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in
            {
                enableScripts: true // Enable scripts in the webview
            }
        );

        // Set the HTML content for the webview
        panel.webview.html = getWebviewContent(context);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                const notesFolderPath = path.join(context.storageUri.fsPath, 'notes');

                switch (message.command) {
                    case 'createNote':
                        const noteContent = message.text;
                        if (noteContent) {
                            if (!fs.existsSync(notesFolderPath)) {
                                fs.mkdirSync(notesFolderPath, { recursive: true });
                            }
                            const noteFilePath = path.join(notesFolderPath, `note-${Date.now()}.txt`);
                            fs.writeFileSync(noteFilePath, noteContent, 'utf8');
                            vscode.window.showInformationMessage('Note created successfully!');
                        }
                        break;
                    case 'deleteNote':
                        const noteToDelete = path.join(notesFolderPath, message.fileName);
                        if (fs.existsSync(noteToDelete)) {
                            fs.unlinkSync(noteToDelete);
                            vscode.window.showInformationMessage(`Note "${message.fileName}" deleted successfully!`);
                        }
                        break;
                    case 'listNotes':
                        if (fs.existsSync(notesFolderPath)) {
                            const files = fs.readdirSync(notesFolderPath);
                            panel.webview.postMessage({ command: 'showNotes', notes: files });
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(openNoteManagerCommand);
}

function getWebviewContent(context) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Note Manager</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                padding: 10px;
            }
            .note-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .note {
                border: 1px solid #ddd;
                padding: 8px;
                border-radius: 4px;
            }
            button {
                padding: 8px 12px;
                background-color: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: #005fa3;
            }
        </style>
    </head>
    <body>
        <h1>Note Manager</h1>
        <div>
            <textarea id="note-input" rows="4" cols="50" placeholder="Type your note here..."></textarea>
            <br/>
            <button onclick="createNote()">Create Note</button>
        </div>
        <hr/>
        <h2>Your Notes</h2>
        <div id="notes-list" class="note-container"></div>

        <script>
            const vscode = acquireVsCodeApi();

            function createNote() {
                const noteContent = document.getElementById('note-input').value;
                vscode.postMessage({ command: 'createNote', text: noteContent });
                document.getElementById('note-input').value = '';
                loadNotes();
            }

            function deleteNote(fileName) {
                vscode.postMessage({ command: 'deleteNote', fileName: fileName });
                loadNotes();
            }

            function loadNotes() {
                vscode.postMessage({ command: 'listNotes' });
            }

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'showNotes') {
                    const notesList = document.getElementById('notes-list');
                    notesList.innerHTML = '';
                    message.notes.forEach(note => {
                        const noteElement = document.createElement('div');
                        noteElement.className = 'note';
                        noteElement.textContent = note;
                        const deleteButton = document.createElement('button');
                        deleteButton.textContent = 'Delete';
                        deleteButton.onclick = () => deleteNote(note);
                        noteElement.appendChild(deleteButton);
                        notesList.appendChild(noteElement);
                    });
                }
            });

            // Load notes when the UI loads
            loadNotes();
        </script>
    </body>
    </html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
