const vscode = require("vscode")
const fs = require("fs")
const path = require("path")
const { v4: uuidv4 } = require("uuid")

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Congratulations, your extension "tasky" is now active!')

	// Define the directory for storing JSON files
	const notesDir = path.join(context.globalStorageUri.fsPath, "notes")
	if (!fs.existsSync(notesDir)) {
		fs.mkdirSync(notesDir, { recursive: true })
	}

	// Command to add a new note
	const addNoteCommand = vscode.commands.registerCommand(
		"tasky.addNote",
		async function () {
			try {
				const noteTitle =
					await vscode.window.showInputBox({
						prompt: "Enter the note title (this will also be the filename)",
						validateInput: (input) => {
							return input.trim() ===
								""
								? "Note title cannot be empty"
								: null
						},
					})

				if (!noteTitle) return

				const noteDescription =
					await vscode.window.showInputBox({
						prompt: "Enter the note description",
						validateInput: (input) => {
							return input.trim() ===
								""
								? "Note description cannot be empty"
								: null
						},
					})

				if (!noteDescription) return

				const noteFilePath = path.join(
					notesDir,
					`${noteTitle}.json`
				)

				// Check if the file already exists
				if (fs.existsSync(noteFilePath)) {
					vscode.window.showErrorMessage(
						`A note with the filename "${noteTitle}.json" already exists.`
					)
					return
				}

				const newNote = {
					id: uuidv4(),
					title: noteTitle,
					description: noteDescription,
					notes: [
						{
							date: new Date()
								.toISOString()
								.split("T")[0], // Only the date part
							items: [
								{
									text: "What's for today?",
									completed: false,
									added_at: new Date().toISOString(),
									closed_at: null,
								},
							],
						},
					],
				}

				// Save the note to a new JSON file
				fs.writeFileSync(
					noteFilePath,
					JSON.stringify(newNote, null, 2),
					"utf8"
				)

				openNotesWebview(context, newNote, noteTitle)
			} catch (error) {
				vscode.window.showErrorMessage(
					`An error occurred while adding a note: ${error.message}`
				)
			}
		}
	)

	// Function to move incomplete tasks from previous days to today
	function moveIncompleteTasksToToday(noteData) {
		const todayDate = new Date().toISOString().split("T")[0] // Format to YYYY-MM-DD
		const newTodayEntry = noteData.notes.find(
			(note) => note.date === todayDate
		) || {
			date: todayDate,
			items: [],
		}

		noteData.notes.forEach((note) => {
			if (note.date !== todayDate) {
				// Find incomplete tasks
				const incompleteTasks = note.items.filter(
					(item) => !item.completed
				)
				// Add them to today's entry
				newTodayEntry.items.push(
					...incompleteTasks.map((item) => ({
						...item,
						added_at: new Date().toISOString(), // Update added_at to today
					}))
				)
				// Remove incomplete tasks from the previous day
				note.items = note.items.filter(
					(item) => item.completed
				)
			}
		})

		// If today’s entry doesn’t already exist, add it
		if (!noteData.notes.find((note) => note.date === todayDate)) {
			noteData.notes.push(newTodayEntry)
		}

		// Clean up empty entries from past dates
		noteData.notes = noteData.notes.filter(
			(note) => note.items.length > 0
		)
	}

	// Update the openNoteCommand to call moveIncompleteTasksToToday
	const openNoteCommand = vscode.commands.registerCommand(
		"tasky.openNote",
		async function () {
			try {
				const noteFiles = fs
					.readdirSync(notesDir)
					.filter((file) =>
						file.endsWith(".json")
					)

				if (noteFiles.length === 0) {
					vscode.window.showInformationMessage(
						"No notes found. Please create a note first."
					)
					return
				}

				const selectedNoteFile =
					await vscode.window.showQuickPick(
						noteFiles,
						{
							placeHolder:
								"Select a note to open",
						}
					)

				if (!selectedNoteFile) return

				const noteFilePath = path.join(
					notesDir,
					selectedNoteFile
				)
				const noteData = JSON.parse(
					fs.readFileSync(noteFilePath, "utf8")
				)

				// Move incomplete tasks to today
				moveIncompleteTasksToToday(noteData)

				// Save the updated notes back to the JSON file
				fs.writeFileSync(
					noteFilePath,
					JSON.stringify(noteData, null, 2),
					"utf8"
				)

				openNotesWebview(
					context,
					noteData,
					path.basename(selectedNoteFile, ".json")
				)
			} catch (error) {
				vscode.window.showErrorMessage(
					`An error occurred while opening a note: ${error.message}`
				)
			}
		}
	)

	context.subscriptions.push(addNoteCommand)
	context.subscriptions.push(openNoteCommand)
}

