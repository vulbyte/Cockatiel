import { Result } from "./result.mjs";
import { BaseClass } from "./baseClass.mjs";

export class SocketPool extends BaseClass {
    constructor(cockatielInstance) {
        super({
            childClassName: new.target.name,
            extraConfig: { color: "#555555", title: "Socket Manager" }
        });
        this.cockatiel = cockatielInstance;
        this.connections = new Map(); // Stores { ws, title, sent: 0, received: 0 }
    }

    GenerateUI() {
        const container = document.createElement("div");
        container.className = "socket-manager-ui";
        
        // UI for adding connections
        container.innerHTML = `
            <div id="add-conn" style="margin-bottom:1rem;">
                <input type="text" id="targetIp" placeholder="IP:Port">
                <input type="text" id="containerTitle" placeholder="Name">
                <input type="password" id="authPin" placeholder="PIN">
                <button id="connectBtn">Connect</button>
            </div>
            <table id="conn-table" style="width:100%; border-collapse: collapse;">
                <thead><tr><th>Name</th><th>Sent</th><th>Recv</th><th>Action</th></tr></thead>
                <tbody id="conn-tbody"></tbody>
            </table>
        `;

        container.querySelector("#connectBtn").onclick = () => {
            this.initiateConnection(
                container.querySelector("#targetIp").value,
                container.querySelector("#containerTitle").value,
                container.querySelector("#authPin").value
            );
        };

        this.tbody = container.querySelector("#conn-tbody");
        return Result.ok(container);
    }

    // Call this whenever connections update
    refreshTable() {
        if (!this.tbody) return;
        this.tbody.innerHTML = "";
        for (const [id, conn] of this.connections) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${conn.title}</td>
                <td>${conn.sent}</td>
                <td>${conn.received}</td>
                <td><button id="kill-${id}">Kill</button></td>
            `;
            row.querySelector(`#kill-${id}`).onclick = () => {
                conn.ws.close();
                this.connections.delete(id);
                this.refreshTable();
            };
            this.tbody.appendChild(row);
        }
    }

    async initiateConnection(ip, title, pin) {
        const ws = new WebSocket(`ws://${ip}`);
        const id = `req-${Date.now()}`;
        this.connections.set(id, { ws, title, sent: 0, received: 0 });

        ws.onopen = () => {
            const authMsg = {
                header: { version: 1, requestId: id, jwt: "", type: "AUTH" },
                authPin: parseInt(pin) || 0,
                publicIp: window.location.hostname
            };
            ws.send(JSON.stringify(authMsg));
            this.connections.get(id).sent++;
            this.refreshTable();
        };

        ws.onmessage = (event) => {
            this.connections.get(id).received++;
            this.refreshTable();
            this.handleIncomingMessage(id, event.data);
        };

        ws.onclose = () => {
            this.connections.delete(id);
            this.refreshTable();
        };
    }

    handleIncomingMessage(id, rawData) {
        const msg = JSON.parse(rawData);
        // ... switch case logic ...
    }
}
