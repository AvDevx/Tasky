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
        const noteFilePath = path.join(notesFolderPath, `${noteName}.md`);

        // Check if a note with the same name already exists
        if (fs.existsSync(noteFilePath)) {
            vscode.window.showErrorMessage(`A note with the name "${noteName}" already exists.`);
            return;
        }

        // Create the new note file with empty content
        fs.writeFileSync(noteFilePath, '', 'utf8');
        vscode.window.showInformationMessage(`Note "${noteName}" created successfully!`);

        // Open the newly created note in the editor
        const document = await vscode.workspace.openTextDocument(noteFilePath);
        const editor = await vscode.window.showTextDocument(document);
        
        // Open the Markdown preview
        vscode.commands.executeCommand('markdown.showPreviewToSide');

        // Add current date heading and checkbox to the new note
        await addCurrentDateHeading(editor);
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
        const noteFiles = fs.readdirSync(notesFolderPath).filter(file => file.endsWith('.md'));

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
        const editor = await vscode.window.showTextDocument(document);

        // Open the Markdown preview
        vscode.commands.executeCommand('markdown.showPreviewToSide');

        // Add current date heading if not present
        await addCurrentDateHeading(editor);
    });

    context.subscriptions.push(addNoteCommand);
    context.subscriptions.push(openNoteCommand);
}

async function addCurrentDateHeading(editor) {
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(today); // Format: 12 July 2024
    const dateHeading = `### ${formattedDate}\n`;
    const checkbox = `- [ ] What's for today?\n`;

    const document = editor.document;
    const text = document.getText();

    // Add current date heading and checkbox if not present
    if (!text.includes(dateHeading)) {
        const position = document.positionAt(text.length); // End of the document
        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, position, `\n${dateHeading}${checkbox}`);
        await vscode.workspace.applyEdit(edit);
    }

    // Move incomplete checklists from previous dates to the current date
    await moveIncompleteChecklistsToCurrentDate(editor);
}

async function moveIncompleteChecklistsToCurrentDate(editor) {
    const today = new Date();
    const formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(today); // Format: 12 July 2024
    const dateHeading = `### ${formattedDate}\n`;

    const document = editor.document;
    const text = document.getText();
    const lines = text.split('\n');

    let currentDateIndex = -1;
    let previousDateIndex = -1;
    let incompleteChecklists = [];
    let updatedLines = [...lines]; // Create a copy of lines to modify

    // Find the index of the current date heading and previous date headings
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('### ')) {
            const headingDate = lines[i].substring(4).trim();
            if (headingDate === formattedDate) {
                currentDateIndex = i;
            } else {
                previousDateIndex = i;
            }
        }
    }

    if (currentDateIndex === -1) {
        return; // Current date heading not found
    }

    // Collect incomplete checklists from previous dates and remove them
    if (previousDateIndex !== -1) {
        for (let i = previousDateIndex + 1; i < lines.length; i++) {
            if (lines[i].startsWith('### ')) {
                break; // Stop if a new date heading is encountered
            }
            if (lines[i].startsWith('- [ ]')) {
                incompleteChecklists.push(lines[i]);
                updatedLines[i] = ''; // Remove the checklist item from the original location
            }
        }
    }

    // Add incomplete checklists to the current date heading
    if (incompleteChecklists.length > 0) {
        const position = document.positionAt(text.length); // End of the document
        const edit = new vscode.WorkspaceEdit();
        edit.insert(document.uri, position, `\n${dateHeading}${incompleteChecklists.join('\n')}`);
        await vscode.workspace.applyEdit(edit);
        
        // Remove empty lines from updatedLines
        updatedLines = updatedLines.filter(line => line !== '');

        // Update the document with the cleaned lines
        const updatedText = updatedLines.join('\n');
        const textEdit = new vscode.WorkspaceEdit();
        textEdit.replace(document.uri, new vscode.Range(0, 0, lines.length, 0), updatedText);
        await vscode.workspace.applyEdit(textEdit);
    }

    // Save document after updating
    await document.save();
}



function deactivate() {}

module.exports = {
    activate,
    deactivate
};
