const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, your extension "tasky" is now active!');

    // Register the command "addNote"
    const addNoteCommand = vscode.commands.registerCommand('tasky.addNote', async function () {
        // Prompt the user for the note name
        const noteName = await vscode.window.showInputBox({
            prompt: 'Enter the note name',
            validateInput: (input) => {
                // Validate that the note name is not empty
                return input.trim() === '' ? 'Note name cannot be empty' : null;
            }
        });

        // If no note name was provided, exit the function
        if (!noteName) {
            return;
        }

        // Define the folder for storing notes
        const notesFolderPath = path.join(context.globalStorageUri.fsPath, 'notes');

        // Ensure the notes folder exists
        if (!fs.existsSync(notesFolderPath)) {
            fs.mkdirSync(notesFolderPath, { recursive: true });
        }

        // Define the path for the new note file
        const noteFilePath = path.join(notesFolderPath, `${noteName}.txt`);

        // Check if a note with the same name already exists
        if (fs.existsSync(noteFilePath)) {
            vscode.window.showErrorMessage(`A note with the name "${noteName}" already exists.`);
            return;
        }

        // Create the new note file
        fs.writeFileSync(noteFilePath, '', 'utf8');
        vscode.window.showInformationMessage(`Note "${noteName}" created successfully!`);

        // Open the newly created note in the editor
        const document = await vscode.workspace.openTextDocument(noteFilePath);
        await vscode.window.showTextDocument(document);
    });

    // Register the command "openNote"
    const openNoteCommand = vscode.commands.registerCommand('tasky.openNote', async function () {
        // Define the folder for storing notes
        const notesFolderPath = path.join(context.globalStorageUri.fsPath, 'notes');

        // Check if the notes folder exists
        if (!fs.existsSync(notesFolderPath)) {
            vscode.window.showInformationMessage('No notes found. Please create a note first.');
            return;
        }

        // Read all note files from the notes folder
        const noteFiles = fs.readdirSync(notesFolderPath).filter(file => file.endsWith('.txt'));

        // If no notes are available, show a message
        if (noteFiles.length === 0) {
            vscode.window.showInformationMessage('No notes found. Please create a note first.');
            return;
        }

        // Show a Quick Pick to select a note
        const selectedNote = await vscode.window.showQuickPick(noteFiles, {
            placeHolder: 'Select a note to open'
        });

        // If no note was selected, exit the function
        if (!selectedNote) {
            return;
        }

        // Define the path for the selected note file
        const noteFilePath = path.join(notesFolderPath, selectedNote);

        // Open the selected note in the editor
        const document = await vscode.workspace.openTextDocument(noteFilePath);
        await vscode.window.showTextDocument(document);
    });

    context.subscriptions.push(addNoteCommand);
    context.subscriptions.push(openNoteCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
