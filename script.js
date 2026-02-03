let db;

//Cria o banco de dados
const request = indexedDB.open("todoDB", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;

    if (!db.objectStoreNames.contains("tasks")) {
        db.createObjectStore("tasks", { keyPath: "id" });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    loadTasks();
};

request.onerror = () => {
    console.error("Erro ao abrir IndexedDB");
};

//Seleciona elementos do DOM
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");

form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask();
});

//Adicionar tarefa
function addTask() {
    const text = input.value.trim();
    if (!text) return;

    const task = {
        id: Date.now(),
        text,
        done: false
    };

    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");

    store.add(task);

    tx.oncomplete = () => {
        input.value = "";
        loadTasks();
    };
}

//Listar tarefas
function loadTasks() {
    list.innerHTML = "";

    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");

    const request = store.getAll();

    request.onsuccess = () => {
        request.result.forEach(task => {
            const li = document.createElement("li");
            li.className = "task-item";

            li.innerHTML = `
            <input type="checkbox" ${task.done ? "checked" : ""}>
            <span style="text-decoration:${task.done ? "line-through" : "none"}">${task.text}</span>
            <button>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </button>
        `;

            li.querySelector("input").onclick = () => toggleTask(task);
            li.querySelector("button").onclick = () => deleteTask(task.id);

            list.appendChild(li);
        });
    };
}

//Alterar status da tarefa
function toggleTask(task) {
    task.done = !task.done;

    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");

    store.put(task);

    tx.oncomplete = loadTasks;
}

//Remover tarefa
function deleteTask(id) {
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");

    store.delete(id);

    tx.oncomplete = loadTasks;
}
