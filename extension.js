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
								.split("T")[0],
							items: [],
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

	// Command to open an existing note
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

	// Command to quickly add a task
	const addTaskCommand = vscode.commands.registerCommand(
		"tasky.addTask",
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
								"Select a sheet to add a task",
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

				const taskText =
					await vscode.window.showInputBox({
						prompt: "Enter the task to add",
						validateInput: (input) =>
							input.trim() === ""
								? "Task cannot be empty"
								: null,
					})

				if (!taskText) return

				const todayDate = new Date()
					.toISOString()
					.split("T")[0]
				let todayEntry = noteData.notes.find(
					(note) => note.date === todayDate
				)

				if (!todayEntry) {
					todayEntry = {
						date: todayDate,
						items: [],
					}
					noteData.notes.push(todayEntry)
				}

				todayEntry.items.push({
					text: taskText,
					completed: false,
					added_at: new Date().toISOString(),
					closed_at: null,
				})

				fs.writeFileSync(
					noteFilePath,
					JSON.stringify(noteData, null, 2),
					"utf8"
				)
				vscode.window.showInformationMessage(
					`Task added to ${selectedNoteFile}`
				)
			} catch (error) {
				vscode.window.showErrorMessage(
					`An error occurred: ${error.message}`
				)
			}
		}
	)

	context.subscriptions.push(
		addNoteCommand,
		openNoteCommand,
		addTaskCommand
	)
}

function openNotesWebview(context, noteData, noteTitle) {
	const panel = vscode.window.createWebviewPanel(
		"noteManager",
		`Note Manager: ${noteTitle}`,
		vscode.ViewColumn.One,
		{
			enableScripts: true,
		}
	)

	panel.webview.html = getWebviewContent(noteData)

	panel.webview.onDidReceiveMessage((message) => {
		switch (message.command) {
			case "addItem":
				const todayDate = new Date()
					.toISOString()
					.split("T")[0]
				let todayEntry = noteData.notes.find(
					(note) => note.date === todayDate
				)
				if (!todayEntry) {
					todayEntry = {
						date: todayDate,
						items: [],
					}
					noteData.notes.push(todayEntry)
				}
				todayEntry.items.push({
					text: message.text || "",
					completed: false,
					added_at: new Date().toISOString(),
					closed_at: null,
				})
				saveNoteData(context, noteData, noteTitle)
				panel.webview.html = getWebviewContent(noteData)
				break
			case "editItem":
				const { noteIndex, itemIndex, newText } =
					message
				if (newText.trim() === "") {
					noteData.notes[noteIndex].items.splice(
						itemIndex,
						1
					)
				} else {
					noteData.notes[noteIndex].items[
						itemIndex
					].text = newText.trim()
				}
				saveNoteData(context, noteData, noteTitle)
				panel.webview.html = getWebviewContent(noteData)
				break
			default:
				break
		}
	})
}

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

	const highlightBrackets = (text) => {
		const regex = /\[(.*?)\]/g // Matches text inside []
		return text.replace(regex, (match, p1) => {
			const length = p1.length
			const hue = (length * 30) % 360 // Rotate hue based on length
			const color = `hsl(${hue}, 70%, 50%)` // Dynamic HSL color
			return `<span class="highlight" style="color: ${color};">${match}</span>`
		})
	}

	const todayDate = new Date().toISOString().split("T")[0]

	noteData.notes.sort((a, b) => new Date(b.date) - new Date(a.date))

	const notesHtml = noteData.notes
		.map((note, noteIndex) => {
			const isToday = note.date === todayDate

			return `
                <h3>${formatDate(note.date)}</h3>
				


                <ul>
                    ${note.items
				.map(
					(item, itemIndex) => `
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
                                    id="item-text-${noteIndex}-${itemIndex}"
                                    contenteditable="true" 
                                    onblur="saveItem(${noteIndex}, ${itemIndex})"
                                    class="item-text ${
						item.completed
							? "completed"
							: ""
					}"
                                >${highlightBrackets(item.text)}</div>
                            </div>
                            <div style="color: gray; padding-left: 30px;">
                                ${
					item.added_at
						? `Added: ${formatDate(
								item.added_at
						  )}`
						: ""
				}
                                ${
					item.closed_at
						? ` | Closed: ${formatDate(
								item.closed_at
						  )}`
						: ""
				}
                            </div>
                        </li>`
				)
				.join("")}
                </ul>
                
            `
		})
		.join("")

	return `<!DOCTYPE html>
<html>
<head>
    <title>Note Manager</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 10px; }
        h1 { font-size: 1.5em; }
        p { font-size: 1em; color: #666; }
        h3 { margin-top: 20px; font-size: 1.2em; }
        ul { list-style-type: none; padding: 0; }
        li { margin-bottom: 5px; display: flex; flex-direction: column; align-items: flex-start; }
        div[contenteditable="true"] { 
            width: 100%; 
            min-height: 20px; 
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
            white-space: pre-wrap; /* Preserve white spaces */
            overflow-wrap: break-word; /* Ensure words break appropriately */
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
        .custom-checkbox {
            display: inline-block;
            position: relative;
            width: 20px;
            height: 20px;
            margin-right: 8px;
        }
        .custom-checkbox input {
            opacity: 0;
            position: absolute;
            cursor: pointer;
            height: 0;
            width: 0;
        }
        .custom-checkbox .checkmark {
            position: absolute;
            top: 0;
            left: 0;
            height: 12px;
            width: 12px;
            background-color: #f0f0f0;
            border-radius: 4px; /* Makes the checkbox round */
            margin-top: 6px;
            transition: background-color 0.3s;
        }
        .custom-checkbox input:checked + .checkmark {
            background-color: #007acc; /* Change color when checked */
        }
        .highlight {
            font-weight: bold;
        }
        .item-text.completed {
            text-decoration: line-through; /* Strike-through effect */
            color: #b0b0b0; /* Optional: change color to indicate completion */
        }
		.addTaskInput {
		background-color:rgba(0, 0, 0, 0.10); padding: 10px 16px; color: gray; width: 400px; border-radius:10px;  border: 1px #00000050 solid;
		}
		.addTaskInput:focus {
		outline: none;
	}
		
    </style>
</head>
<body>
    <h1>${noteData.title}</h1>
    <p>${noteData.description}</p>
	<input class="addTaskInput"  type="text" id="newTaskInput" placeholder="Add a new task..." />

    ${notesHtml}
    <script>
        const vscode = acquireVsCodeApi();

		const input = document.getElementById("newTaskInput");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const taskText = input.value.trim();
        if (taskText) {
          vscode.postMessage({ command: "addItem", text: taskText });
          input.value = "";
        }
      }
    });

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
            if (!itemDiv) {
                console.error('Item div not found: item-text-' + noteIndex + '-' + itemIndex);
                return;
            }
            const newText = itemDiv.innerText.trim();
            vscode.postMessage({
                command: 'editItem',
                noteIndex: noteIndex,
                itemIndex: itemIndex,
                newText: newText
            });
        }

        function addNewTask(noteIndex) {
            const input = document.getElementById('new-task-input');
            const taskText = input.value.trim();
            if (taskText) {
                vscode.postMessage({
                    command: 'addItem',
                    noteIndex: noteIndex,
                    text: taskText
                });
                input.value = '';
            }
        }
    </script>
</body>
</html>`
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
