// Variável global para o banco de dados
let db;

// ===== INICIALIZAÇÃO DO INDEXEDDB =====
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

// ===== SELEÇÃO DE ELEMENTOS DO DOM =====
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");

// ===== VARIÁVEIS PARA CONTROLE DE DUPLO CLIQUE =====
let lastClickedSpan = null;
let lastClickTime = 0;
const DOUBLE_CLICK_DELAY = 500; // 500ms

// ===== EVENT LISTENERS =====
form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask();
});

// ===== FUNÇÕES DE MANIPULAÇÃO DE TAREFAS =====

/**
 * Adiciona uma nova tarefa ao banco de dados
 */
function addTask() {
    if (!db) {
        alert("O banco de dados ainda está carregando ou falhou ao abrir. Tente recarregar a página.");
        return;
    }
    
    const text = input.value.trim();
    if (!text) return;

    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const countRequest = store.count();

    countRequest.onsuccess = () => {
        const task = {
            id: Date.now(),
            text,
            done: false,
            order: countRequest.result
        };

        const txWrite = db.transaction("tasks", "readwrite");
        const storeWrite = txWrite.objectStore("tasks");
        const addRequest = storeWrite.add(task);

        addRequest.onerror = () => {
            console.error("Erro ao adicionar tarefa:", addRequest.error);
        };

        txWrite.oncomplete = () => {
            input.value = "";
            loadTasks();
        };

        txWrite.onerror = () => {
            console.error("Erro na transação:", txWrite.error);
        };
    };
}

/**
 * Carrega todas as tarefas do banco e as exibe na tela
 */
function loadTasks() {
    if (!db) return;
    
    list.innerHTML = "";

    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const request = store.getAll();

    request.onsuccess = () => {
        // Ordena as tarefas pelo campo 'order'
        const sortedTasks = request.result.sort((a, b) => {
            return (a.order ?? Infinity) - (b.order ?? Infinity);
        });

        sortedTasks.forEach(task => {
            const li = document.createElement("li");
            li.className = "task-item";
            li.dataset.id = task.id;

            li.innerHTML = `
                <button class="move-button" >
                    <i class="fa-solid fa-bars"></i>
                </button>
                <input type="checkbox" ${task.done ? "checked" : ""}>
                <span style="text-decoration:${task.done ? "line-through" : "none"}">${task.text}</span>
                <button class="delete-button">
                    <i class="fa-solid fa-minus"></i>
                </button>
            `;

            li.querySelector("input").onclick = () => toggleTask(task);
            li.querySelector(".delete-button").onclick = () => deleteTask(task.id);
            
            // Adicionar event listener para duplo clique no span
            const span = li.querySelector("span");
            span.style.cursor = "pointer";
            span.addEventListener("click", () => handleSpanClick(span, task));

            list.appendChild(li);
        });
    };
}

/**
 * Alterna o status de conclusão de uma tarefa
 * @param {Object} task - A tarefa a ser alterada
 */
function toggleTask(task) {
    if (!db) return;
    
    task.done = !task.done;

    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    store.put(task);

    tx.oncomplete = () => loadTasks();
    tx.onerror = () => console.error("Erro ao atualizar tarefa:", tx.error);
}

/**
 * Remove uma tarefa do banco de dados
 * @param {number} id - ID da tarefa a ser removida
 */
function deleteTask(id) {
    if (!db) return;
    
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    const deleteRequest = store.delete(id);

    deleteRequest.onerror = () => {
        console.error("Erro ao deletar tarefa:", deleteRequest.error);
    };

    tx.oncomplete = () => loadTasks();
}

/**
 * Ativa o modo de edição para uma tarefa
 * @param {HTMLElement} spanElement - Elemento span da tarefa
 * @param {Object} task - A tarefa a ser editada
 */
function enableEditMode(spanElement, task) {
    const currentText = spanElement.textContent;
    
    // Criar um input para edição
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.value = currentText;
    editInput.className = "task-edit-input";
    editInput.style.width = "100%";
    editInput.style.padding = "4px 8px";
    editInput.style.border = "2px solid #4a4a4a";
    editInput.style.borderRadius = "4px";
    editInput.style.fontFamily = "inherit";
    editInput.style.fontSize = "inherit";

    // Substituir o span pelo input
    spanElement.replaceWith(editInput);
    editInput.focus();
    editInput.select();

    /**
     * Salva a edição
     */
    const saveEdit = () => {
        const newText = editInput.value.trim();
        
        if (newText && newText !== currentText) {
            // Atualizar a tarefa no banco
            task.text = newText;
            
            const tx = db.transaction("tasks", "readwrite");
            const store = tx.objectStore("tasks");
            store.put(task);

            tx.oncomplete = () => {
                console.log("Tarefa atualizada com sucesso");
                location.reload();
            };

            tx.onerror = () => {
                console.error("Erro ao atualizar tarefa:", tx.error);
                location.reload();
            };
        } else if (newText === currentText) {
            location.reload();
        } else {
            // Texto vazio, cancelar edição
            location.reload();
        }
    };

    // Salvar ao pressionar Enter
    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            saveEdit();
        } else if (e.key === "Escape") {
            location.reload();
        }
    });

    // Salvar ao perder o foco
    editInput.addEventListener("blur", saveEdit);
}

/**
 * Detecta duplo clique no span da tarefa
 * @param {HTMLElement} spanElement - Elemento span da tarefa
 * @param {Object} task - A tarefa associada
 */