// Function to move incomplete tasks from previous days to today
function moveIncompleteTasksToToday(noteData) {
	const todayDate = new Date().toISOString().split("T")[0] // Format to YYYY-MM-DD
	let todayEntry = noteData.notes.find((note) => note.date === todayDate)

	// If no entry for today exists, create a new one
	if (!todayEntry) {
		todayEntry = {
			date: todayDate,
			items: [],
		}
		noteData.notes.push(todayEntry)
	}

	// Loop through all notes and collect incomplete tasks
	noteData.notes.forEach((note) => {
		if (note.date !== todayDate) {
			// Find incomplete tasks
			const incompleteTasks = note.items.filter(
				(item) => !item.completed
			)

			// Move them to today's entry
			todayEntry.items.push(
				...incompleteTasks.map((item) => ({
					...item,
					added_at: new Date().toISOString(), // Update added_at to today
				}))
			)

			// Remove incomplete tasks from the original date
			note.items = note.items.filter((item) => item.completed)
		}
	})

	// Clean up notes with no items
	noteData.notes = noteData.notes.filter((note) => note.items.length > 0)
}

// Function to open a note in a Webview
function openNotesWebview(context, noteData, noteTitle) {
	// Move incomplete tasks to today
	moveIncompleteTasksToToday(noteData)

	// Save the updated note data back to its JSON file after moving tasks
	saveNoteData(context, noteData, noteTitle)

	const panel = vscode.window.createWebviewPanel(
		"noteManager",
		`Note Manager: ${noteTitle}`,
		vscode.ViewColumn.One,
		{
			enableScripts: true,
		}
	)

	// Generate the HTML content for the Webview
	panel.webview.html = getWebviewContent(noteData)

	// Handle messages from the Webview
	panel.webview.onDidReceiveMessage((message) => {
		switch (message.command) {
			case "toggleComplete":
				toggleItemCompletion(
					noteData,
					message.noteIndex,
					message.itemIndex
				)
				saveNoteData(context, noteData, noteTitle)
				panel.webview.html = getWebviewContent(noteData) // Refresh the view
				break
			case "editItem":
				editItem(
					noteData,
					message.noteIndex,
					message.itemIndex,
					message.newText
				)
				saveNoteData(context, noteData, noteTitle)
				break
			case "addItem":
				addItem(noteData, message.noteIndex)
				saveNoteData(context, noteData, noteTitle)
				panel.webview.html = getWebviewContent(noteData) // Refresh the view
				break
			case "removeItem":
				removeItem(
					noteData,
					message.noteIndex,
					message.itemIndex
				)
				saveNoteData(context, noteData, noteTitle)
				panel.webview.html = getWebviewContent(noteData) // Refresh the view
				break
		}
	})
}

// Function to toggle completion status of a checklist item
function toggleItemCompletion(noteData, noteIndex, itemIndex) {
	const item = noteData.notes[noteIndex].items[itemIndex]
	item.completed = !item.completed
	item.closed_at = item.completed ? new Date().toISOString() : null
}

// Function to edit the text of a checklist item
function editItem(noteData, noteIndex, itemIndex, newText) {
	const item = noteData.notes[noteIndex].items[itemIndex]
	item.text = newText.trim() // Trim whitespace from both sides
}

// Function to add a new checklist item
function addItem(noteData, noteIndex) {
	const newItem = {
		text: "",
		completed: false,
		added_at: new Date().toISOString(),
		closed_at: null,
	}
	noteData.notes[noteIndex].items.push(newItem)
}

