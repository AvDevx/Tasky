const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, your extension "tasky" is now active!');

    // Define the directory for storing JSON files
    const notesDir = path.join(context.globalStorageUri.fsPath, 'notes');
    if (!fs.existsSync(notesDir)) {
        fs.mkdirSync(notesDir, { recursive: true });
    }

    // Command to add a new note
    const addNoteCommand = vscode.commands.registerCommand('tasky.addNote', async function () {
        try {
            const noteTitle = await vscode.window.showInputBox({
                prompt: 'Enter the note title (this will also be the filename)',
                validateInput: (input) => {
                    return input.trim() === '' ? 'Note title cannot be empty' : null;
                }
            });

            if (!noteTitle) return;

            const noteDescription = await vscode.window.showInputBox({
                prompt: 'Enter the note description',
                validateInput: (input) => {
                    return input.trim() === '' ? 'Note description cannot be empty' : null;
                }
            });

            if (!noteDescription) return;

            const noteFilePath = path.join(notesDir, `${noteTitle}.json`);

            // Check if the file already exists
            if (fs.existsSync(noteFilePath)) {
                vscode.window.showErrorMessage(`A note with the filename "${noteTitle}.json" already exists.`);
                return;
            }

            const newNote = {
                id: uuidv4(),
                title: noteTitle,
                description: noteDescription,
                notes: [
                    {
                        date: new Date().toISOString().split('T')[0], // Only the date part
                        items: [
                            {
                                text: "What's for today?",
                                completed: false,
                                added_at: new Date().toISOString(),
                                closed_at: null
                            }
                        ]
                    }
                ]
            };

            // Save the note to a new JSON file
            fs.writeFileSync(noteFilePath, JSON.stringify(newNote, null, 2), 'utf8');

            openNotesWebview(context, newNote, noteTitle);
        } catch (error) {
            vscode.window.showErrorMessage(`An error occurred while adding a note: ${error.message}`);
        }
    });

    // Command to open an existing note
    const openNoteCommand = vscode.commands.registerCommand('tasky.openNote', async function () {
        try {
            const noteFiles = fs.readdirSync(notesDir).filter(file => file.endsWith('.json'));

            if (noteFiles.length === 0) {
                vscode.window.showInformationMessage('No notes found. Please create a note first.');
                return;
            }

            const selectedNoteFile = await vscode.window.showQuickPick(noteFiles, {
                placeHolder: 'Select a note to open'
            });

            if (!selectedNoteFile) return;

            const noteFilePath = path.join(notesDir, selectedNoteFile);
            const noteData = JSON.parse(fs.readFileSync(noteFilePath, 'utf8'));

            // Check if the last note entry is today's date, otherwise add a new entry
            const todayDate = new Date().toISOString().split('T')[0]; // Format to YYYY-MM-DD
            const lastNote = noteData.notes[noteData.notes.length - 1];

            if (!lastNote || lastNote.date !== todayDate) {
                const newNoteEntry = {
                    date: todayDate,
                    items: [
                        {
                            text: "What's for today?",
                            completed: false,
                            added_at: new Date().toISOString(),
                            closed_at: null
                        }
                    ]
                };
                noteData.notes.push(newNoteEntry);

                // Save the updated notes back to the JSON file
                fs.writeFileSync(noteFilePath, JSON.stringify(noteData, null, 2), 'utf8');
            }

            openNotesWebview(context, noteData, path.basename(selectedNoteFile, '.json'));
        } catch (error) {
            vscode.window.showErrorMessage(`An error occurred while opening a note: ${error.message}`);
        }
    });

    context.subscriptions.push(addNoteCommand);
    context.subscriptions.push(openNoteCommand);
}