function handleSpanClick(spanElement, task) {
    const now = Date.now();

    if (lastClickedSpan === spanElement && (now - lastClickTime) < DOUBLE_CLICK_DELAY) {
        // Duplo clique detectado
        enableEditMode(spanElement, task);
        lastClickedSpan = null;
        lastClickTime = 0;
    } else {
        // Primeiro clique ou clique em elemento diferente
        lastClickedSpan = spanElement;
        lastClickTime = now;
    }
}

/**
 * Atualiza o contador de tarefas a cada segundo
 */
setInterval(() => {
    if (!db) return;
    
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const request = store.getAll();

    request.onsuccess = () => {
        const count = request.result.length;
        const taskCountElement = document.getElementById("task-count");
        if (taskCountElement) {
            taskCountElement.innerText = `${count} task${count !== 1 ? 's' : ''}`;
        }
    };
}, 1000);

/**
 * Atualiza a ordem das tarefas no banco de dados baseado na ordem do DOM
 */
function updateTasksOrder() {
    if (!db) return;

    const items = list.querySelectorAll("li.task-item");
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");

    items.forEach((item, index) => {
        const taskId = parseInt(item.dataset.id);
        const getRequest = store.get(taskId);

        getRequest.onsuccess = () => {
            const task = getRequest.result;
            if (task) {
                task.order = index;
                store.put(task);
            }
        };
    });

    tx.oncomplete = () => {
        console.log("Ordem das tarefas atualizada no banco de dados");
    };

    tx.onerror = () => {
        console.error("Erro ao atualizar ordem das tarefas:", tx.error);
    };
}

/**
 * Inicializa a funcionalidade de arrastar e soltar tarefas
 */
const lista = document.getElementById('task-list');

if (lista) {
    new Sortable(lista, {
        handle: ".move-button",
        animation: 150,
        ghostClass: 'azul-claro',
        onEnd: function (evt) {
            console.log(`Item movido de ${evt.oldIndex} para ${evt.newIndex}`);
            updateTasksOrder();
        }
    });
}

/**
 * Reseta o cache, banco de dados e recarrega a página
 */
function resetApp() {
    // Confirmação do usuário
    if (!confirm("Tem certeza que deseja apagar todas as tarefas e resetar o app?")) {
        return;
    }

    // 1. Limpar cache
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }

    // 2. Limpar localStorage e sessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // 3. Deletar banco de dados IndexedDB
    if (db) {
        const deleteRequest = indexedDB.deleteDatabase("todoDB");
        
        deleteRequest.onsuccess = () => {
            console.log("Banco de dados deletado com sucesso");
            // 4. Recarregar a página
            location.reload();
        };

        deleteRequest.onerror = () => {
            console.error("Erro ao deletar banco de dados");
            // Mesmo com erro, recarrega a página
            location.reload();
        };

        deleteRequest.onblocked = () => {
            console.warn("Exclusão do banco de dados bloqueada");
            // Força o reload após 1 segundo
            setTimeout(() => location.reload(), 1000);
        };
    } else {
        // Se db não existe, apenas recarrega a página
        location.reload();
    }
}

// Event listener para o botão reset
const resetButton = document.querySelector(".reset-button");
if (resetButton) {
    resetButton.addEventListener("click", resetApp);
}

/**
 * Limpa completamente todos os storages do navegador
 * Previne acúmulo de dados e excesso de limite de armazenamento
 */
function clearAllStorage() {
    try {
        // 1. Limpar localStorage
        localStorage.clear();
        console.log("✓ LocalStorage limpo");

        // 2. Limpar sessionStorage
        sessionStorage.clear();
        console.log("✓ SessionStorage limpo");

        // 3. Limpar cookies
        document.cookie.split(";").forEach(c => {
            const eqPos = c.indexOf("=");
            const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
            if (name) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
            }
        });
        console.log("✓ Cookies limpos");

        // 4. Limpar todos os IndexedDB
        if (indexedDB) {
            indexedDB.databases?.().then(dbs => {
                dbs.forEach(db => {
                    indexedDB.deleteDatabase(db.name);
                });
                console.log("✓ Todos os IndexedDB deletados");
            }).catch(() => {
                // Se databases() não estiver disponível, deletar o específico
                const deleteRequest = indexedDB.deleteDatabase("todoDB");
                deleteRequest.onsuccess = () => {
                    console.log("✓ IndexedDB 'todoDB' deletado");
                };
            });
        }

        // 5. Limpar Cache (Service Workers)
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
                console.log("✓ Cache limpo");
            });
        }

        // 6. Limpar notificações
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                });
                console.log("✓ Service Workers desregistrados");
            });
        }

        console.log("🧹 Limpeza completa de storage realizada com sucesso!");
        return true;
    } catch (error) {
        console.error("Erro ao limpar storage:", error);
        return false;
    }
}

/**
 * Monitora o uso de armazenamento do navegador
 */
function getStorageStatus() {
    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
            const percentageUsed = (estimate.usage / estimate.quota) * 100;
            console.log(`Uso de armazenamento: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB / ${(estimate.quota / 1024 / 1024).toFixed(2)} MB (${percentageUsed.toFixed(2)}%)`);
            
            // Alertar se estiver usando mais de 80%
            if (percentageUsed > 80) {
                console.warn("Você está usando mais de 80% do armazenamento disponível!");
                console.log("Considere executar clearAllStorage() para liberar espaço");
            }
        }).catch(error => {
            console.log("StorageManager API não disponível:", error);
        });
    }
}

// Verificar status de armazenamento a cada 1 minuto
setInterval(getStorageStatus, 60000);

// Verificar uma vez ao carregar
getStorageStatus();