// Function to remove a new checklist item
function removeItem(noteData, noteIndex, itemIndex) {
	if (
		noteData.notes[noteIndex] &&
		noteData.notes[noteIndex].items &&
		itemIndex < noteData.notes[noteIndex].items.length
	) {
		noteData.notes[noteIndex].items.splice(itemIndex, 1)
	}
}

// Function to save note data back to its JSON file
function saveNoteData(context, noteData, noteTitle) {
	const noteFilePath = path.join(
		context.globalStorageUri.fsPath,
		"notes",
		`${noteTitle}.json`
	)
	fs.writeFileSync(
		noteFilePath,
		JSON.stringify(noteData, null, 2),
		"utf8"
	)
}

// Function to generate HTML content for the Webview
function getWebviewContent(noteData) {
	const formatDate = (dateString) => {
		const options = {
			day: "numeric",
			month: "long",
			year: "numeric",
		}
		return new Date(dateString).toLocaleDateString(
			undefined,
			options
		)
	}

	// Highlight the text within square brackets with dynamic colors
	const highlightBrackets = (text) => {
		const regex = /\[(.*?)\]/g // Matches text inside []
		return text.replace(regex, (match, p1) => {
			const length = p1.length
			const hue = (length * 30) % 360 // Rotate hue based on length
			const color = `hsl(${hue}, 70%, 50%)` // Dynamic HSL color
			return `<span class="highlight" style="color: ${color};">${match}</span>`
		})
	}

	const todayDate = new Date().toISOString().split("T")[0] // Current date in YYYY-MM-DD format

	// Sort notes in descending order of date
	noteData.notes.sort((a, b) => new Date(b.date) - new Date(a.date))

	let notesHtml = noteData.notes
		.map((note, noteIndex) => {
			const isToday = note.date === todayDate // Check if the note is for today

			return `
        <h3>${formatDate(note.date)}</h3>
        <ul>
            ${note.items
			.map((item, itemIndex) => {
				const itemId = `item-text-${noteIndex}-${itemIndex}`
				return `
                <li style="display: flex; flex-direction: column; align-items: flex-start; margin-top: 20px">
                    <div style="display: flex; align-items: flex-start">
                        <label class="custom-checkbox">
                            <input type="checkbox" ${
					item.completed ? "checked" : ""
				} 
                                onchange="toggleComplete(${noteIndex}, ${itemIndex})">
                            <span class="checkmark"></span>
                        </label>
                        <div 
                            id="${itemId}" 
                            contenteditable="true" 
                            onblur="saveItem(${noteIndex}, ${itemIndex})"
                            class="item-text ${
					item.completed ? "completed" : ""
				}"
                        >${highlightBrackets(item.text)}</div>
                    </div>
                    <div style="color: gray; padding-left:30px">
                        ${
				item.added_at
					? `Added: ${formatDate(item.added_at)}`
					: ""
			}
                        ${
				item.closed_at
					? `Closed: ${formatDate(
							item.closed_at
					  )}`
					: ""
			}
                    </div>
                </li>
                `
			})
			.join("")}
        </ul>
        ${
		isToday
			? `<button onclick="addItem(${noteIndex})">+ Add Item</button>`
			: ""
	}
        `
		})
		.join("")

	return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Note Manager</title>
        <style>
            /* Your existing styles */
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
                const itemDiv = document.getElementById('item-text-' + noteIndex + '-' + itemIndex);
                itemDiv.classList.toggle('completed');
            }

            function saveItem(noteIndex, itemIndex) {
                const itemDiv = document.getElementById('item-text-' + noteIndex + '-' + itemIndex);
                const newText = itemDiv.innerText.trim();
                if (newText === '') {
                    vscode.postMessage({
                        command: 'removeItem',
                        noteIndex: noteIndex,
                        itemIndex: itemIndex
                    });
                } else {
                    vscode.postMessage({
                        command: 'editItem',
                        noteIndex: noteIndex,
                        itemIndex: itemIndex,
                        newText: newText
                    });
                }
            }

            function addItem(noteIndex) {
                vscode.postMessage({
                    command: 'addItem',
                    noteIndex: noteIndex
                });
            }
        </script>
    </body>
    </html>
    `
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