// Function to open a note in a Webview
function openNotesWebview(context, noteData, noteTitle) {
    const panel = vscode.window.createWebviewPanel(
        'noteManager',
        `Note Manager - ${noteTitle}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    // Generate the HTML content for the Webview
    panel.webview.html = getWebviewContent(noteData);

    // Handle messages from the Webview
    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'toggleComplete':
                toggleItemCompletion(noteData, message.noteIndex, message.itemIndex);
                saveNoteData(context, noteData, noteTitle);
                panel.webview.html = getWebviewContent(noteData); // Refresh the view
                break;
            case 'editItem':
                editItem(noteData, message.noteIndex, message.itemIndex, message.newText);
                saveNoteData(context, noteData, noteTitle);
                break;
            case 'addItem':
                addItem(noteData, message.noteIndex);
                saveNoteData(context, noteData, noteTitle);
                panel.webview.html = getWebviewContent(noteData); // Refresh the view
                break;
        }
    });
}

// Function to toggle completion status of a checklist item
function toggleItemCompletion(noteData, noteIndex, itemIndex) {
    const item = noteData.notes[noteIndex].items[itemIndex];
    item.completed = !item.completed;
    item.closed_at = item.completed ? new Date().toISOString() : null;
}

// Function to edit the text of a checklist item
function editItem(noteData, noteIndex, itemIndex, newText) {
    const item = noteData.notes[noteIndex].items[itemIndex];
    item.text = newText;
}

// Function to add a new checklist item
function addItem(noteData, noteIndex) {
    const newItem = {
        text: '',
        completed: false,
        added_at: new Date().toISOString(),
        closed_at: null
    };
    noteData.notes[noteIndex].items.push(newItem);
}

// Function to save note data back to its JSON file
function saveNoteData(context, noteData, noteTitle) {
    const noteFilePath = path.join(context.globalStorageUri.fsPath, 'notes', `${noteTitle}.json`);
    fs.writeFileSync(noteFilePath, JSON.stringify(noteData, null, 2), 'utf8');
}

// Function to generate HTML content for the Webview
function getWebviewContent(noteData) {
    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    let notesHtml = noteData.notes.map((note, noteIndex) => `
        <h3>${formatDate(note.date)}</h3>
        <ul>
            ${note.items.map((item, itemIndex) => `
                <li style="display: flex; flex-direction: column; align-items: flex-start;">
                    <input type="checkbox" ${item.completed ? 'checked' : ''} 
                        onchange="toggleComplete(${noteIndex}, ${itemIndex})" 
                        style="margin-right: 8px; margin-bottom: 4px;"> 
                    <textarea 
                        oninput="autoResize(this)" 
                        onblur="editItem(${noteIndex}, ${itemIndex}, this.value)" 
                        style="width: 100%; height: auto; resize: none; overflow: hidden; background: transparent; border: none; outline: none; color: white; margin-bottom: 4px;">
                        ${item.text}
                    </textarea>
                    <div style="color: gray;">
                        ${item.added_at ? `Added: ${formatDate(item.added_at)}<br>` : ''}
                        ${item.closed_at ? `Closed: ${formatDate(item.closed_at)}` : ''}
                    </div>
                </li>
            `).join('')}
        </ul>
        <button onclick="addItem(${noteIndex})">+ Add Item</button>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Note Manager</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 10px; }
            h1 { font-size: 1.5em; }
            p { font-size: 1em; color: #666; }
            h3 { margin-top: 20px; font-size: 1.2em; }
            ul { list-style-type: none; padding: 0; }
            li { margin-bottom: 5px; display: flex; flex-direction: column; align-items: flex-start; }
            textarea { 
                width: 100%; 
                height: auto; 
                resize: none; 
                overflow: hidden; 
                background: transparent; 
                border: none; 
                outline: none; 
                font-family: inherit;
                font-size: inherit;
                padding: 5px;
                color: white; /* Text color */
                margin-bottom: 4px;
            }
            button {
                margin-top: 10px;
                padding: 5px 10px;
                border: none;
                background-color: #007acc;
                color: white;
                cursor: pointer;
                font-size: 14px;
            }
            button:hover {
                background-color: #005f99;
            }
        </style>
    </head>
    <body>
        <h1>${noteData.title}</h1>
        <p>${noteData.description}</p>
        ${notesHtml}
        <script>
            const vscode = acquireVsCodeApi();

            function toggleComplete(noteIndex, itemIndex) {
                vscode.postMessage({
                    command: 'toggleComplete',
                    noteIndex: noteIndex,
                    itemIndex: itemIndex
                });
            }

            function editItem(noteIndex, itemIndex, newText) {
                vscode.postMessage({
                    command: 'editItem',
                    noteIndex: noteIndex,
                    itemIndex: itemIndex,
                    newText: newText.trim()
                });
            }

            function addItem(noteIndex) {
                vscode.postMessage({
                    command: 'addItem',
                    noteIndex: noteIndex
                });
            }

            function autoResize(textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = (textarea.scrollHeight) + 'px';
            }
        </script>
    </body>
    </html>
    `;
}

// Deactivate function (optional, typically empty)
function deactivate() {}

module.exports = {
    activate,
    deactivate
};
